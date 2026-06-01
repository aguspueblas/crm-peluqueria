# Spec: IA Agent — Tool Use con Claude API

## Responsabilidad

Recibir un mensaje de texto de un cliente de WhatsApp, mantener el contexto
de la conversación, y ejecutar las acciones necesarias sobre el backend
(consultar servicios, ver disponibilidad, reservar turnos) usando Claude API
con Tool Use. Devuelve el texto de respuesta para enviar al cliente.

---

## Arquitectura del agente

```
AgentRunner.run({ negocio, from, senderName, message })
    ↓
ConversationStore.load(negocio_id, from)     — historial de la conversación
    ↓
buildSystemPrompt(negocio, senderName, from) — contexto del negocio + cliente
    ↓
Claude API (messages.create con tools)       — loop hasta end_turn o derivación
    ↓ tool_use blocks
ToolExecutor.execute(toolName, input)        — llama services internos
    ↓ (si derivar_a_admin)
ConversationStore.marcarDerivada()           — bloquea futuros mensajes
notificaciones.notificarDerivacion()         — WhatsApp al admin del negocio
    ↓ end_turn
ConversationStore.save(negocio_id, from)     — guarda historial actualizado
    ↓
string (texto de respuesta al cliente)
```

---

## Estructura de archivos

```
src/
  agent/
    runner.js             — loop principal de Tool Use
    tools.js              — definiciones de tools para Claude API
    executor.js           — ejecuta cada tool llamando al service correspondiente
    prompt.js             — construye el system prompt con contexto del negocio
  conversation/
    store.js              — load/save/getEstado/marcarDerivada en PostgreSQL (JSONB)
  services/
    notificaciones.service.js  — envía WhatsApp al admin cuando se deriva
db/
  migrations/
    002_conversaciones.sql     — tabla conversaciones
    007_conversacion_estado.sql — columna estado VARCHAR(20) DEFAULT 'activa'
```

---

## Seguridad y control de costos

### 1. Rate limiting por número de teléfono
Máximo **5 mensajes por minuto** por número. Si se supera, el mensaje se
descarta silenciosamente (no se llama a Claude).

Implementado con un `Map` en memoria: `rateLimitStore = Map<phone, { count, windowStart }>`.
La ventana se resetea cada 60 segundos.

> Limitación: el store está en memoria y se pierde al reiniciar el proceso.

### 2. Límite de longitud de input
Mensajes de más de **1.000 caracteres** se truncan antes de enviarse a Claude.

### 3. Límite de iteraciones en el tool use loop
Máximo **8 iteraciones** por turno. Si se alcanza, el agente responde con un
mensaje genérico de error.

### 4. Límite de historial de conversación
Se mantienen solo los **últimos 10 mensajes** del historial al llamar a Claude.
La tabla guarda el historial completo para auditoría.

### 5. max_tokens acotado
La respuesta de Claude se limita a **512 tokens**.

### 6. Spending limit en Anthropic Dashboard
Configurar un límite de gasto mensual en https://console.anthropic.com.

---

## Conversation Store

### Responsabilidad
Mantener el historial de mensajes de cada conversación y el estado de derivación.

### Tabla `conversaciones`

```sql
CREATE TABLE IF NOT EXISTS conversaciones (
  id          SERIAL PRIMARY KEY,
  negocio_id  INTEGER NOT NULL REFERENCES negocios(id),
  telefono    VARCHAR(20) NOT NULL,
  messages    JSONB NOT NULL DEFAULT '[]',
  estado      VARCHAR(20) NOT NULL DEFAULT 'activa',
  updated_at  TIMESTAMP DEFAULT NOW(),
  CONSTRAINT conversaciones_negocio_telefono_unique UNIQUE (negocio_id, telefono)
);
```

**Estados de conversación:**

| Estado | Descripción |
|---|---|
| `activa` | El agente responde normalmente |
| `derivada` | El agente no responde. Un humano atiende al cliente |

### Operaciones del store

```js
load(negocio_id, telefono)           // → messages[] o []
save(negocio_id, telefono, messages) // upsert historial
getEstado(negocio_id, telefono)      // → 'activa' | 'derivada'
marcarDerivada(negocio_id, telefono) // actualiza estado a 'derivada'
prune(messages)                      // → últimos 10 mensajes
```

### TTL
Un job con `setInterval` cada 30 minutos limpia conversaciones con
`updated_at < NOW() - INTERVAL '2 hours'`.

---

## System Prompt

Se construye dinámicamente al inicio de cada request en `prompt.js`.

### Comportamiento según tipo de prompt

**Negocios con `system_prompt` moderno (tiene placeholders):**
El template se resuelve con los datos del negocio y el cliente, y se devuelve
tal cual. El negocio controla 100% las instrucciones del agente.

**Negocios con `system_prompt` legacy (sin placeholders):**
Se inyectan los datos dinámicos como sección separada y se agregan
instrucciones de flujo genéricas al final (FLUJO PARA AGENDAR, CANCELAR, etc.)

### Placeholders disponibles

