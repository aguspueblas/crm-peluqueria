# CLAUDE.md — Agenda SaaS multi-negocio

Documento de convenciones generales del proyecto. Leerlo antes de tocar cualquier archivo.
Las especificaciones de cada módulo están en `/specs/`.

---

## 1. Qué es este proyecto

**Backend REST multi-tenant** para gestionar agendas de turnos vía WhatsApp. Cada cliente del sistema es un "negocio" independiente (peluquería, técnico de refrigeración, médico, etc.) con sus propios profesionales, servicios y clientes.

**Problema que resuelve:** pequeños emprendedores pierden clientes porque no tienen un sistema de turnos simple. Este sistema les da una agenda inteligente operada por WhatsApp, sin que el dueño tenga que hacer nada — la IA atiende, consulta disponibilidad y agenda sola.

**Consumidor principal:** un agente de Claude (Claude API, Tool Use) que recibe mensajes por WhatsApp, interpreta la intención del usuario y ejecuta acciones sobre este backend. El backend está diseñado pensando en que quien lo consume es una IA — los errores deben ser descriptivos, los endpoints predecibles, las validaciones claras para que el modelo pueda corregir y reintentar.

**Modelo de negocio:** el operador (dueño del SaaS) administra el acceso. Los negocios-cliente no tienen acceso directo al backend — toda interacción externa ocurre vía WhatsApp.

**Ejemplos de negocios:**
- Peluquería "Don Pelo": 4 barberos, cada uno con su horario
- Juan el técnico de refrigeración: 1 profesional (él mismo), 1 servicio (visita técnica)

---

## 2. MVP — Features implementadas

| Módulo | Estado |
|---|---|
| Negocios (CRUD + api_key + whatsapp_number) | Implementado |
| Profesionales (CRUD + horarios semanales) | Implementado |
| Servicios (CRUD + duración variable) | Implementado |
| Clientes (CRUD + find-or-create por teléfono) | Implementado |
| Turnos (CRUD + validaciones de disponibilidad) | Implementado |
| Disponibilidad (slots libres por fecha y servicio) | Implementado |
| Agente IA (Tool Use loop sobre el backend) | Implementado |
| Webhook WhatsApp — Twilio (adapter pattern) | Implementado |
| Historial de conversación en PostgreSQL (JSONB) | Implementado |

---

## 3. Próximos pasos

| Feature | Prioridad |
|---|---|
| Cargar créditos en Anthropic y probar agente real en Postman | Alta |
| Configurar cuenta Twilio + sandbox para pruebas reales de WhatsApp | Alta |
| Agregar costo de tokens por negocio (tracking de uso de la IA) | Media |
| Migrar a Meta WhatsApp Cloud API (~50-80 negocios activos) | Media |
| Panel web de administración por negocio | Baja |

---

## 4. Deuda técnica

| Item | Detalle |
|---|---|
| Tests | No hay tests automatizados. Priorizar integración sobre unitarios. |
| Notificaciones | No se notifica al cliente/profesional cuando se cancela un turno |
| Recordatorio de turno | No hay recordatorio 24hs antes |
| Reasignación automática | Al desactivar un profesional, los turnos se cancelan pero no se reasignan |
| Ausencias puntuales | No existe el concepto de día no laborable o vacaciones |
| Rate limiting del webhook | Rate limit en memoria — se pierde al reiniciar el proceso |

---

## 5. Stack y convenciones

- **Runtime:** Node.js + Express
- **Base de datos:** PostgreSQL
- **ORM:** Sequelize — toda interacción con la DB va a través de Modelos Sequelize, nunca SQL en strings (salvo queries de disponibilidad con `sequelize.query` donde es inevitable)
- **Lenguaje:** JavaScript, CommonJS (`require`/`module.exports`), `'use strict'` en todos los archivos
- **Variables de entorno:** `dotenv`, nunca hardcodear credenciales
- **No usar sin consultar:** TypeScript, ES Modules, Prisma, otros ORMs, frameworks adicionales

---

## 6. Estructura de carpetas

