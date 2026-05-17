# CLAUDE.md — Agenda SaaS multi-negocio

Documento de referencia para el agente. Leerlo completo antes de tocar cualquier archivo.

---

## 1. Qué es el sistema

**Backend REST multi-tenant** para gestionar agendas de turnos. Cada cliente del sistema es un "negocio" independiente (peluquería, técnico, médico, etc.) con sus propios profesionales, servicios y clientes.

**Consumidor principal:** una IA (Claude API) que recibe mensajes por WhatsApp, interpreta la intención del usuario y ejecuta acciones sobre este backend mediante Tool Use. El backend debe ser diseñado pensando en que quien lo consume es una IA, no un humano — los errores deben ser descriptivos, los endpoints predecibles, y las validaciones claras para que el modelo pueda corregir y reintentar.

**Ejemplos de negocios:**
- Peluquería "Don Pelo": 4 barberos, cada uno con su horario
- Juan el técnico de refrigeración: 1 profesional (él mismo), 1 servicio (visita técnica)

El MVP es solo el backend REST — sin WhatsApp ni IA todavía.

---

## 2. Stack y convenciones

- **Runtime:** Node.js + Express
- **Base de datos:** PostgreSQL
- **ORM:** Sequelize — toda interacción con la DB se hace a través de Modelos Sequelize, nunca con queries SQL en strings
- **Lenguaje:** JavaScript, CommonJS (`require`/`module.exports`), `'use strict'` en todos los archivos
- **Variables de entorno:** `dotenv`, nunca hardcodear credenciales
- **No usar:** TypeScript, ES Modules, Prisma, otros ORMs, frameworks adicionales sin consultar

### Estructura de Sequelize

```
src/
  config/sequelize.js     — instancia Sequelize (dialecto postgres, vars de entorno)
  models/
    index.js              — carga modelos y define todas las asociaciones
    Negocio.js            — tabla negocios
    Profesional.js        — tabla profesionales
    ProfesionalHorario.js — tabla profesional_horarios
    Cliente.js            — tabla clientes
    Servicio.js           — tabla servicios
    Turno.js              — tabla turnos
```

**Convenciones de modelos:**
- `timestamps: false` en todos (excepto donde existe `created_at`, usar `createdAt: 'created_at', updatedAt: false`)
- `tableName` siempre explícito para evitar pluralización automática de Sequelize
- Asociaciones definidas únicamente en `models/index.js`
- Para transacciones: `sequelize.transaction(async (t) => { ... })`
- Para condiciones complejas: usar `Op` de Sequelize (`Op.gt`, `Op.in`, `Op.lt`, etc.)

**Reglas de código:**
- Sin comentarios salvo que el WHY no sea obvio
- Sin manejo de errores para escenarios imposibles
- Validar solo en boundaries del sistema (input del usuario, APIs externas)
- No instalar dependencias sin avisar al usuario primero

---

## 3. Estructura de carpetas

```
src/
  config/sequelize.js   — Instancia Sequelize
  models/               — Modelos Sequelize
  routes/               — Solo ruteo: recibe req, llama al service, devuelve res
  services/             — Lógica de negocio
  middlewares/
    errorHandler.js     — Middleware global: captura errores y responde con { error: message }
    tenant.js           — Resuelve el negocio activo desde el header X-Api-Key
  app.js                — Setup de Express, monta rutas, exporta app
db/
  migrations/           — Scripts SQL numerados (001_init.sql, 002_xxx.sql...)
.env.example            — Template de variables de entorno
```

---

## 4. Modelo de datos

