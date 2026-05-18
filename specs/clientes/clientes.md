# Spec — Módulo Clientes

**Prefijo:** `/api/clientes`
**Auth:** `X-Api-Key` header requerido (resuelve tenant)
**Estado:** Implementado

> `negocio_id` resuelto por middleware. No va en body ni URL.

---

## Descripción

Gestión de clientes por negocio. El mismo número de teléfono puede ser cliente de distintos negocios como registros independientes. El endpoint `/identificar` es el punto de entrada principal para la IA — lo llama al inicio de cada conversación de WhatsApp.

---

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/clientes | Listar clientes del negocio |
| GET | /api/clientes/:id | Obtener por ID |
| POST | /api/clientes | Crear cliente |
| PUT | /api/clientes/:id | Actualizar datos |
| POST | /api/clientes/identificar | Find-or-create por teléfono |

---

## POST /api/clientes/identificar

Diseñado para ser llamado por la IA al inicio de cada conversación. Los datos vienen del webhook: `wa_id` como `telefono`, `profile.name` como `nombre`.

```json
// Request
{ "telefono": "16505551234", "nombre": "Sheena Nelson" }

// Response 200 — cliente existente
{ "id": 3, "nombre": "Sheena Nelson", "telefono": "16505551234", "email": null, "created_at": "...", "es_nuevo": false }

// Response 201 — cliente nuevo
{ "id": 4, "nombre": "Sheena Nelson", "telefono": "16505551234", "email": null, "created_at": "...", "es_nuevo": true }
```

> `es_nuevo: true` permite a la IA personalizar el saludo para clientes nuevos vs. recurrentes.

---

## Reglas de negocio

- **RN-1:** `telefono` es único por negocio — mismo número puede ser cliente de distintos negocios.
- **RN-2:** `telefono` y `nombre` son obligatorios al crear.
- **RN-3:** `/identificar` usa `(telefono, negocio_id)` como clave. Si existe, lo devuelve sin modificar el nombre.
- **RN-4:** `/identificar` nunca sobreescribe el nombre — si fue renombrado manualmente, ese nombre prevalece.

---

## Fuera de scope (MVP)

- Historial de turnos embebido en la respuesta
- Bloqueo de clientes
- Campos adicionales (dirección, notas)