```
src/
  config/sequelize.js      — instancia Sequelize
  models/                  — modelos Sequelize + asociaciones en index.js
  routes/                  — solo ruteo: recibe req, llama al service, devuelve res
  services/                — lógica de negocio
  conversation/store.js    — historial de conversación (carga, guarda, limpia)
  agent/
    tools.js               — definición de tools para Claude API
    executor.js            — ejecuta cada tool llamando al service correspondiente
    prompt.js              — arma el system prompt con contexto del negocio
    runner.js              — loop de Tool Use: llama a Anthropic, ejecuta tools, itera
  webhook/
    index.js               — router Express del webhook
    handler.js             — lógica central: rate limit, lookup de negocio, llama al runner
    providers/twilio.js    — adaptador Twilio (parse, send, validate)
  middlewares/
    auth.js                — valida X-Admin-Secret
    tenant.js              — resuelve negocio por X-Api-Key
    errorHandler.js        — captura errores y responde { error: message }
  app.js                   — setup Express, monta rutas
db/
  migrations/              — scripts SQL numerados (001_init.sql, 002_...)
specs/                     — especificaciones por módulo (ver sección 12)
scripts/
  test-agent.js            — prueba del agente con mock de Anthropic (solo dev)
```

---

## 7. Convenciones de Sequelize

- `timestamps: false` en todos los modelos (o `updatedAt: 'updated_at'` donde aplique)
- `tableName` siempre explícito para evitar pluralización automática
- Asociaciones definidas únicamente en `models/index.js`
- Para transacciones: `sequelize.transaction(async (t) => { ... })`
- Para condiciones complejas: usar `Op` de Sequelize (`Op.gt`, `Op.in`, `Op.lt`, etc.)

---

## 8. Modelo de datos

```
negocios
  id, nombre, rubro, api_key (UNIQUE), whatsapp_number (UNIQUE, nullable), activo, created_at

profesionales
  id, negocio_id (FK), nombre, activo

profesional_horarios
  id, profesional_id (FK), dia_semana (0=dom...6=sáb), hora_inicio TIME, hora_fin TIME
  — un profesional puede tener múltiples bloques por día (mañana y/o tarde)

servicios
  id, negocio_id (FK), nombre, duracion_minutos, precio
  — duracion_minutos: entero positivo sin restricción de múltiplo

clientes
  id, negocio_id (FK), nombre, telefono, email, created_at
  — UNIQUE (negocio_id, telefono)

turnos
  id, negocio_id (FK), cliente_id, profesional_id, servicio_id, fecha_hora, estado, created_at
  — estado: pendiente | confirmado | cancelado

conversaciones
  id, negocio_id (FK), telefono, messages (JSONB), updated_at
  — UNIQUE (negocio_id, telefono)
  — se limpia automáticamente después de 2hs de inactividad
```

---

## 9. Autenticación y tenant

### ADMIN_SECRET — rutas de admin de negocios

El header `X-Admin-Secret` valida al operador del sistema en `/api/admin/negocios/*`.

### X-Api-Key — rutas REST del backend

El header `X-Api-Key` identifica al negocio en todas las demás rutas REST. El middleware `tenant.js` resuelve el `negocio_id` y lo adjunta a `req.negocio`.

### Webhook — sin headers de auth

El webhook identifica al negocio por `whatsapp_number` (campo `to` del mensaje entrante). No pasa por `tenant.js` — hace un lookup directo a Sequelize. El `ADMIN_SECRET` y la `api_key` nunca aparecen en el contexto del agente de IA.

---

## 10. Manejo de errores

Todos los errores pasan por `middlewares/errorHandler.js` que responde:

```json
{ "error": "mensaje descriptivo" }
```

Los services lanzan errores con `statusCode` para que el handler los mapee correctamente. Los errores deben ser lo suficientemente descriptivos para que el agente de IA pueda entender qué falló y reintentar.

---

## 11. Metodología de trabajo (SDD)

1. Antes de implementar cualquier módulo nuevo, definir la spec en `/specs/{modulo}/{modulo}.md`
2. El agente presenta la spec y espera confirmación explícita antes de implementar
3. Un módulo a la vez, sin avanzar sin "ok, seguí"
4. No instalar dependencias sin avisar cuáles y para qué

---

## 12. Specs por módulo

| Módulo | Archivo |
|---|---|
| Negocios | [specs/negocios/negocios.md](specs/negocios/negocios.md) |
| Profesionales | [specs/profesionales/profesionales.md](specs/profesionales/profesionales.md) |
| Servicios | [specs/servicios/servicios.md](specs/servicios/servicios.md) |
| Clientes | [specs/clientes/clientes.md](specs/clientes/clientes.md) |
| Turnos | [specs/turnos/turnos.md](specs/turnos/turnos.md) |
| Disponibilidad | [specs/disponibilidad/disponibilidad.md](specs/disponibilidad/disponibilidad.md) |
| Agente IA | [specs/ia/agent.md](specs/ia/agent.md) |
| Webhook WhatsApp | [specs/whatsapp/webhook.md](specs/whatsapp/webhook.md) |
