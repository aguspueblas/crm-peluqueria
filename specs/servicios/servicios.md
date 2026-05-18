# Spec — Módulo Servicios

**Prefijo público:** `/api/servicios`
**Prefijo admin:** `/api/admin/servicios`
**Auth:** `X-Api-Key` header requerido (resuelve tenant)
**Estado:** Implementado

> `negocio_id` resuelto por middleware. No va en body ni URL.

---

## Descripción

Cada negocio define sus propios servicios con nombre, duración y precio. La duración es variable — una peluquería puede tener cortes de 30 minutos y un técnico instalaciones de 120 minutos. La IA consulta este endpoint al inicio de la conversación para saber qué puede ofrecer.

---

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/servicios | Listar servicios del negocio |
| POST | /api/admin/servicios | Crear servicio |
| PUT | /api/admin/servicios/:id | Editar nombre, duración o precio |
| DELETE | /api/admin/servicios/:id | Eliminar servicio |

---

## GET /api/servicios

```json
// Response 200
[
  { "id": 1, "nombre": "Corte de pelo", "duracion_minutos": 30, "precio": "3500.00" },
  { "id": 2, "nombre": "Instalación de aire acondicionado", "duracion_minutos": 120, "precio": "25000.00" }
]
```

---

## POST /api/admin/servicios

```json
// Request
{ "nombre": "Coloración", "duracion_minutos": 90, "precio": 12000 }

// Response 201
{ "id": 3, "nombre": "Coloración", "duracion_minutos": 90, "precio": "12000.00" }
```

---

## PUT /api/admin/servicios/:id

```json
// Request (campos opcionales)
{ "precio": 13500 }

// Response 200: servicio actualizado
// Response 404: { "error": "Service not found" }
```

---

## DELETE /api/admin/servicios/:id

```
Response 204: servicio eliminado
Response 404: { "error": "Service not found" }
Response 409: { "error": "Service has active appointments" }
```

---

## Reglas de negocio

- **RN-1:** `nombre` y `duracion_minutos` son obligatorios al crear.
- **RN-2:** `precio` es opcional (puede ser null).
- **RN-3:** `duracion_minutos` debe ser un entero positivo mayor a 0. Sin restricción de múltiplo.
- **RN-4:** No se puede eliminar un servicio con turnos `pendiente` o `confirmado` → 409.
- **RN-5:** Un servicio solo es accesible desde el negocio al que pertenece → 404 si no existe en el tenant actual.

---

## Fuera de scope (MVP)

- Activar/desactivar servicio sin eliminarlo
- Precio variable según profesional
