# Spec — Módulo Turnos

**Prefijo:** `/api/turnos`
**Auth:** `X-Api-Key` header requerido (resuelve tenant)
**Estado:** Implementado

> `negocio_id` resuelto por middleware. No va en body ni URL.

---

## Descripción

Core del sistema. Permite crear, modificar y cancelar turnos con validaciones de disponibilidad, horario del profesional y solapamiento.

---

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/turnos | Listar turnos con filtros opcionales |
| GET | /api/turnos/:id | Obtener turno por ID |
| POST | /api/turnos | Crear turno |
| PUT | /api/turnos/:id | Modificar fecha/hora o estado |
| DELETE | /api/turnos/:id | Cancelar turno (soft delete) |

---

## GET /api/turnos — filtros por query string

| Parámetro | Tipo | Ejemplo |
|---|---|---|
| fecha | YYYY-MM-DD | ?fecha=2025-06-10 |
| profesional_id | integer | ?profesional_id=2 |
| estado | string | ?estado=pendiente |
| cliente_id | integer | ?cliente_id=1 |

---

## POST /api/turnos

```json
// Request
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

---

## PUT /api/turnos/:id

```json
// Request (todos los campos opcionales)
{ "fecha_hora": "2025-06-10T11:00:00", "estado": "confirmado" }

// Response 200: turno actualizado completo
// Response 404: { "error": "Turno no encontrado" }
// Response 409: { "error": "El profesional no tiene disponibilidad en ese horario" }
```

---

## DELETE /api/turnos/:id

```
Response 204: sin body (turno marcado como cancelado, no se borra)
Response 404: { "error": "Turno no encontrado" }
```

---

## Transiciones de estado válidas

```
pendiente  → confirmado
pendiente  → cancelado
confirmado → cancelado
cancelado  → (bloqueado)
```

---

## Reglas de negocio

1. **Obligatorios al crear:** `cliente_id`, `profesional_id`, `servicio_id`, `fecha_hora`.
2. **fecha_hora en el futuro:** No se pueden crear turnos en el pasado.
3. **Profesional activo:** El profesional debe tener `activo = true`.
4. **Dentro del horario:** `fecha_hora` debe caer dentro de un bloque de `profesional_horarios` para ese día.
5. **Sin solapamiento del profesional:** Error 409 si hay conflicto con otro turno activo.
6. **Sin solapamiento del cliente:** El cliente no puede tener otro turno activo en el mismo rango horario.
7. **Modificar turno:** Al cambiar `fecha_hora`, se revalidan las reglas 2, 3, 4, 5 y 6.
8. **No reabrir cancelado:** Un turno `cancelado` no puede cambiar de estado.
9. **Soft delete:** DELETE pone `estado = 'cancelado'`. Nunca se borran registros.
10. **Aislamiento:** `profesional_id` y `cliente_id` deben pertenecer al mismo negocio — de lo contrario 404.

---

## Errores esperados

| Código | Caso |
|---|---|
| 400 | Campos faltantes, fecha en el pasado, fuera del horario del profesional |
| 401 | API key inválida o negocio inactivo |
| 404 | Turno, cliente, profesional o servicio no encontrado (o de otro negocio) |
| 409 | Solapamiento de turno (profesional o cliente) |
| 422 | Transición de estado inválida |

---

## Fuera de scope (MVP)

- Notificaciones automáticas al crear/modificar turno
- Recordatorio 24hs antes
- Reasignación automática al cancelar
