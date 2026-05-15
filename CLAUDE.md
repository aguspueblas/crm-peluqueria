# CLAUDE.md — CRM Peluquería

Documento de referencia para el agente. Leerlo completo antes de tocar cualquier archivo.

---

## 1. Qué es el sistema

Backend REST para peluquerías que gestiona la agenda de turnos de múltiples peluqueros.

**Consumidor principal:** una IA (Claude API) que recibe mensajes por WhatsApp, interpreta la intención del usuario y ejecuta acciones sobre este backend mediante Tool Use. El backend debe ser diseñado pensando en que quien lo consume es una IA, no un humano — los errores deben ser descriptivos, los endpoints predecibles, y las validaciones claras para que el modelo pueda corregir y reintentar.

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
  config/sequelize.js   — instancia Sequelize (dialecto postgres, vars de entorno)
  models/
    index.js            — carga modelos y define todas las asociaciones
    Profesional.js      — tabla profesionales
    ProfesionalHorario.js — tabla profesional_horarios
    Cliente.js          — tabla clientes
    Servicio.js         — tabla servicios
    Turno.js            — tabla turnos
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
  config/db.js          — Pool de conexión PostgreSQL (Pool de pg)
  routes/               — Solo ruteo: recibe req, llama al service, devuelve res
  services/             — Lógica de negocio y queries SQL
  middlewares/
    errorHandler.js     — Middleware global: captura errores y responde con { error: message }
  app.js                — Setup de Express, monta rutas, exporta app
db/
  migrations/           — Scripts SQL numerados (001_init.sql, 002_xxx.sql...)
.env.example            — Template de variables de entorno
```

---

## 4. Modelo de datos

```
clientes
  id, nombre, telefono (UNIQUE), email, created_at

profesionales
  id, nombre, activo (bool)

profesional_horarios                     ← horario semanal por bloques
  id, profesional_id, dia_semana (0-6), hora_inicio TIME, hora_fin TIME
  — dia_semana: 0=domingo ... 6=sábado
  — un profesional puede tener 0, 1 o 2 bloques por día (mañana y/o tarde)
  — horario estándar: 10:00-13:00 y 16:00-21:00

servicios
  id, nombre, duracion_minutos, precio
  — todos los profesionales ofrecen todos los servicios
  — ejemplo: Corte de pelo = 30 min

turnos
  id, cliente_id, profesional_id, servicio_id, fecha_hora, estado, created_at
  — estado: pendiente | confirmado | cancelado
```

---

## 5. Módulo Turnos — SPEC APROBADA

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
{
  "fecha_hora": "2025-06-10T11:00:00",
  "estado": "confirmado"
}

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

1. **Validación de campos obligatorios:** `cliente_id`, `profesional_id`, `servicio_id`, `fecha_hora` son requeridos al crear.

2. **fecha_hora en el futuro:** No se pueden crear turnos en el pasado.

3. **Profesional activo:** El profesional debe tener `activo = true`.

4. **Dentro del horario:** `fecha_hora` debe caer dentro de un bloque de `profesional_horarios` para ese día de la semana. Error 400 si está fuera de horario.

5. **Sin solapamiento del profesional:** Desde `fecha_hora` hasta `fecha_hora + duracion_minutos del servicio`, el profesional no puede tener otro turno con estado `pendiente` o `confirmado`. Error 409 si hay conflicto.

6. **Sin solapamiento del cliente:** El cliente no puede tener otro turno activo en el mismo rango horario, independientemente del profesional. Error 409 si hay conflicto.

7. **Modificar turno:** Al cambiar `fecha_hora`, se revalidan las reglas 2, 3, 4, 5 y 6.

8. **No se puede reabrir un turno cancelado:** Un turno `cancelado` no puede cambiar de estado.

9. **Soft delete:** DELETE pone `estado = 'cancelado'`. Nunca se borran registros.

### Errores esperados

| Código | Caso |
|---|---|
| 400 | Campos faltantes, fecha en el pasado, fuera del horario del profesional |
| 404 | Turno, cliente, profesional o servicio no encontrado |
| 409 | Solapamiento de turno (profesional o cliente) |
| 422 | Transición de estado inválida |

---

## 6. Módulo Profesionales — SPEC APROBADA

**Prefijo:** `/api/admin/profesionales`
**Estado:** APPROVED — implementado

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
    { "dia_semana": 1, "hora_inicio": "14:00", "hora_fin": "20:00" }
  ]
}
// Response 201: profesional completo con horarios
```

### PUT /api/admin/profesionales/:id

```json
// Request (campos opcionales)
{ "nombre": "María G.", "activo": false }
// Si activo pasa a false → cancela turnos futuros
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

### Invariantes
- Un profesional nunca se borra físicamente.
- Los bloques de horario de un mismo profesional no se solapan.

### Fuera de scope (MVP)
- Ausencias puntuales / vacaciones
- Fotos o avatares
- Notificaciones WhatsApp al cancelar por desactivación
- **Próxima iteración:** al desactivar un profesional, reasignar sus turnos futuros automáticamente a otro profesional con disponibilidad en ese horario.

---

## 7. Metodología de trabajo

**SDD (Spec-Driven Development):**
1. Antes de implementar cualquier módulo, definir la spec juntos
2. El agente presenta la spec y espera confirmación explícita del usuario
3. Solo implementar después de aprobación
4. Un módulo a la vez, sin avanzar sin "ok, seguí"

---

## 8. Pendientes

### Backend MVP (próximas sesiones)

| Módulo | Estado | Notas |
|---|---|---|
| Clientes | SPEC pendiente | CRUD básico, identificación por teléfono (clave para WhatsApp) |
| Disponibilidad | SPEC pendiente | Endpoint más crítico para la IA — devuelve slots libres calculados |
| Servicios | Sin spec | Lectura de los servicios disponibles (GET), sin ABM por ahora |

### Capa de IA — Tool Use (después del MVP backend)

El backend va a ser consumido por un agente de Claude API mediante **Tool Use**. Cada endpoint relevante se expone como una "tool" con su descripción en lenguaje natural. El modelo decide qué tool llamar, con qué parámetros, y en qué orden, basándose en el mensaje del usuario.

**Flujo para "quiero agendar un turno el martes con Jony por la tarde":**
1. Buscar profesional por nombre → `GET /api/admin/profesionales`
2. Consultar disponibilidad → `GET /api/disponibilidad?fecha=...&profesional_id=...`
3. Confirmar horario con el usuario
4. Identificar o crear el cliente por teléfono → `GET /api/clientes?telefono=...`
5. Crear el turno → `POST /api/turnos`

**Principios de diseño pensados para la IA:**
- Los errores son descriptivos (`"El profesional no atiende en ese horario"`) para que el modelo pueda corregir y reintentar sin intervención humana
- El endpoint de disponibilidad devuelve slots ya calculados — la IA no necesita hacer aritmética de horarios
- Las validaciones están en el backend, no en el agente — el agente confía en los 400/409 para entender qué salió mal

**Pendiente implementar:**
- [ ] Definir las tools de Claude API para cada endpoint
- [ ] System prompt con reglas de negocio en lenguaje natural
- [ ] Integración con WhatsApp (Twilio o Meta API)
- [ ] Manejo de contexto de conversación (historial por número de teléfono)
- [ ] Notificaciones: recordatorio de turno 24hs antes

### Mejoras futuras (post-MVP)

- [ ] Autenticación en rutas `/api/admin/*`
- [ ] Reasignación automática de turnos al desactivar un profesional
- [ ] Ausencias puntuales / vacaciones por profesional
- [ ] Testing con Jest (unitario + integración)
- [ ] Panel web de administración
