# CLAUDE.md — CRM Peluquería

Documento de referencia para el agente. Leerlo completo antes de tocar cualquier archivo.

---

## 1. Qué es el sistema

Backend REST para peluquerías que gestiona la agenda de turnos de múltiples peluqueros.
Los clientes interactúan por WhatsApp; una IA (Claude API) interpreta los mensajes y ejecuta acciones sobre este backend. El MVP es solo el backend — sin WhatsApp ni IA todavía.

---

## 2. Stack y convenciones

- **Runtime:** Node.js + Express
- **Base de datos:** PostgreSQL (driver: `pg`, pool de conexiones)
- **Lenguaje:** JavaScript, CommonJS (`require`/`module.exports`), `'use strict'` en todos los archivos
- **Variables de entorno:** `dotenv`, nunca hardcodear credenciales
- **No usar:** TypeScript, ES Modules, ORMs (Sequelize, Prisma), frameworks adicionales sin consultar

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
  — estado: pendiente | confirmado | cancelado | completado
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
confirmado → completado
confirmado → cancelado
completado → (bloqueado)
cancelado  → (bloqueado)
```

### Reglas de negocio

1. **Validación de campos obligatorios:** `cliente_id`, `profesional_id`, `servicio_id`, `fecha_hora` son requeridos al crear.

2. **fecha_hora en el futuro:** No se pueden crear turnos en el pasado.

3. **Profesional activo:** El profesional debe tener `activo = true`.

4. **Dentro del horario:** `fecha_hora` debe caer dentro de un bloque de `profesional_horarios` para ese día de la semana. Error 400 si está fuera de horario.

5. **Sin solapamiento del profesional:** Desde `fecha_hora` hasta `fecha_hora + duracion_minutos del servicio`, el profesional no puede tener otro turno con estado `pendiente` o `confirmado`. Error 409 si hay conflicto.

6. **Sin solapamiento del cliente:** El cliente no puede tener otro turno activo en el mismo rango horario. Error 409 si hay conflicto.

7. **Modificar turno:** Al cambiar `fecha_hora`, se revalidan las reglas 2, 3, 4, 5 y 6.

8. **No se pueden reabrir:** Un turno `cancelado` o `completado` no puede cambiar de estado.

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

## 7. Qué viene después del MVP

- Módulo Clientes (SPEC pendiente)
- Módulo Disponibilidad (SPEC pendiente)
- Módulo Profesionales (SPEC aprobada e implementada)
- Integración WhatsApp (Twilio o Meta API)
- Capa de IA con Claude API para interpretar mensajes
- Testing con Jest