| Placeholder | Valor inyectado |
|---|---|
| `{agente_nombre}` | `negocio.agente_nombre` |
| `{negocio_nombre}` | `negocio.nombre` |
| `{negocio_rubro}` | `negocio.rubro` |
| `{fecha_actual}` | Fecha y hora en Argentina (UTC-3), ej: `"martes 27 de mayo de 2026 (2026-05-27)"` |
| `{cliente_id}` | ID del cliente (resuelto por teléfono antes de llamar a Claude) |
| `{cliente_nombre}` | Nombre del cliente o `null` si no fue registrado aún |
| `{cliente_telefono}` | Teléfono del cliente |
| `{servicios_lista}` | Lista formateada: `- Corte · 30 min · $3500 · id: 1` |
| `{profesionales_lista}` | Lista formateada: `- Juan (id: 10)` |

El cliente se identifica (o crea) **antes** de llamar a Claude, por lo que
`{cliente_id}` siempre tiene un valor válido.

---

## Definición de Tools

Cada tool es una llamada directa a los services internos (mismo proceso,
sin HTTP). El `negocio_id` nunca lo pasa Claude — viene del contexto del runner.

### get_servicios
→ `serviciosService.getAll(negocio_id)`

Lista los servicios del negocio. Útil cuando el cliente no especificó servicio
o cuando el prompt no inyecta `{servicios_lista}`.

### get_disponibilidad
→ `disponibilidadService.getSlots(negocio_id, { fecha, servicio_id, profesional_id? })`

Devuelve slots libres para un servicio en una fecha. `fecha` en formato `YYYY-MM-DD`.

### actualizar_cliente
→ `clientesService.updateNombre(negocio_id, cliente_id, nombre)`

Actualiza el nombre del cliente. Llamar cuando el cliente lo proporciona por
primera vez (`{cliente_nombre}` era `null`). El nombre se valida y sanitiza antes de guardarse.

### crear_turno
→ `turnosService.create(negocio_id, { cliente_id, profesional_id, servicio_id, fecha_hora, direccion?, observaciones? })`

Reserva un turno. Solo llamar después de confirmación explícita del cliente.
`fecha_hora` en formato `YYYY-MM-DDTHH:MM:00`.
`observaciones` debe incluir todo el contexto relevante del trabajo
(síntomas, frigorías, tipo de acceso, materiales, etc.).

### get_turnos_cliente
→ `turnosService.getAll(negocio_id, { cliente_id, estado: 'pendiente' })`

Lista los turnos activos del cliente. Usar al inicio del flujo de cancelación.

### cancelar_turno
→ `turnosService.cancel(negocio_id, turno_id)`

Cancela un turno. Solo después de confirmación explícita del cliente.

### get_profesionales
→ `profesionalesService.getAll(negocio_id)`

Lista profesionales activos. Usar cuando el cliente pide un profesional por nombre.

### derivar_a_admin
→ Marca conversación como `derivada` + notifica al `admin_phone` del negocio

Deriva la conversación al administrador humano. Usar cuando:
- El cliente pide hablar con una persona
- Hay una situación fuera del flujo normal
- El agente no puede resolver el problema en 2 intercambios

Input requerido: `{ motivo: string }` — descripción breve del motivo.

Tras llamar a `derivar_a_admin`, el runner hace **una última vuelta** del loop
para que Claude despida al cliente, luego termina. El handler ignorará todos
los mensajes futuros de ese número hasta que un admin restablezca el estado.

---

## Flujo de derivación

```
Cliente: "necesito hablar con alguien"
    ↓
Claude llama derivar_a_admin({ motivo: "Cliente solicita atención humana" })
    ↓
runner → store.marcarDerivada(negocio_id, from)
runner → notificarDerivacion(negocio, from, motivo)
         → WhatsApp a negocio.admin_phone:
           "[Expreso Polar] Derivación pendiente
            Cliente: +5491112345678
            Motivo: Cliente solicita atención humana"
    ↓
Última vuelta del loop → Claude despide al cliente
    ↓
Próximos mensajes del cliente → handler los ignora (estado === 'derivada')
```

---

## Manejo de errores del agente

Si un tool falla (409 solapamiento, 400 fuera de horario, etc.), el
`executor.js` captura la excepción y devuelve:
```json
{ "error": true, "message": "El profesional ya tiene un turno en ese horario" }
```
Claude recibe ese `tool_result` con el error y reformula la respuesta
al cliente naturalmente, sin stacktraces ni tecnicismos.

---

## Variables de entorno requeridas

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxx
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx   # para notificaciones al admin
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

## Fuera de scope (MVP)
- Notificaciones proactivas (recordatorio 24hs antes)
- Mensajes de template (fuera de la ventana de 24hs de WhatsApp)
- Soporte multiidioma
- Manejo de mensajes de media (imágenes, audio)
- TTL de conversación configurable por negocio (hoy fijo en 2 horas)
- Tool `get_proximos_slots` (multi-día en una sola llamada)
- Tool `reagendar_turno`

## Pendientes post-MVP
- **Control de costos por negocio**: registrar `input_tokens` y `output_tokens`
  por llamada a Claude sumados por `negocio_id` en una tabla `uso_tokens`.
- **TTL configurable**: campo `conversacion_ttl_horas` en `negocios` para negocios
  donde el cliente puede responder al día siguiente (ej: confirmar seña).
