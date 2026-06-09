pe# Spec — AgendAI: asistente operativo por WhatsApp

Agente de IA que opera como asistente personal de agenda para los dueños de negocio.
Vive en un número de WhatsApp propio (independiente del número de cada negocio cliente).

---

## 1. Qué es

Un número de WhatsApp dedicado al que cada emprendedor agrega una sola vez.
Desde ese chat puede consultar su agenda, gestionar turnos y recibir notificaciones
de todo lo que pasa en su negocio — sin salir de WhatsApp.

No es el agente que atiende clientes. Es el asistente operativo del dueño.

---

## 2. Diferencia con el agente cliente

| | Agente cliente (ej: Expreso Polar) | AgendAI |
|---|---|---|
| Número | Del negocio | Propio (AgendAI) |
| Interlocutor | Cliente final | Dueño / admin del negocio |
| Prompt | Customizado por negocio | Genérico (personalidad AgendAI) |
| Contexto | Servicios, flujo de reserva | Turnos, agenda, operaciones |
| Tools | Booking (crear turno, disponibilidad) | Admin (listar, cancelar, confirmar) |
| Flujo | Reactivo solamente | Reactivo + notificaciones de eventos |

---

## 3. Flujos MVP

### Flujo 1 — Consulta / acción puntual (reactivo)

El admin escribe a AgendAI → el agente corre → usa tools → responde.

Ejemplos:
- "¿Qué turnos tengo hoy?"
- "¿Dónde era el turno de las 3?"
- "Cancelá el turno de Jorge del miércoles"
- "¿Cuánto sale la instalación de 3000 frigorías?"
- "¿Tenés disponibilidad el jueves a la tarde?"

### Flujo 2 — Notificación de evento (proactivo, disparado por evento)

Cuando ocurre algo relevante en el negocio, AgendAI le avisa al admin.

Eventos que disparan notificación:
- Nuevo turno agendado por un cliente
- Cliente solicita intervención del admin (`notify_admin`)
- Cliente no puede pagar digitalmente
- No se pudo identificar el servicio

Hoy estas notificaciones salen desde el número del negocio (`notifyNewAppointment`, `notifyDelegation`).
Con AgendAI: salen FROM el número de AgendAI TO el teléfono del admin.
**Cambio mínimo** — solo cambia el remitente Twilio.

### Flujo 3 — Resumen diario (post-MVP)

Cada mañana a hora configurable, AgendAI manda el resumen del día sin que el admin lo pida.
Requiere job programado confiable. Queda fuera del MVP.

---

## 4. Modelo de datos

### Tablas nuevas

```sql
-- Usuarios admin (cross-negocio)
CREATE TABLE admin_users (
  id       SERIAL PRIMARY KEY,
  phone    TEXT NOT NULL UNIQUE,
  nombre   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relación admin ↔ negocio (many-to-many)
CREATE TABLE admin_negocio (
  admin_id   INTEGER NOT NULL REFERENCES admin_users(id),
  negocio_id INTEGER NOT NULL REFERENCES negocios(id),
  PRIMARY KEY (admin_id, negocio_id)
);
```

### Cambios en tabla existente

```sql
-- Quitar admin_phone de negocios (migrado a admin_users)
-- Se hace en una migración separada, después de migrar los datos existentes
ALTER TABLE negocios DROP COLUMN admin_phone;
```

---

## 5. Resolución de contexto

Cuando llega un mensaje al número de AgendAI:

1. Buscar `from` en `admin_users`
2. Si no existe → responder "No estás registrado como admin. Contactá al operador."
3. Si existe → buscar sus negocios vía `admin_negocio`
4. Si tiene **un solo negocio** → contexto directo, arrancar el agente
5. Si tiene **más de un negocio** → AgendAI pregunta: "¿Para qué negocio querés consultar? Tenés: [lista]"
6. Guardar la selección en el historial de conversación para no preguntar cada vez

---

## 6. Tools del agente admin

| Tool | Descripción | Endpoint backend |
|---|---|---|
| `get_appointments` | Listar turnos por fecha (default: hoy) | `GET /api/appointments?date=` |
| `get_appointment_detail` | Detalle completo de un turno por ID | `GET /api/appointments/:id` |
| `cancel_appointment` | Cancelar un turno | `PUT /api/appointments/:id { status: 'cancelado' }` |
| `confirm_appointment` | Confirmar un turno pendiente | `PUT /api/appointments/:id { status: 'confirmado' }` |
| `create_appointment` | Crear un turno manualmente | `POST /api/appointments` |
| `get_availability` | Consultar slots disponibles | `GET /api/availability` |
| `get_services` | Ver servicios y precios | `GET /api/services` |

---

## 7. Prompt de AgendAI

Personalidad fija (no customizable por negocio). Placeholders de contexto inyectados en cada conversación.