```
negocios
  id, nombre, rubro, api_key (UNIQUE NOT NULL), activo (bool), created_at

profesionales
  id, negocio_id (FK → negocios), nombre, activo (bool)

profesional_horarios
  id, profesional_id (FK), dia_semana (0-6), hora_inicio TIME, hora_fin TIME
  — dia_semana: 0=domingo ... 6=sábado
  — un profesional puede tener 0, 1 o 2 bloques por día (mañana y/o tarde)
  — horario estándar: 10:00-13:00 y 16:00-21:00

servicios
  id, negocio_id (FK → negocios), nombre, duracion_minutos, precio
  — cada negocio define los suyos

clientes
  id, negocio_id (FK → negocios), nombre, telefono, email, created_at
  — UNIQUE (negocio_id, telefono): el mismo número puede ser cliente de distintos negocios

turnos
  id, negocio_id (FK → negocios), cliente_id, profesional_id, servicio_id, fecha_hora, estado, created_at
  — estado: pendiente | confirmado | cancelado
  — negocio_id denormalizado para queries directas sin JOIN
```

---

## 5. Contexto de tenant (multi-tenancy)

**Todas las rutas operacionales requieren el header `X-Api-Key`.**

```
X-Api-Key: sk_donpelo_a3f9bc2e...
```

El middleware `tenant.js` intercepta el request, busca el negocio por `api_key` y lo adjunta a `req.negocio`. Si la key no existe o el negocio está inactivo, responde 401.

Todos los services filtran por `negocio_id: req.negocio.id`. El `negocio_id` **nunca** se envía en el body ni en la URL — siempre viene del middleware.

**Rutas que aplican tenant middleware:** todas salvo `/api/admin/negocios/*`

**Rutas admin de negocios:** sin auth en MVP (acceso local/interno).

---

## 6. Módulo Negocios — SPEC APROBADA

**Prefijo:** `/api/admin/negocios`
**Auth:** sin auth en MVP
**Estado:** APPROVED — pendiente implementar

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | /api/admin/negocios | Crear negocio + generar api_key |
| GET | /api/admin/negocios | Listar todos los negocios |
| GET | /api/admin/negocios/:id | Obtener un negocio |
| PUT | /api/admin/negocios/:id | Actualizar nombre, rubro o activo |

> Sin DELETE — nunca se borra, solo se desactiva vía `PUT { "activo": false }`.

### POST /api/admin/negocios

```json
// Request
{ "nombre": "Peluquería Don Pelo", "rubro": "peluquería" }

// Response 201
{
  "id": 1,
  "nombre": "Peluquería Don Pelo",
  "rubro": "peluquería",
  "api_key": "sk_d0np3l0_a3f9bc2e4d1f...",
  "activo": true,
  "created_at": "2026-05-15T12:00:00.000Z"
}
```

> La `api_key` se genera automáticamente con `crypto.randomBytes`. Es la clave que se configura en el agente de IA de ese negocio.

### PUT /api/admin/negocios/:id

```json
// Request (campos opcionales)
{ "nombre": "Don Pelo Barber", "activo": false }

// Response 200: negocio actualizado
// Response 404: { "error": "Negocio no encontrado" }
```

### Reglas de negocio

- **RN-1:** `nombre` y `rubro` son obligatorios al crear.
- **RN-2:** `api_key` se genera automáticamente — nunca la envía el cliente.
- **RN-3:** Un negocio con `activo: false` rechaza todos los requests con su api_key (el tenant middleware devuelve 401).

---

## 7. Módulo Turnos — SPEC APROBADA

> **Tenant:** `negocio_id` resuelto por middleware. No va en body ni URL.

**Prefijo:** `/api/turnos`
**Estado:** APPROVED — implementado (pendiente refactor multi-tenant)

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/turnos | Listar turnos con filtros opcionales |
| GET | /api/turnos/:id | Obtener turno por ID |
| POST | /api/turnos | Crear turno |
| PUT | /api/turnos/:id | Modificar fecha/hora o estado |
| DELETE | /api/turnos/:id | Cancelar turno (soft delete) |

### GET /api/turnos — filtros por query string

