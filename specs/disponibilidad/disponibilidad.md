# Spec — Módulo Disponibilidad

**Prefijo:** `/api/disponibilidad`
**Auth:** `X-Api-Key` header requerido (resuelve tenant)
**Estado:** Implementado

> `negocio_id` resuelto por middleware. No va en body ni URL.

---

## Descripción

Calcula los slots horarios disponibles para una fecha y servicio dados. La duración del slot es variable según el servicio consultado. Es el endpoint más usado por la IA para sugerir horarios al cliente.

---

## Endpoint

```
GET /api/disponibilidad?fecha=2026-05-19&servicio_id=1
GET /api/disponibilidad?fecha=2026-05-19&servicio_id=1&profesional_id=1
```

---

## Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| fecha | YYYY-MM-DD | Sí | Fecha a consultar |
| servicio_id | integer | Sí | Define la duración del slot |
| profesional_id | integer | No | Filtra a un profesional específico |

---

## Lógica de cálculo

1. Obtener `duracion_minutos` del servicio solicitado
2. Obtener bloques de horario del/los profesionales activos para ese `dia_semana`
3. Generar slots de `duracion_minutos` dentro de cada bloque
4. Eliminar slots que se solapan con turnos existentes (`pendiente` o `confirmado`)
5. Devolver solo los slots libres

> El último slot válido de un bloque es aquel cuyo fin no excede `hora_fin` del bloque.

---

## Response sin `profesional_id`

```json
{
  "fecha": "2026-05-19",
  "servicio": { "id": 1, "nombre": "Corte de pelo", "duracion_minutos": 30 },
  "slots": [
    { "hora": "10:00", "profesionales": [{ "id": 1, "nombre": "María González" }, { "id": 2, "nombre": "Carlos López" }] },
    { "hora": "10:30", "profesionales": [{ "id": 2, "nombre": "Carlos López" }] }
  ]
}
```

> La IA toma `slots[X].profesionales[0]` para auto-asignar cuando el cliente no especificó profesional.

---

## Response con `profesional_id`

```json
{
  "fecha": "2026-05-19",
  "servicio": { "id": 1, "nombre": "Corte de pelo", "duracion_minutos": 30 },
  "profesional": { "id": 1, "nombre": "María González" },
  "slots": ["10:00", "10:30", "11:00", "14:00", "14:30"]
}
```

---

## Reglas de negocio

- **RN-1:** `fecha` y `servicio_id` son obligatorios → 400 si falta alguno.
- **RN-2:** `fecha` no puede ser en el pasado → 400.
- **RN-3:** Solo se incluyen profesionales con `activo = true` del negocio del tenant.
- **RN-4:** Un slot está ocupado si existe un turno activo que se solapa con `hora → hora + duracion_minutos`.
- **RN-5:** El último slot válido: su fin no puede exceder `hora_fin` del bloque.
- **RN-6:** `servicio_id` debe pertenecer al negocio del tenant → 404 si no existe.

---

## Flujos de la IA usando este endpoint

**Sin profesional especificado** ("quiero un corte el martes a la tarde"):
1. `GET /api/servicios` → identifica servicio → `servicio_id`
2. `GET /api/disponibilidad?fecha=...&servicio_id=1` → filtra slots >= 16:00
3. Toma `slots[0].profesionales[0]` → auto-asigna
4. `POST /api/turnos`

**Con profesional especificado** ("quiero con Jony el martes a la tarde"):
1. `GET /api/servicios` → identifica servicio
2. `GET /api/admin/profesionales` → busca "Jony" → `profesional_id`
3. `GET /api/disponibilidad?fecha=...&servicio_id=1&profesional_id=2`
4. IA sugiere horarios y espera respuesta
5. `POST /api/turnos`

---

## Fuera de scope (MVP)

- Filtros por franja horaria en el endpoint
- Disponibilidad multi-día

---

> **Nota de deuda técnica:** esta spec usa nomenclatura en español (`fecha`, `servicio_id`, etc.) que ya no coincide con el código refactorizado a inglés. Los nombres reales en el código son `date`, `serviceId`, `professionalId`. La migración de esta spec queda pendiente.
