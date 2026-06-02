# Spec — get_next_slots (Disponibilidad multi-día)

**Módulo:** Disponibilidad
**Estado:** Implementado — commit `5678129` (2026-06-01)
**Relacionado con:** [disponibilidad.md](disponibilidad.md), [../ia/agent.md](../ia/agent.md)

> Esta spec usa nomenclatura en inglés, alineada con el código refactorizado (ver commit `0cc54b2`).
> `businessId` se resuelve por middleware (`X-Api-Key`). No va en body ni URL.

---

## Problema que resuelve

El endpoint `GET /api/availability` requiere una fecha específica. Esto fuerza al agente a
preguntarle al cliente "¿qué día te queda bien?" antes de poder consultar disponibilidad.
Si el día elegido no tiene slots, el agente queda sin opciones y la experiencia se rompe.

`get_next_slots` resuelve esto: el agente consulta directamente los próximos N turnos libres
sin conocer la fecha de antemano, y le ofrece opciones reales al cliente desde el primer mensaje.

---

## Descripción

Devuelve los próximos `count` slots libres a partir de hoy (hora Argentina), iterando
días consecutivos hasta encontrarlos o alcanzar el límite de `MAX_DAYS_AHEAD = 60`.

La búsqueda usa **3 queries a la DB** independientemente de cuántos días itera:
el servicio, los profesionales con sus horarios, y los turnos reservados en el rango de fechas.
El loop y el cálculo de slots ocurren en memoria.

---

## REST Endpoint

```
GET /api/availability/next?serviceId=1&count=3
GET /api/availability/next?serviceId=1&count=3&professionalId=2
```

**Auth:** `X-Api-Key` header requerido.

---

## Parámetros

| Parámetro      | Tipo    | Requerido | Default | Descripción |
|----------------|---------|-----------|---------|-------------|
| serviceId      | integer | Sí        | —       | Define la duración del slot |
| count          | integer | No        | 3       | Cantidad de slots a devolver (máx: 10) |
| professionalId | integer | No        | —       | Filtra a un profesional específico |

---

## Lógica de cálculo

```
1. Obtener el servicio (duracion_minutos) — valida que pertenece al negocio
2. Obtener todos los profesionales activos con todos sus horarios
   (si professionalId → filtrar solo ese)
3. Calcular rango: desde=hoy_argentina hasta desde+MAX_DAYS_AHEAD
4. Query única: turnos reservados (pendiente | confirmado) en ese rango
5. Loop día a día desde hoy:
   a. Filtrar profesionales que trabajan ese weekday (tienen horario)
   b. Para cada profesional: generateSlots(startTime, endTime, durationMinutes)
   c. Para cada slot: isBooked() contra turnos del rango ya cargados
   d. Si date === hoy_argentina: descartar slots cuya hora ya pasó
   e. Acumular resultados { date, time, professional }
6. Cortar cuando results.length === count o días iterados === MAX_DAYS_AHEAD
7. Devolver results (puede ser [] si no hay disponibilidad en el rango)
```

### Cómo se calcula "hoy en Argentina"

```js
// Argentina es UTC-3 sin DST
const nowArgentina = new Date(Date.now() - 3 * 60 * 60 * 1000);
const todayArg     = nowArgentina.toISOString().slice(0, 10); // 'YYYY-MM-DD'
const nowTimeArg   = nowArgentina.toISOString().slice(11, 16); // 'HH:MM'
```

Esto es consistente con el `INTERVAL '3 hours'` usado en el SQL de `getSlots()`.

---

## Response — 200 OK

Lista de slots individuales ordenados cronológicamente.

```json
[
  { "date": "2026-06-03", "time": "09:00", "professional": { "id": 1, "name": "Juan García" } },
  { "date": "2026-06-03", "time": "10:00", "professional": { "id": 2, "name": "María López" } },
  { "date": "2026-06-04", "time": "09:30", "professional": { "id": 1, "name": "Juan García" } }
]
```

**Lista vacía si no hay disponibilidad en los próximos 60 días:**
```json
[]
```

---

## Reglas de negocio