| Parámetro | Tipo | Ejemplo |
|---|---|---|
| fecha | YYYY-MM-DD | ?fecha=2025-06-10 |
| profesional_id | integer | ?profesional_id=2 |
| estado | string | ?estado=pendiente |
| cliente_id | integer | ?cliente_id=1 |

### POST /api/turnos

```json
// Request body
{
  "cliente_id": 1,
  "profesional_id": 2,
  "servicio_id": 1,
  "fecha_hora": "2025-06-10T10:00:00"
}

// Response 201
{
  "id": 5,
  "cliente_id": 1,
  "profesional_id": 2,
  "servicio_id": 1,
  "fecha_hora": "2025-06-10T10:00:00",
  "estado": "pendiente",
  "created_at": "2025-06-01T12:00:00.000Z"
}
```

### PUT /api/turnos/:id

```json
// Request body (todos los campos opcionales)
{ "fecha_hora": "2025-06-10T11:00:00", "estado": "confirmado" }

// Response 200: turno actualizado completo
// Response 404: { "error": "Turno no encontrado" }
// Response 409: { "error": "El profesional no tiene disponibilidad en ese horario" }
```

### DELETE /api/turnos/:id

```
Response 204: sin body (turno marcado como cancelado, no se borra)
Response 404: { "error": "Turno no encontrado" }
```

### Transiciones de estado válidas

```
pendiente  → confirmado
pendiente  → cancelado
confirmado → cancelado
cancelado  → (bloqueado)
```

### Reglas de negocio

1. **Obligatorios al crear:** `cliente_id`, `profesional_id`, `servicio_id`, `fecha_hora`.
2. **fecha_hora en el futuro:** No se pueden crear turnos en el pasado.
3. **Profesional activo:** El profesional debe tener `activo = true`.
4. **Dentro del horario:** `fecha_hora` debe caer dentro de un bloque de `profesional_horarios` para ese día. Error 400 si está fuera de horario.
5. **Sin solapamiento del profesional:** Error 409 si hay conflicto de horario con otro turno activo.
6. **Sin solapamiento del cliente:** El cliente no puede tener otro turno activo en el mismo rango horario. Error 409.
7. **Modificar turno:** Al cambiar `fecha_hora`, se revalidan las reglas 2, 3, 4, 5 y 6.
8. **No reabrir cancelado:** Un turno `cancelado` no puede cambiar de estado.
9. **Soft delete:** DELETE pone `estado = 'cancelado'`. Nunca se borran registros.
10. **Aislamiento:** `profesional_id` y `cliente_id` deben pertenecer al mismo negocio — de lo contrario 404.

### Errores esperados

| Código | Caso |
|---|---|
| 400 | Campos faltantes, fecha en el pasado, fuera del horario del profesional |
| 401 | API key inválida o negocio inactivo |
| 404 | Turno, cliente, profesional o servicio no encontrado (o de otro negocio) |
| 409 | Solapamiento de turno (profesional o cliente) |
| 422 | Transición de estado inválida |

---

## 8. Módulo Profesionales — SPEC APROBADA

> **Tenant:** `negocio_id` resuelto por middleware. No va en body ni URL.

**Prefijo:** `/api/admin/profesionales`
**Estado:** APPROVED — implementado (pendiente refactor multi-tenant)

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/admin/profesionales | Listar todos con sus horarios |
| GET | /api/admin/profesionales/:id | Obtener uno con su horario |
| POST | /api/admin/profesionales | Crear profesional + horario inicial |
| PUT | /api/admin/profesionales/:id | Editar nombre o activar/desactivar |
| POST | /api/admin/profesionales/:id/horarios | Agregar un bloque de horario |
| PUT | /api/admin/profesionales/:id/horarios/:horario_id | Modificar un bloque |
| DELETE | /api/admin/profesionales/:id/horarios/:horario_id | Eliminar un bloque |

> Sin DELETE del profesional completo — nunca se borra, solo se desactiva vía `PUT { "activo": false }`.

### POST /api/admin/profesionales

