# Spec — Módulo Negocios

**Prefijo:** `/api/admin/negocios`
**Auth:** `X-Admin-Secret` header requerido en todos los endpoints
**Estado:** Implementado

---

## Descripción

Gestión de negocios del sistema. El operador (dueño del SaaS) es el único que puede crear y administrar negocios. Cada negocio tiene una `api_key` para identificarse en las rutas REST y un `whatsapp_number` para recibir mensajes vía webhook.

---

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | /api/admin/negocios | Crear negocio |
| GET | /api/admin/negocios | Listar todos |
| GET | /api/admin/negocios/:id | Obtener uno |
| PUT | /api/admin/negocios/:id | Actualizar nombre, rubro, whatsapp_number o activo |

> Sin DELETE — nunca se borra, solo se desactiva vía `PUT { "activo": false }`.

---

## POST /api/admin/negocios

```json
// Request
{ "nombre": "Peluquería Don Pelo", "rubro": "peluquería", "whatsapp_number": "5491187654321" }

// Response 201
{
  "id": 1,
  "nombre": "Peluquería Don Pelo",
  "rubro": "peluquería",
  "whatsapp_number": "5491187654321",
  "api_key": "sk_...",
  "activo": true,
  "created_at": "2026-05-15T12:00:00.000Z"
}
```

> La `api_key` se devuelve **solo en la creación** — debe guardarse. El webhook usa `whatsapp_number` en su lugar.

---

## PUT /api/admin/negocios/:id

```json
// Request (todos los campos opcionales)
{ "nombre": "Don Pelo Barber", "whatsapp_number": "5491187654321", "activo": false }

// Response 200: negocio actualizado (sin api_key)
// Response 404: { "error": "Negocio not found" }
```

---

## Reglas de negocio

- **RN-1:** `nombre` y `rubro` son obligatorios al crear.
- **RN-2:** `api_key` se genera automáticamente — nunca la envía el cliente.
- **RN-3:** `whatsapp_number` es opcional al crear. Si se provee, debe ser único en todo el sistema.
- **RN-4:** Un negocio con `activo: false` rechaza todos los requests con su api_key (el tenant middleware devuelve 401).

---

## Fuera de scope (MVP)

- Eliminación física de negocios
- Panel de administración web
- Múltiples operadores / roles
