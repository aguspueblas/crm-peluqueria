# Spec — Panel web del negocio

Panel de administración para que el dueño del negocio gestione su agenda
sin necesidad de hablarle al agente de WhatsApp.

---

## 1. Qué es

Aplicación web independiente (repo separado) que consume la API REST del backend.
Cada negocio tiene sus propias credenciales para acceder a su propio panel.
El operador del SaaS (admin) no accede desde acá — sigue usando los endpoints
de admin con `X-Admin-Secret`.

---

## 2. Repositorio

- **Nombre:** `crm-peluqueria-panel`
- **Repo independiente** del backend
- **Deploy:** Vercel (gratuito, auto-deploy desde GitHub)

---

## 3. Stack

| Capa | Tecnología | Justificación |
|---|---|---|
| Framework | Next.js 14 (App Router) | Estructura escalable, SSR, fácil agregar módulos |
| Estilos | Tailwind CSS | Utilidades, consistencia, velocidad |
| Auth | NextAuth.js (credentials provider) | Manejo de sesión/JWT nativo, soporte usuario/contraseña |
| Data fetching | SWR | Simple, reactivo, caché automático |
| Deploy | Vercel | Gratuito, integración nativa con Next.js |

---

## 4. Autenticación

### Flujo

1. El dueño del negocio entra a la URL del panel
2. Ve el formulario de login: email + contraseña
3. NextAuth llama al backend: `POST /api/panel/login` con `{ email, password }`
4. El backend valida, devuelve `{ negocioId, nombre, apiKey }`
5. NextAuth guarda la sesión con un JWT (contiene `negocioId`, `nombre` y `apiKey`)
6. Todas las llamadas al backend desde el panel usan `X-Api-Key: <apiKey>` del JWT

### Protección de rutas

- Middleware de Next.js (`middleware.ts`) redirige a `/login` si no hay sesión activa
- `/login` redirige a `/agenda` si ya hay sesión

---

## 5. Pantallas — MVP

### 5.1 Login (`/login`)

**Componentes:**
- `LoginForm` — formulario controlado con estado local

**Estado:**
- `email`, `password` (inputs controlados)
- `loading` — deshabilita botón mientras se procesa
- `error` — mensaje debajo del formulario si falla

**Comportamiento:**
- Submit → `signIn('credentials', { email, password, redirect: false })`
- Éxito → `router.push('/agenda')`
- Error → muestra mensaje "Email o contraseña incorrectos"
- Si ya hay sesión activa → redirige automáticamente a `/agenda`

**No hay registro** — las credenciales las carga el operador con el script.

---

### 5.2 Turnos (`/turnos`)

Vista principal del panel.

**Layout:**
- Header con nombre del negocio + botón "Salir"
- Barra de filtros: selector de fecha + filtro de estado + botón actualizar
- Botón "+ Nuevo turno" (abre modal de creación)
- Lista de turnos del día seleccionado

**Componentes:**
- `Header` — nombre del negocio (de la sesión) + logout
- `DateSelector` — input tipo date, default: hoy en Argentina
- `StatusFilter` — dropdown: Todos / Pendiente / Confirmado / Cancelado
- `AppointmentList` — lista de turnos filtrados
- `AppointmentCard` — una fila por turno
- `AppointmentFormModal` — modal de creación y edición (mismo componente)
- `ConfirmDeleteModal` — modal de confirmación antes de eliminar

**Estado:**
- `selectedDate` — string YYYY-MM-DD, default: hoy en Argentina
- `statusFilter` — 'all' | 'pendiente' | 'confirmado' | 'cancelado'
- `modalOpen` — null | 'create' | appointment (para edición)

**Data fetching:**
```
useSWR(`/api/appointments?date=${selectedDate}`, fetcher)
```
Filtra por `statusFilter` en el cliente (sin llamada extra al backend).

**AppointmentCard muestra:**
- Horario (HH:MM)
- Nombre del cliente + teléfono (gris, debajo del nombre)
- Nombre del servicio
- Badge de estado coloreado
- Botón editar (✏) — abre AppointmentFormModal con datos precargados
- Botón eliminar (🗑) — abre ConfirmDeleteModal