```json
// Request
{
  "nombre": "María González",
  "horarios": [
    { "dia_semana": 1, "hora_inicio": "10:00", "hora_fin": "13:00" },
    { "dia_semana": 1, "hora_inicio": "16:00", "hora_fin": "21:00" }
  ]
}
// Response 201: profesional completo con horarios
```

### PUT /api/admin/profesionales/:id

```json
// Request (campos opcionales)
{ "nombre": "María G.", "activo": false }
// Si activo pasa a false → cancela todos los turnos futuros
// Response 200: { id, nombre, activo, turnos_cancelados: 3 }
```

### POST /api/admin/profesionales/:id/horarios

```json
// Request
{ "dia_semana": 4, "hora_inicio": "10:00", "hora_fin": "13:00" }
// Response 201: bloque creado con su id
```

### DELETE /api/admin/profesionales/:id/horarios/:horario_id

```
Response 204: bloque eliminado
Response 404: bloque no encontrado
Response 409: existen turnos futuros en ese bloque horario
```

### Reglas de negocio

- **RN-1:** `horarios` no puede ser vacío al crear.
- **RN-2:** Dos bloques del mismo profesional no pueden solaparse en el mismo día.
- **RN-3:** Solo profesionales con `activo = true` pueden recibir nuevos turnos.
- **RN-4:** Al desactivar, todos los turnos futuros (`pendiente` o `confirmado`) se cancelan.
- **RN-5:** No se puede eliminar un bloque si existen turnos futuros en ese rango horario.
- **RN-6:** Un profesional solo es accesible desde el negocio al que pertenece.

### Fuera de scope (MVP)
- Ausencias puntuales / vacaciones
- Notificaciones WhatsApp al cancelar por desactivación
- Reasignación automática al desactivar un profesional

---

## 9. Módulo Clientes — SPEC APROBADA

> **Tenant:** `negocio_id` resuelto por middleware. No va en body ni URL.

**Prefijo:** `/api/clientes`
**Estado:** APPROVED — implementado (pendiente refactor multi-tenant)

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/clientes | Listar clientes del negocio |
| GET | /api/clientes/:id | Obtener por ID |
| POST | /api/clientes | Crear cliente |
| PUT | /api/clientes/:id | Actualizar datos |
| POST | /api/clientes/identificar | Find-or-create por teléfono (uso principal de la IA) |

### POST /api/clientes/identificar

Endpoint diseñado para ser llamado por la IA al inicio de cada conversación de WhatsApp.
Los datos vienen directamente del webhook: `wa_id` como `telefono`, `profile.name` como `nombre`.

```json
// Request
{ "telefono": "16505551234", "nombre": "Sheena Nelson" }

// Response 200 — cliente existente
{ "id": 3, "nombre": "Sheena Nelson", "telefono": "16505551234", "email": null, "created_at": "...", "es_nuevo": false }

// Response 201 — cliente nuevo
{ "id": 4, "nombre": "Sheena Nelson", "telefono": "16505551234", "email": null, "created_at": "...", "es_nuevo": true }
```

> `es_nuevo: true` permite a la IA personalizar el saludo para clientes nuevos vs. recurrentes.

### Reglas de negocio

- **RN-1:** `telefono` es único **por negocio** — un mismo número puede ser cliente de distintos negocios como registros independientes.
- **RN-2:** `telefono` y `nombre` son obligatorios al crear.
- **RN-3:** `/identificar` usa `(telefono, negocio_id)` como clave. Si existe, lo devuelve sin modificar el nombre. Si no, lo crea.
- **RN-4:** `/identificar` nunca sobreescribe el nombre — si el cliente fue renombrado manualmente, ese nombre prevalece.

### Fuera de scope (MVP)
- Historial de turnos embebido en la respuesta
- Bloqueo de clientes
- Campos adicionales (dirección, notas)

---

## 10. Módulo Disponibilidad — SPEC APROBADA