| # | Regla |
|---|-------|
| RN-1 | `serviceId` es obligatorio → 400 si falta |
| RN-2 | `serviceId` debe pertenecer al negocio del tenant → 404 si no existe |
| RN-3 | `count` debe ser entre 1 y 10. Fuera del rango → 400 |
| RN-4 | Solo se incluyen profesionales con `active = true` |
| RN-5 | Si `professionalId` no pertenece al negocio → 404 |
| RN-6 | Un slot está ocupado si se solapa con un turno `pendiente` o `confirmado` (misma lógica que `getSlots`) |
| RN-7 | Si `date === hoy_argentina`, se descartan slots cuya hora ya pasó |
| RN-8 | Si se alcanza `MAX_DAYS_AHEAD = 60` sin encontrar `count` slots, se devuelve lo que haya (incluso `[]`). No es un error |

---

## Errores esperados

| Código | Caso |
|--------|------|
| 400 | `serviceId` faltante |
| 400 | `count` fuera del rango 1-10 |
| 401 | API key inválida o negocio inactivo |
| 404 | `serviceId` no pertenece al negocio |
| 404 | `professionalId` no pertenece al negocio |

---

## Tool del agente IA

Además del endpoint REST, se expone como tool de Claude.

### Definición

```js
{
  name: 'get_next_slots',
  description: `DEFAULT tool to find availability.
Returns the next N available time slots without needing a specific date.
ALWAYS call this first when the client wants to book and hasn't named a date.
Use get_availability ONLY if the client explicitly said a specific date (e.g. "I want Thursday").`,
  input_schema: {
    type: 'object',
    properties: {
      serviceId:      { type: 'integer', description: 'Service ID' },
      count:          { type: 'integer', description: 'Number of slots to return (default: 3)' },
      professionalId: { type: 'integer', description: 'Professional ID (optional)' },
    },
    required: ['serviceId'],
  },
}
```

### Actualización requerida en `get_availability`

La descripción de `get_availability` debe aclarar su rol secundario:

```js
description: 'Return available time slots for a service on a SPECIFIC date named by the client.
Use ONLY when the client explicitly said a date. For open-ended availability, use get_next_slots instead.'
```

### Ejecución en `executor.js`

```js
case 'get_next_slots':
  return await availabilityService.getNextSlots(businessId, {
    serviceId:      input.serviceId,
    count:          input.count ?? 3,
    professionalId: input.professionalId ?? null,
  });
```

---

## Flujo del agente usando esta tool

```
Cliente: "quiero sacar un turno"
    ↓
Agente llama: get_next_slots({ serviceId: X, count: 3 })
    ↓
Resultado: [
  { date: "2026-06-03", time: "09:00", professional: { id: 1, name: "Juan" } },
  { date: "2026-06-03", time: "10:30", professional: { id: 2, name: "María" } },
  { date: "2026-06-04", time: "14:00", professional: { id: 1, name: "Juan" } }
]
    ↓
Agente responde: "Tenés disponibilidad el martes 3 a las 9:00 con Juan,
  a las 10:30 con María, o el miércoles 4 a las 14:00 con Juan. ¿Cuál te viene bien?"
    ↓
Cliente elige → Agente llama create_appointment()
```

**Caso sin disponibilidad:**
```
Resultado: []
    ↓
Agente responde: "No encontré turnos disponibles en los próximos 60 días.
  Te recomiendo contactar directamente al negocio."
    ↓
Agente llama notify_admin({ reason: "Cliente sin disponibilidad en los próximos 60 días" })
```

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/services/availability.service.js` | Nueva función `getNextSlots()` |
| `src/agent/tools.js` | Agregar `get_next_slots`, actualizar descripción de `get_availability` |
| `src/agent/executor.js` | Agregar case `get_next_slots` |
| `src/routes/availability.js` | Agregar ruta `GET /next` |

---

## Fuera de scope

- Agrupar slots por día en la respuesta (siempre son slots individuales)
- `count` mayor a 10
- Configurar `MAX_DAYS_AHEAD` por negocio
- Cachear resultados entre llamadas
- Notificación automática al admin si `[]` (el agente lo hace con `notify_admin`)
- Filtros por franja horaria (mañana / tarde)
