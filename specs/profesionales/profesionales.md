# Spec — Módulo Profesionales

**Prefijo:** `/api/admin/profesionales`
**Auth:** `X-Api-Key` header requerido (resuelve tenant)
**Estado:** Implementado

> `negocio_id` resuelto por middleware. No va en body ni URL.

---

## Descripción

Gestión de profesionales del negocio y sus bloques de horario semanal. Cada profesional puede tener múltiples bloques por día (ej: mañana y tarde).

---

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/admin/profesionales | Listar todos con sus horarios |
| GET | /api/admin/profesionales/:id | Obtener uno con su horario |
| POST | /api/admin/profesionales | Crear profesional + horario inicial |
| PUT | /api/admin/profesionales/:id | Editar nombre o activar/desactivar |
| POST | /api/admin/profesionales/:id/horarios | Agregar un bloque de horario |
| PUT | /api/admin/profesionales/:id/horarios/:horario_id | Modificar un bloque |
| DELETE | /api/admin/profesionales/:id/horarios/:horario_id | Eliminar un bloque |

> Sin DELETE del profesional completo — nunca se borra, solo se desactiva.

---

## POST /api/admin/profesionales

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

> `dia_semana`: 0 = domingo ... 6 = sábado

---

## PUT /api/admin/profesionales/:id

```json
// Request (campos opcionales)
{ "nombre": "María G.", "activo": false }

// Si activo pasa a false → cancela todos los turnos futuros pendientes y confirmados
// Response 200: { id, nombre, activo, turnos_cancelados: 3 }
```

---

## POST /api/admin/profesionales/:id/horarios

```json
// Request
{ "dia_semana": 4, "hora_inicio": "10:00", "hora_fin": "13:00" }
// Response 201: bloque creado con su id
```

---

## DELETE /api/admin/profesionales/:id/horarios/:horario_id

```
Response 204: bloque eliminado
Response 404: bloque no encontrado
Response 409: existen turnos futuros en ese bloque horario
```

---

## Reglas de negocio

- **RN-1:** `horarios` no puede ser vacío al crear.
- **RN-2:** Dos bloques del mismo profesional no pueden solaparse en el mismo día.
- **RN-3:** Solo profesionales con `activo = true` pueden recibir nuevos turnos.
- **RN-4:** Al desactivar, todos los turnos futuros (`pendiente` o `confirmado`) se cancelan.
- **RN-5:** No se puede eliminar un bloque si existen turnos futuros en ese rango horario.
- **RN-6:** Un profesional solo es accesible desde el negocio al que pertenece.

---

## Fuera de scope (MVP)

- Ausencias puntuales / vacaciones
- Notificaciones WhatsApp al cancelar por desactivación
- Reasignación automática de turnos al desactivar