> **Tenant:** `negocio_id` resuelto por middleware. No va en body ni URL.

**Prefijo:** `/api/disponibilidad`
**Estado:** APPROVED — implementado (pendiente refactor multi-tenant)

### Endpoint

```
GET /api/disponibilidad?fecha=2026-05-19
GET /api/disponibilidad?fecha=2026-05-19&profesional_id=1
```

### Lógica de cálculo

1. Obtener bloques de horario del/los profesional/es activos del negocio para ese `dia_semana`
2. Generar slots cada 30 minutos dentro de cada bloque (último slot válido: `hora + 30 <= hora_fin del bloque`)
3. Eliminar slots que se solapan con turnos existentes (`pendiente` o `confirmado`)
4. Devolver solo los slots libres

### Response sin `profesional_id`

```json
{
  "fecha": "2026-05-19",
  "slots": [
    { "hora": "10:00", "profesionales": [{ "id": 1, "nombre": "María González" }, { "id": 2, "nombre": "Carlos López" }] },
    { "hora": "10:30", "profesionales": [{ "id": 2, "nombre": "Carlos López" }] }
  ]
}
```

> La IA toma `slots[X].profesionales[0]` para auto-asignar cuando el cliente no especificó profesional.

### Response con `profesional_id`

```json
{
  "fecha": "2026-05-19",
  "profesional": { "id": 1, "nombre": "María González" },
  "slots": ["10:00", "10:30", "11:00", "14:00", "14:30"]
}
```

### Reglas de negocio

- **RN-1:** `fecha` es obligatorio (formato YYYY-MM-DD) → 400 si falta.
- **RN-2:** `fecha` no puede ser en el pasado → 400.
- **RN-3:** Solo se incluyen profesionales con `activo = true` del negocio del tenant.
- **RN-4:** Un slot está ocupado si existe un turno activo que se solapa con `hora → hora + 30min`.
- **RN-5:** El último slot válido de un bloque es aquel cuyo fin no excede `hora_fin` del bloque.

### Flujos de la IA usando este endpoint

**Sin profesional especificado** ("quiero un turno el martes a la tarde"):
1. `GET /api/disponibilidad?fecha=2026-05-20` → filtra slots con hora >= 16:00
2. Toma `slots[0].profesionales[0]` → auto-asigna
3. `POST /api/turnos` → guarda sin preguntar

**Con profesional especificado** ("quiero con Jony el martes a la tarde"):
1. `GET /api/admin/profesionales` → busca "Jony" por nombre
2. `GET /api/disponibilidad?fecha=2026-05-20&profesional_id=2` → filtra hora >= 16:00
3. IA sugiere horarios al cliente y espera respuesta
4. `POST /api/turnos` → guarda con ese profesional

### Fuera de scope (MVP)
- Filtros por franja horaria en el endpoint
- Multi-servicio con duración variable (actualmente fijo en 30 min)

---

## 11. Módulo Servicios — SPEC APROBADA

> **Tenant:** `negocio_id` resuelto por middleware. No va en body ni URL.

**Prefijo público:** `/api/servicios`
**Prefijo admin:** `/api/admin/servicios`
**Estado:** APPROVED — pendiente implementar

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/servicios | Listar servicios del negocio |
| POST | /api/admin/servicios | Crear servicio |
| PUT | /api/admin/servicios/:id | Editar nombre, duración o precio |
| DELETE | /api/admin/servicios/:id | Eliminar servicio |

### GET /api/servicios

```json
// Response 200
[
  { "id": 1, "nombre": "Corte de pelo", "duracion_minutos": 30, "precio": "3500.00" },
  { "id": 2, "nombre": "Corte + barba", "duracion_minutos": 45, "precio": "5000.00" }
]
```

> La IA llama este endpoint para saber qué servicios puede ofrecer y sus duraciones.

### POST /api/admin/servicios