**Estado vacío:** "No hay turnos para este día"

**Refresh:** botón manual de recarga

---

### 5.3 Modal de creación / edición de turno

Mismo componente `AppointmentFormModal` para crear y editar.

**Campos:**
- Nombre del cliente (texto libre, requerido)
- Teléfono del cliente (texto libre, opcional)
- Servicio (select con los servicios del negocio)
- Profesional (select con los profesionales activos)
- Fecha (date input)
- Hora (time input, en intervalos de 30 min)
- Dirección (texto libre, opcional)
- Observaciones (textarea, opcional)

**Comportamiento al crear:**
- Estado inicial: `confirmado` (turno manual = ya coordinado)
- Cliente: si el teléfono ya existe en el negocio → usa ese cliente. Si no → crea uno nuevo con `find-or-create` del backend
- Llama: `POST /api/appointments`

**Comportamiento al editar:**
- Precarga todos los campos con los datos del turno
- Solo permite editar fecha/hora (los demás campos son informativos)
- Llama: `PUT /api/appointments/:id`

**Eliminar (desde ConfirmDeleteModal):**
- "¿Cancelar este turno?" + botón confirmar
- Llama: `PUT /api/appointments/:id { status: 'cancelado' }`

---

### Decisiones de diseño confirmadas

| Decisión | Valor |
|---|---|
| Cliente en turno manual | Nombre (requerido) + teléfono (opcional), sin búsqueda en DB |
| Estado inicial turno manual | `confirmado` |
| Vista de turnos | Por día (fecha seleccionada), sin vista semanal en MVP |

---

## 6. Estructura de carpetas

```
crm-peluqueria-panel/
  src/
    app/
      page.tsx                        — redirige a /turnos (o /login si no hay sesión)
      login/
        page.tsx                      — página de login
      turnos/
        page.tsx                      — página principal de turnos
      api/
        auth/
          [...nextauth]/
            route.ts                  — handler de NextAuth
    components/
      LoginForm.tsx
      Header.tsx
      DateSelector.tsx
      StatusFilter.tsx
      AppointmentList.tsx
      AppointmentCard.tsx
      AppointmentFormModal.tsx        — crear y editar (mismo componente)
      ConfirmDeleteModal.tsx
      StatusBadge.tsx
    lib/
      api.ts                          — fetcher con X-Api-Key del JWT
      auth.ts                         — config de NextAuth (credentials provider)
    types/
      appointment.ts
      business.ts
    middleware.ts                     — protección de rutas
  .env.local                          — variables de entorno (no commitear)
  .env.example                        — plantilla de variables (sí commitear)
```

---

## 7. Variables de entorno

```bash
# .env.local (no commitear)
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=<secreto aleatorio — generar con: openssl rand -base64 32>
NEXT_PUBLIC_API_URL=https://crm-peluqueria-production.up.railway.app
```

```bash
# .env.example (sí commitear)
NEXTAUTH_URL=
NEXTAUTH_SECRET=
NEXT_PUBLIC_API_URL=
```

---

## 8. Cambios en el backend

| Cambio | Archivo | Estado |
|---|---|---|
| Migración: `panel_email` + `panel_password` en `negocios` | `db/migrations/009_panel_auth.sql` | **Implementado** — pendiente correr en Railway |
| Endpoint `POST /api/panel/login` | `src/routes/panel.js` + `src/services/panel.service.js` | **Implementado** |
| Script para cargar credenciales | `scripts/set-panel-credentials.js` | **Implementado** |

---

## 9. Módulos futuros (post-MVP)

La estructura de carpetas y el sidebar están pensados para recibir estos módulos sin refactor:

| Módulo | Descripción |
|---|---|
| Clientes | Lista de clientes, historial de turnos por cliente |
| Servicios | Editar precios, activar/desactivar servicios |
| Horarios | Ver y editar horarios del profesional |
| Estadísticas | Turnos por semana, tasa de cancelación, ingresos estimados |

---

## 10. Pendientes de definir

| Tema | Detalle |
|---|---|
| URL de producción | ¿Subdominio propio o URL de Vercel directamente? |
| Notificación de nuevo turno | ¿Badge en tiempo real? Requiere polling o websocket — post-MVP |
