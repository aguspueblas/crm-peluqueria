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

## Campos del negocio

| Campo | Tipo | Descripción |
|---|---|---|
| `nombre` | VARCHAR(100) | Requerido al crear |
| `rubro` | VARCHAR(100) | Requerido al crear |
| `api_key` | VARCHAR(64) | Generado automáticamente, único |
| `whatsapp_number` | VARCHAR(20) | Opcional, único. Identifica al negocio en el webhook |
| `activo` | BOOLEAN | Default `true`. Si es `false`, rechaza todos los requests |
| `agente_nombre` | VARCHAR(100) | Nombre del asistente IA (placeholder `{agente_nombre}`) |
| `system_prompt` | TEXT | Template del comportamiento del agente. Soporta placeholders |
| `admin_phone` | VARCHAR(20) | Teléfono del admin. Recibe notificaciones de derivación vía WhatsApp |

---

## POST /api/admin/negocios

```json
// Request
{
  "nombre": "Peluquería Don Pelo",
  "rubro": "peluquería",
  "whatsapp_number": "5491187654321",
  "agente_nombre": "Mati",
  "system_prompt": "Sos {agente_nombre}...",
  "admin_phone": "+5491112345678"
}

// Response 201
{
  "id": 1,
  "nombre": "Peluquería Don Pelo",
  "rubro": "peluquería",
  "whatsapp_number": "5491187654321",
  "api_key": "sk_...",
  "activo": true,
  "agente_nombre": "Mati",
  "admin_phone": "+5491112345678",
  "created_at": "2026-05-15T12:00:00.000Z"
}
```

> La `api_key` se devuelve **solo en la creación** — debe guardarse. El webhook usa `whatsapp_number` en su lugar.

---

## PUT /api/admin/negocios/:id

```json
// Request (todos los campos opcionales)
{
  "nombre": "Don Pelo Barber",
  "whatsapp_number": "5491187654321",
  "activo": false,
  "agente_nombre": "Mati",
  "system_prompt": "Sos {agente_nombre}...",
  "admin_phone": "+5491112345678"
}

// Response 200: negocio actualizado (sin api_key)
// Response 404: { "error": "Negocio not found" }
```

---

## Sistema de placeholders en system_prompt

El `system_prompt` soporta placeholders que se resuelven en cada conversación con datos reales:

| Placeholder | Valor |
|---|---|
| `{agente_nombre}` | `negocio.agente_nombre` |
| `{negocio_nombre}` | `negocio.nombre` |
| `{negocio_rubro}` | `negocio.rubro` |
| `{fecha_actual}` | Fecha y hora actual en Argentina (UTC-3) |
| `{cliente_id}` | ID del cliente identificado por teléfono |
| `{cliente_nombre}` | Nombre del cliente (`null` si no fue registrado aún) |
| `{cliente_telefono}` | Teléfono del cliente |
| `{servicios_lista}` | Lista formateada de servicios del negocio |
| `{profesionales_lista}` | Lista formateada de profesionales activos |

Si el `system_prompt` no contiene ningún placeholder (formato legacy), se le inyectan los datos dinámicos por separado y se agregan instrucciones de flujo genéricas al final del prompt.

---

## Reglas de negocio

- **RN-1:** `nombre` y `rubro` son obligatorios al crear.
- **RN-2:** `api_key` se genera automáticamente — nunca la envía el cliente.
- **RN-3:** `whatsapp_number` es opcional al crear. Si se provee, debe ser único en todo el sistema.
- **RN-4:** Un negocio con `activo: false` rechaza todos los requests con su api_key (el tenant middleware devuelve 401).
- **RN-5:** Si `admin_phone` está configurado, el sistema envía un WhatsApp de notificación cada vez que el agente deriva una conversación al admin.

---

## Fuera de scope (MVP)

- Eliminación física de negocios
- Panel de administración web
- Múltiples operadores / roles