```
<identidad>
Sos AgendAI, asistente experto en organizar agendas de emprendimientos.
Hablás directo, sin vueltas. Mensajes cortos. Rioplatense.
Nunca decís que sos una IA.
</identidad>

<contexto>
Fecha y hora actual (Argentina): {fecha_actual}
Admin: {admin_nombre}

Negocios que administrás:
{negocios_lista}

Negocio activo en esta conversación: {negocio_activo}
Servicios: {servicios_lista}
Profesionales: {profesionales_lista}
</contexto>

<capacidades>
Podés: listar turnos, ver detalle de un turno, cancelar, confirmar,
crear un turno, consultar disponibilidad, consultar precios de servicios.
Si te piden algo que no podés hacer, lo decís claro.
</capacidades>
```

---

## 8. Webhook

Nueva ruta en el backend: `/webhook/agendai`

```
Twilio (número AgendAI) → POST /webhook/agendai
```

Misma arquitectura que `/webhook/whatsapp` pero con handler diferente:
- Resuelve **admin** por `from` (en lugar de negocio por `to`)
- Corre el runner admin con prompt y tools de admin
- Historial de conversación separado: `conversaciones` con `tipo = 'admin'` o tabla aparte

---

## 9. Cambios en el backend

| Cambio | Detalle | Estado |
|---|---|---|
| Migración: `admin_users` + `admin_negocio` | Nueva tabla many-to-many | Pendiente |
| Migración: mover `admin_phone` a `admin_users` | Deprecar campo en `negocios` | Pendiente |
| `src/webhook/agendai.js` | Handler del webhook de AgendAI | Pendiente |
| `src/agent/admin-tools.js` | Definición de tools para el agente admin | Pendiente |
| `src/agent/admin-executor.js` | Ejecuta cada tool admin | Pendiente |
| `src/agent/admin-runner.js` | Loop Tool Use para el agente admin | Pendiente |
| `src/agent/admin-prompt.js` | Arma el system prompt de AgendAI | Pendiente |
| `src/services/admin.service.js` | Resolver admin, sus negocios, contexto | Pendiente |
| `scripts/add-admin.js` | CLI para registrar un admin en un negocio | Pendiente |
| Migrar notificaciones | `notifyNewAppointment` y `notifyDelegation` usan número AgendAI | Pendiente |

---

## 10. Variable de entorno nueva

```
AGENDAI_WHATSAPP_FROM=whatsapp:+1XXXXXXXXXX  — número Twilio de AgendAI
```

---

## 11. Onboarding de admin (operador)

```bash
# Registrar un admin en un negocio
node scripts/add-admin.js --negocio "Expreso Polar" --phone "+5491112345678" --nombre "Jonatan"
```

---

## 12. Fuera del MVP

| Feature | Motivo |
|---|---|
| Resumen diario automático | Requiere job programado confiable externo |
| Roles de admin (dueño vs empleado) | Complejidad innecesaria en MVP |
| Admin responde al cliente desde AgendAI | Requiere routing de mensajes entre chats |

---

## 13. Decisiones de arquitectura — /plan-eng-review 2026-06-09

### D1 — runner.js → run-loop.js genérico (ACEPTADO)
Refactorizar runner.js para recibir `{ tools, executor, buildPrompt }` como parámetros.
admin-runner.js se convierte en un wrapper de ~20 líneas. Elimina DRY violation permanente.

### D2 — notifications.service.js: lista de phones en vez de adminPhone único (ACEPTADO)
`notifyNewAppointment(business, appt, adminPhones[])` y `notifyDelegation(business, phone, reason, adminPhones[])`.
El caller (runner.js) resuelve los admins antes de llamar al service.

### D3 — Historial de admin: tabla `admin_conversaciones` separada (ACEPTADO)
Columnas: `admin_id FK`, `negocio_activo_id FK (nullable)`, `messages JSONB`, `updated_at`.
Evita FK problems con la tabla `conversaciones` existente.

### D4 — Migración atómica: data migration + DROP COLUMN en un bloque PL/pgSQL (ACEPTADO)
Primero INSERT INTO admin_users + admin_negocio de los datos existentes, luego DROP COLUMN admin_phone.
Garantiza que no se pierdan datos de Expreso Polar.

### D5 — Timezone normalization → appointmentService.create() (ACEPTADO)
La normalización de `-03:00` se mueve de executor.js al service. Admin executor hereda el fix.

### D6 — Tests: mocha para run-loop.js y admin.service.js (ACEPTADO)
Setup mínimo de mocha. Cubre los dos módulos de mayor blast radius sin expandir scope total.

### D7 — TTL de admin_conversaciones: 7 días (ACEPTADO)
TTL de 7 días (vs 2hs de clientes). Prune de 10 mensajes. negocio_activo_id sobrevive porque es columna separada.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES_OPEN | 6 issues, 1 critical gap |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0 decisiones abiertas (todas resueltas en sesión)
**VERDICT:** ENG REVIEW con issues — resolver T1-T5 antes de implementar. Outside voice: skipped.
