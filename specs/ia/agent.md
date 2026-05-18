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
ConversationStore.load(negocio_id, from)   — historial de la conversación
    ↓
buildSystemPrompt(negocio)                 — contexto del negocio
    ↓
Claude API (messages.create con tools)     — loop hasta end_turn
    ↓ tool_use blocks
ToolExecutor.execute(toolName, input)      — llama services internos
    ↓
Claude API (continúa con tool_result)
    ↓ end_turn
ConversationStore.save(negocio_id, from)  — guarda historial actualizado
    ↓
string (texto de respuesta al cliente)
```

---

## Estructura de archivos

```
src/
  agent/
    runner.js           — loop principal de Tool Use
    tools.js            — definiciones de tools para Claude API
    executor.js         — ejecuta cada tool llamando al service correspondiente
    prompt.js           — construye el system prompt con contexto del negocio
  conversation/
    store.js            — load/save historial en PostgreSQL (JSONB)
db/
  migrations/
    002_conversaciones.sql  — tabla conversaciones
```

---

## Seguridad y control de costos

### 1. Rate limiting por número de teléfono
Máximo **5 mensajes por minuto** por número. Si se supera, el mensaje se
descarta silenciosamente (no se llama a Claude).

Implementado con un `Map` en memoria: `rateLimitStore = Map<phone, { count, windowStart }>`.
La ventana se resetea cada 60 segundos.

```js
function isRateLimited(phone) {
  const now = Date.now();
  const entry = rateLimitStore.get(phone) ?? { count: 0, windowStart: now };
  if (now - entry.windowStart > 60_000) {
    rateLimitStore.set(phone, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count++;
  return false;
}
```

### 2. Límite de longitud de input
Mensajes de más de **1.000 caracteres** se truncan antes de enviarse a Claude.
Protege contra payloads maliciosos que inflen el token count.

```js
const safeMessage = message.slice(0, 1000);
```

### 3. Límite de iteraciones en el tool use loop
Máximo **8 iteraciones** por turno. Si se alcanza, el agente responde con un
mensaje genérico de error y se corta el loop. Previene ciclos infinitos y
costos descontrolados por bugs en el agente.

```js
const MAX_ITERATIONS = 8;
let iterations = 0;

while (iterations < MAX_ITERATIONS) {
  iterations++;
  // ... loop
}
// Si se agota: return 'Ocurrió un error procesando tu mensaje. Intentá de nuevo.'
```

### 4. Límite de historial de conversación
Se mantienen solo los **últimos 10 mensajes** del historial. Evita que
conversaciones largas inflen el contexto y el costo de tokens.

```js
const MAX_HISTORY = 10;
const prunedHistory = history.slice(-MAX_HISTORY);
```

### 5. max_tokens acotado
La respuesta de Claude se limita a **512 tokens**. Los mensajes de WhatsApp
deben ser cortos. Si necesita más, es señal de que el prompt o el flujo
están mal diseñados.

### 6. Spending limit en Anthropic Dashboard
Configurar un límite de gasto mensual en https://console.anthropic.com.
Recomendado para MVP: **$10 USD/mes**. Con el volumen esperado (~100
conversaciones/negocio/mes a $0.009 por conversación), esto cubre ~11
negocios activos con margen de seguridad.

> **Acción manual requerida**: configurar el límite en el dashboard de
> Anthropic antes de poner el sistema en producción.

---

## Conversation Store

### Responsabilidad
Mantener el historial de mensajes de cada conversación para que Claude
recuerde el contexto (qué servicio quiere, qué día eligió, etc.).

### Almacenamiento: PostgreSQL (JSONB)

Se usa la misma base de datos existente. Sin Redis, sin dependencias extras.

**Tabla nueva — migración `002_conversaciones.sql`:**
```sql
CREATE TABLE IF NOT EXISTS conversaciones (
  id          SERIAL PRIMARY KEY,
  negocio_id  INTEGER NOT NULL REFERENCES negocios(id),
  telefono    VARCHAR(20) NOT NULL,
  messages    JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMP DEFAULT NOW(),
  CONSTRAINT conversaciones_negocio_telefono_unique UNIQUE (negocio_id, telefono)
);

CREATE INDEX IF NOT EXISTS idx_conversaciones_negocio ON conversaciones (negocio_id);
```

**Estructura de `messages` (JSONB):**
```json
[
  { "role": "user",      "content": "hola quiero un turno" },
  { "role": "assistant", "content": "Hola! ¿Qué servicio te interesa?" },
  { "role": "user",      "content": "corte de pelo" }
]
```

### Operaciones del store

```js
// load: devuelve el array de messages o [] si no existe
async function load(negocio_id, telefono) { ... }

// save: upsert — crea o actualiza la conversación
async function save(negocio_id, telefono, messages) { ... }
```

### TTL
Conversaciones sin actividad por más de **2 horas** quedan obsoletas.
Un job con `setInterval` cada 30 minutos limpia registros con
`updated_at < NOW() - INTERVAL '2 hours'`.

### Poda de historial
Antes de cada llamada a Claude se toman solo los últimos 10 mensajes
(`messages.slice(-MAX_HISTORY)`). La tabla guarda el historial completo
para auditoría futura.

---

## System Prompt

Se construye dinámicamente al inicio de cada request con datos del negocio.

```
Sos un asistente de agendamiento para {negocio.nombre}, un negocio de {negocio.rubro}.
Tu trabajo es ayudar a los clientes a reservar, consultar y cancelar turnos por WhatsApp.

SERVICIOS DISPONIBLES:
{lista de servicios con duración y precio}

REGLAS:
- Siempre saludá con el nombre del cliente en el primer mensaje.
- Confirmá los datos del turno (servicio, profesional, fecha, hora) antes de reservar.
- Si el cliente no especifica profesional, asigná automáticamente el primero disponible.
- Respondé siempre en español, de forma amigable y concisa.
- Si no podés ayudar con algo, decíselo claramente.
- No inventes disponibilidad — siempre consultá con las tools.
```

Los servicios se inyectan al construir el prompt (una llamada a
`Servicio.findAll({ where: { negocio_id } })` al inicio).

---

## Tool Use Loop

```js
const MAX_ITERATIONS = 8;
const MAX_HISTORY    = 10;
const MAX_INPUT_LEN  = 1000;

async function run({ negocio, from, senderName, message }) {
  // Protección 1: truncar input largo
  const safeMessage = message.slice(0, MAX_INPUT_LEN);

  const history = await store.load(negocio.id, from);
  history.push({ role: 'user', content: safeMessage });

  const systemPrompt = await buildSystemPrompt(negocio, senderName);

  // Protección 2: solo últimos 10 mensajes al contexto de Claude
  let messages = history.slice(-MAX_HISTORY);

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,                          // respuestas cortas para WhatsApp
      system:     systemPrompt,
      tools:      TOOLS,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const text = response.content.find(b => b.type === 'text')?.text ?? '';
      history.push({ role: 'assistant', content: text });
      await store.save(negocio.id, from, history);
      return text;
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });
      const toolResults = [];

      for (const block of response.content.filter(b => b.type === 'tool_use')) {
        const result = await executor.execute(block.name, block.input, negocio.id);
        toolResults.push({
          type:        'tool_result',
          tool_use_id: block.id,
          content:     JSON.stringify(result),
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }

  // Protección 3: si se agotaron las iteraciones, respuesta segura
  return 'Ocurrió un error procesando tu mensaje. Por favor intentá de nuevo.';
}
```

### Modelo
Se usa **claude-haiku-4-5** para minimizar latencia y costo en conversaciones
de WhatsApp. Si la calidad de respuesta fuera insuficiente, migrar a
claude-sonnet-4-6.

---

## Definición de Tools

Cada tool es una llamada directa a los services internos (mismo proceso,
sin HTTP). El `negocio_id` nunca lo pasa Claude — viene del contexto del
webhook.

### get_servicios
```json
{
  "name": "get_servicios",
  "description": "Lista los servicios disponibles del negocio con nombre, duración y precio. Llamar al inicio si el cliente no especificó servicio.",
  "input_schema": { "type": "object", "properties": {}, "required": [] }
}
```
→ `serviciosService.getAll(negocio_id)`

### get_disponibilidad
```json
{
  "name": "get_disponibilidad",
  "description": "Devuelve los horarios disponibles para un servicio en una fecha. Usar antes de reservar.",
  "input_schema": {
    "type": "object",
    "properties": {
      "fecha":         { "type": "string", "description": "Fecha en formato YYYY-MM-DD" },
      "servicio_id":   { "type": "integer", "description": "ID del servicio" },
      "profesional_id":{ "type": "integer", "description": "ID del profesional (opcional)" }
    },
    "required": ["fecha", "servicio_id"]
  }
}
```
→ `disponibilidadService.getSlots(negocio_id, { fecha, servicio_id, profesional_id })`

### identificar_cliente
```json
{
  "name": "identificar_cliente",
  "description": "Encuentra o crea el cliente por su número de teléfono. Llamar al inicio de toda conversación.",
  "input_schema": {
    "type": "object",
    "properties": {
      "telefono": { "type": "string" },
      "nombre":   { "type": "string" }
    },
    "required": ["telefono", "nombre"]
  }
}
```
→ `clientesService.identificar(negocio_id, { telefono, nombre })`

### crear_turno
```json
{
  "name": "crear_turno",
  "description": "Reserva un turno. Solo llamar después de que el cliente confirmó servicio, profesional, fecha y hora.",
  "input_schema": {
    "type": "object",
    "properties": {
      "cliente_id":     { "type": "integer" },
      "profesional_id": { "type": "integer" },
      "servicio_id":    { "type": "integer" },
      "fecha_hora":     { "type": "string", "description": "Formato: YYYY-MM-DDTHH:MM:00" }
    },
    "required": ["cliente_id", "profesional_id", "servicio_id", "fecha_hora"]
  }
}
```
→ `turnosService.create(negocio_id, { cliente_id, profesional_id, servicio_id, fecha_hora })`

### get_turnos_cliente
```json
{
  "name": "get_turnos_cliente",
  "description": "Lista los turnos activos del cliente.",
  "input_schema": {
    "type": "object",
    "properties": {
      "cliente_id": { "type": "integer" }
    },
    "required": ["cliente_id"]
  }
}
```
→ `turnosService.getAll(negocio_id, { cliente_id, estado: 'pendiente' })`

### cancelar_turno
```json
{
  "name": "cancelar_turno",
  "description": "Cancela un turno existente. Solo después de que el cliente confirmó que quiere cancelar.",
  "input_schema": {
    "type": "object",
    "properties": {
      "turno_id": { "type": "integer" }
    },
    "required": ["turno_id"]
  }
}
```
→ `turnosService.cancel(negocio_id, turno_id)`

### get_profesionales
```json
{
  "name": "get_profesionales",
  "description": "Lista los profesionales activos del negocio. Usar cuando el cliente pide un profesional específico por nombre.",
  "input_schema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```
→ `profesionalesService.getAll(negocio_id)`

---

## Flujo típico: reservar turno

```
Cliente: "hola quiero un corte"
  → identificar_cliente(telefono, nombre)
  → get_servicios()
Agente: "Hola Juan! Tenemos Corte $3500 (30min) o Corte+barba $5500 (60min). ¿Cuál preferís?"

Cliente: "el simple"
  → get_disponibilidad(fecha=mañana, servicio_id=1)
Agente: "Para mañana tengo disponible: 10:00, 11:00, 14:00. ¿Cuál te queda mejor?"

Cliente: "las 10"
Agente: "Te confirmo: Corte de pelo con María González mañana a las 10:00. ¿Reservamos?"

Cliente: "sí"
  → crear_turno(cliente_id, profesional_id, servicio_id, fecha_hora)
Agente: "✓ Turno reservado! Hasta mañana a las 10:00."
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
```

---

## Fuera de scope (MVP)
- Notificaciones proactivas (recordatorio 24hs antes)
- Mensajes de template (fuera de la ventana de 24hs)
- Soporte multiidioma
- Manejo de mensajes de media (imágenes, audio)

## Pendientes post-MVP
- **Control de costos por negocio**: registrar `input_tokens` y `output_tokens`
  de cada llamada a Claude (disponibles en `response.usage`) sumados por
  `negocio_id` en una tabla `uso_tokens`. Permite calcular el costo exacto
  por negocio por mes y definir el precio de venta con margen real.
  Implementar cuando haya 5+ negocios activos.
