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

- **Nombre sugerido:** `crm-peluqueria-panel`
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

1. El dueño del negocio entra a `panel.crm-peluqueria.com` (o URL de Vercel)
2. Ve el formulario de login: email + contraseña
3. NextAuth llama al backend: `POST /api/panel/login` con `{ email, password }`
4. El backend valida, devuelve `{ negocioId, nombre, apiKey }`
5. NextAuth guarda la sesión con un JWT (contiene `negocioId` y `apiKey`)
6. Todas las llamadas al backend desde el panel usan `X-Api-Key: <apiKey>` del JWT

### Cambios necesarios en el backend

**Tabla `negocios` — nuevas columnas:**

```sql
ALTER TABLE negocios
  ADD COLUMN panel_email    TEXT UNIQUE,
  ADD COLUMN panel_password TEXT; -- bcrypt hash
```

**Nuevo endpoint:**

```
POST /api/panel/login
Body: { email, password }
Response 200: { negocioId, nombre, apiKey }
Response 401: { error: "Credenciales inválidas" }
```

- Sin middleware de auth (es el endpoint de login)
- Valida email → busca negocio → compara bcrypt → devuelve datos
- Nunca devuelve la contraseña hasheada

**Script para cargar credenciales iniciales** (onboarding de negocio):
```bash
node scripts/set-panel-credentials.js --negocio "Expreso Polar" --email "jonatan@expresopolar.com" --password "..."
```

---

## 5. Pantallas — MVP

### 5.1 Login

- Campos: email, contraseña
- Botón "Ingresar"
- Error si credenciales inválidas
- Redirige a Agenda después del login exitoso
- No hay registro desde el panel — las credenciales las carga el operador

### 5.2 Agenda

Vista principal. Muestra los turnos del negocio.

**Filtros:**
- Por fecha (selector de día, default: hoy)
- Por estado: Todos / Pendiente / Confirmado / Cancelado

**Tabla de turnos:**

| Horario | Cliente | Servicio | Estado | Acciones |
|---|---|---|---|---|
| Lunes 9/06 10:00 | Jorge López | Instalación 3.000 frg | Pendiente | Ver / Cancelar |

**Comportamiento:**
- Carga los turnos del día seleccionado al montar
- Polling o refresh manual (no websocket en MVP)
- Si no hay turnos: "No hay turnos para este día"
- Botón "Cancelar" abre modal de confirmación antes de ejecutar

**Endpoint consumido:** `GET /api/turnos?date=YYYY-MM-DD`

### 5.3 Detalle de turno

Modal o página separada (decidir en implementación).

**Datos mostrados:**
- Cliente: nombre + teléfono
- Servicio: nombre + duración
- Profesional
- Fecha y hora
- Dirección
- Observaciones (notas del agente: síntomas, frigorías, barrio cerrado, etc.)
- Estado actual

**Acciones:**
- Cancelar turno → modal de confirmación → `PUT /api/turnos/:id` `{ status: "cancelado" }`
- Confirmar turno (si estado es "pendiente") → `PUT /api/turnos/:id` `{ status: "confirmado" }`

---

## 6. Estructura de carpetas del repo del panel

```
src/
  app/
    page.tsx                  — redirige a /login o /agenda según sesión
    login/
      page.tsx                — formulario de login
    agenda/
      page.tsx                — vista de agenda
      [id]/
        page.tsx              — detalle de turno (opcional en MVP)
  components/
    AppointmentTable.tsx
    AppointmentModal.tsx
    StatusBadge.tsx
    DatePicker.tsx
  lib/
    api.ts                    — wrapper de fetch con X-Api-Key del JWT
    auth.ts                   — config NextAuth
  types/
    appointment.ts
    business.ts
```

---

## 7. Variables de entorno del panel

```
NEXTAUTH_URL=https://panel.crm-peluqueria.com
NEXTAUTH_SECRET=<secreto aleatorio>
NEXT_PUBLIC_API_URL=https://crm-peluqueria-production.up.railway.app
```

---

## 8. Cambios en el backend (resumen)

| Cambio | Archivo | Estado |
|---|---|---|
| Migración: `panel_email` + `panel_password` en `negocios` | `db/migrations/006_panel_auth.sql` | Pendiente |
| Endpoint `POST /api/panel/login` | `src/routes/panel.js` + `src/services/panel.service.js` | Pendiente |
| Script para cargar credenciales | `scripts/set-panel-credentials.js` | Pendiente |

---

## 9. Módulos futuros (post-MVP)

Estos no entran en el primer ciclo pero la arquitectura los tiene que soportar:

| Módulo | Descripción |
|---|---|
| Clientes | Ver lista de clientes, historial de turnos por cliente |
| Servicios | Editar precios, activar/desactivar servicios |
| Horarios | Ver y editar horarios del profesional |
| Estadísticas | Turnos por semana, tasa de cancelación, ingresos estimados |
| Múltiples negocios | Un usuario admin que ve todos sus negocios (si el operador quiere) |

---

## 10. Pendientes de definir

| Tema | Detalle |
|---|---|
| URL del panel | ¿Subdominio del dominio actual o URL de Vercel directamente? |
| ¿Un panel por negocio o multi-negocio? | Por ahora: uno por negocio. Cada negocio tiene sus credenciales y ve solo sus datos |
| Notificación de nuevo turno en el panel | ¿Mostrar badge o contador en tiempo real? Requiere websocket o polling |