```json
// Request
{ "nombre": "Coloración", "duracion_minutos": 90, "precio": 12000 }

// Response 201
{ "id": 3, "nombre": "Coloración", "duracion_minutos": 90, "precio": "12000.00" }
```

### PUT /api/admin/servicios/:id

```json
// Request (campos opcionales)
{ "precio": 13500 }

// Response 200: servicio actualizado
// Response 404: { "error": "Servicio no encontrado" }
```

### DELETE /api/admin/servicios/:id

```
Response 204: servicio eliminado
Response 404: { "error": "Servicio no encontrado" }
Response 409: { "error": "Existen turnos asociados a este servicio" }
```

### Reglas de negocio

- **RN-1:** `nombre` y `duracion_minutos` son obligatorios al crear.
- **RN-2:** `precio` es opcional (puede ser null).
- **RN-3:** `duracion_minutos` debe ser un entero positivo múltiplo de 30.
- **RN-4:** No se puede eliminar un servicio si existen turnos `pendiente` o `confirmado` que lo referencian.
- **RN-5:** Cada negocio define sus propios servicios — no son compartidos entre negocios.

### Fuera de scope (MVP)
- Activar/desactivar servicio sin eliminarlo
- Precio variable según profesional

---

## 12. Metodología de trabajo

**SDD (Spec-Driven Development):**
1. Antes de implementar cualquier módulo, definir la spec juntos
2. El agente presenta la spec y espera confirmación explícita del usuario
3. Solo implementar después de aprobación
4. Un módulo a la vez, sin avanzar sin "ok, seguí"

---

## 13. Pendientes

### Backend MVP

| Módulo | Estado |
|---|---|
| Negocios | SPEC aprobada — pendiente implementar |
| Servicios | SPEC aprobada — pendiente implementar |
| Turnos | SPEC aprobada — implementado, pendiente refactor multi-tenant |
| Profesionales | SPEC aprobada — implementado, pendiente refactor multi-tenant |
| Clientes | SPEC aprobada — implementado, pendiente refactor multi-tenant |
| Disponibilidad | SPEC aprobada — implementado, pendiente refactor multi-tenant |

### Orden de implementación sugerido

1. **Migración schema** — agregar tabla `negocios`, agregar `negocio_id` a las 4 tablas existentes
2. **Modelo Negocio.js** + middleware `tenant.js`
3. **Módulo Negocios** (CRUD admin)
4. **Módulo Servicios**
5. **Refactor multi-tenant** de Turnos, Profesionales, Clientes, Disponibilidad

### Capa de IA — Tool Use (después del MVP backend)

El backend va a ser consumido por un agente de Claude API mediante **Tool Use**. Cada endpoint relevante se expone como una "tool" con su descripción en lenguaje natural. El contexto del negocio (rubro, servicios, horarios) se inyecta en el system prompt.

**Flujo para "quiero agendar un turno el martes con Jony por la tarde":**
1. Buscar profesional por nombre → `GET /api/admin/profesionales`
2. Consultar disponibilidad → `GET /api/disponibilidad?fecha=...&profesional_id=...`
3. Confirmar horario con el usuario
4. Identificar o crear el cliente por teléfono → `POST /api/clientes/identificar`
5. Crear el turno → `POST /api/turnos`

**Pendiente implementar:**
- [ ] Definir las tools de Claude API para cada endpoint
- [ ] System prompt con contexto del negocio (rubro, servicios, horarios)
- [ ] Integración con WhatsApp (Twilio o Meta API)
- [ ] Manejo de contexto de conversación (historial por número de teléfono)
- [ ] Notificaciones: recordatorio de turno 24hs antes

### Mejoras futuras (post-MVP)

- [ ] Autenticación en rutas `/api/admin/*`
- [ ] Panel web de administración por negocio
- [ ] Reasignación automática de turnos al desactivar un profesional
- [ ] Ausencias puntuales / vacaciones por profesional
- [ ] Testing con Jest (unitario + integración)
