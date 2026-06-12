# Tools de los agentes de IA

Referencia de todas las tools disponibles por agente. Fuente de verdad para la implementación.

---

## Agente de clientes

Atiende al cliente final por WhatsApp. Orientado a reservar, consultar y cancelar turnos propios.

| Tool | Para qué | Input requerido | Input opcional |
|---|---|---|---|
| `get_services` | Listar servicios y precios del negocio | — | — |
| `get_next_slots` | Próximos turnos disponibles sin fecha (usar por defecto) | `serviceId` | `professionalId`, `count` |
| `get_availability` | Disponibilidad en una fecha específica (solo si el cliente la nombró) | `date`, `serviceId` | `professionalId` |
| `get_professionals` | Listar profesionales activos (si el cliente pide uno en particular) | — | — |
| `update_client` | Guardar el nombre del cliente la primera vez que lo da | `clientId`, `name` | — |
| `create_appointment` | Crear el turno (solo después de confirmar servicio, profesional, fecha y hora) | `clientId`, `professionalId`, `serviceId`, `scheduledAt` | `address`, `notes` |
| `get_client_appointments` | Ver los turnos pendientes del propio cliente | `clientId` | — |
| `cancel_appointment` | Cancelar un turno propio (solo si el cliente lo confirma) | `appointmentId` | — |
| `notify_admin` | Avisar al admin de algo sin cortar la conversación con el cliente | `reason` | — |
| `delegate_to_admin` | Transferir la conversación al admin y dejar de responder | `reason` | — |

**Total: 10 tools**

---

## AgendAI — Agente supervisor

Asiste al dueño del negocio. Acceso operativo completo a la agenda.

| Tool | Para qué | Input requerido | Input opcional |
|---|---|---|---|
| `get_appointments` | Listar turnos del negocio (default: hoy) | — | `date`, `status`, `professionalId` |
| `get_appointment_detail` | Ver detalle completo de un turno (cliente, dirección, notas) | `appointmentId` | — |
| `create_appointment` | Crear un turno manualmente | `clientPhone`, `professionalId`, `serviceId`, `scheduledAt` | `address`, `notes` |
| `update_appointment` | Reprogramar un turno (cambiar fecha u hora) | `appointmentId`, `scheduledAt` | `notes` |
| `cancel_appointment` | Cancelar un turno | `appointmentId` | — |
| `confirm_appointment` | Confirmar un turno pendiente | `appointmentId` | — |
| `get_availability` | Consultar slots disponibles | `serviceId` | `date`, `professionalId` |
| `get_services` | Ver servicios y precios | — | — |

**Total: 8 tools**

> `update_appointment` no estaba en la spec original — se agrega en esta sesión.  
> `create_appointment` usa `clientPhone` en vez de `clientId` para que el admin pueda decir "agendá a +54911..." sin necesitar el ID.

---

## Comparación

| Tool | Cliente | AgendAI | Notas |
|---|---|---|---|
| `get_services` | ✅ | ✅ | Mismo endpoint, misma implementación |
| `get_availability` | ✅ | ✅ | Mismo endpoint |
| `create_appointment` | ✅ | ✅ | Admin usa `clientPhone`, cliente usa `clientId` |
| `cancel_appointment` | ✅ | ✅ | Mismo endpoint |
| `get_next_slots` | ✅ | — | Solo clientes (búsqueda sin fecha) |
| `get_professionals` | ✅ | — | Solo clientes (el admin no necesita elegir) |
| `update_client` | ✅ | — | Solo clientes |
| `notify_admin` | ✅ | — | Escalation del cliente al admin |
| `delegate_to_admin` | ✅ | — | Escalation del cliente al admin |
| `get_client_appointments` | ✅ | — | El cliente ve sus propios turnos |
| `get_appointments` | — | ✅ | Vista completa de la agenda del negocio |
| `get_appointment_detail` | — | ✅ | El admin necesita ver dirección, notas, etc. |
| `update_appointment` | — | ✅ | Solo el admin reprograma |
| `confirm_appointment` | — | ✅ | Solo el admin confirma |

---

## Notas de implementación

### Agente de clientes — `src/agent/tools.js`
Implementado y en producción. Ningún cambio pendiente en esta sesión.

### AgendAI — `src/agent/admin-tools.js`
A implementar. Observaciones:

- **`get_appointments`** debe soportar filtros opcionales: `date` (default: hoy en AR), `status` (`pendiente` / `confirmado` / `cancelado`), `professionalId`.
- **`create_appointment`** del admin recibe `clientPhone` (no `clientId`) — el executor hace find-or-create del cliente por teléfono antes de crear el turno.
- **`update_appointment`** mapea a `PUT /api/appointments/:id { scheduledAt }` — el service ya lo soporta.
- **`get_availability`** para el admin: `date` es opcional (si no la da, el agente puede usar hoy).

### Tools compartidas — mismo service, distinto executor
`cancel_appointment`, `confirm_appointment`, `get_availability` y `get_services` llaman a los mismos services del backend. El admin-executor los invoca directamente igual que el executor de clientes.
