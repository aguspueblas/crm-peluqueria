# CLAUDE.md — Agenda SaaS multi-negocio

Documento de convenciones generales del proyecto. Leerlo antes de tocar cualquier archivo.
Las especificaciones de cada módulo están en `/specs/`.

---

## 1. Qué es este proyecto

**Backend REST multi-tenant** para gestionar agendas de turnos vía WhatsApp. Cada cliente del sistema es un "negocio" independiente (peluquería, técnico de refrigeración, médico, etc.) con sus propios profesionales, servicios y clientes.

**Problema que resuelve:** pequeños emprendedores pierden clientes porque no tienen un sistema de turnos simple. Este sistema les da una agenda inteligente operada por WhatsApp, sin que el dueño tenga que hacer nada — la IA atiende, consulta disponibilidad y agenda sola.

**Consumidor principal:** un agente de Claude (Claude API, Tool Use) que recibe mensajes por WhatsApp, interpreta la intención del usuario y ejecuta acciones sobre este backend. El backend está diseñado pensando en que quien lo consume es una IA — los errores deben ser descriptivos, los endpoints predecibles, las validaciones claras para que el modelo pueda corregir y reintentar.

**Modelo de negocio:** el operador (dueño del SaaS) administra el acceso. Los negocios-cliente no tienen acceso directo al backend — toda interacción externa ocurre vía WhatsApp.

**Ejemplos de negocios:**
- Peluquería "Don Pelo": 4 barberos, cada uno con su horario
- Juan el técnico de refrigeración: 1 profesional (él mismo), 1 servicio (visita técnica)

---

## 2. MVP — Features implementadas

| Módulo | Estado |
|---|---|
| Negocios (CRUD + api_key + whatsapp_number) | Implementado |
| Profesionales (CRUD + horarios semanales) | Implementado |
| Servicios (CRUD + duración variable) | Implementado |
| Clientes (CRUD + find-or-create por teléfono) | Implementado |
| Turnos (CRUD + validaciones de disponibilidad) | Implementado |
| Disponibilidad (slots libres por fecha y servicio) | Implementado |
| Agente IA (Tool Use loop sobre el backend) | Implementado |
| Webhook WhatsApp — Twilio (adapter pattern) | Implementado |
| Historial de conversación en PostgreSQL (JSONB) | Implementado |

---

## 3. Próximos pasos

| Feature | Prioridad |
|---|---|
| Refinar comportamiento del agente (ver sección de pendientes de prompts) | Alta |
| Agregar endpoint admin para limpiar historial de conversación | Alta |
| Agregar costo de tokens por negocio (tracking de uso de la IA) | Media |
| Migrar a Meta WhatsApp Cloud API (~50-80 negocios activos) | Media |
| Panel web de administración por negocio | Baja |

---

## 3b. Pendientes de refinamiento de prompts

Problemas identificados durante las pruebas reales que hay que mejorar:

| Problema | Detalle |
|---|---|
| El agente no saluda al cliente | Arranca directo con la info del perfil, sin un saludo inicial cálido |
| El agente confirma sin llamar a crear_turno | Haiku a veces ignora la instrucción — evaluar si reforzar el prompt o cambiar a Sonnet |
| El precio aparece en el saludo aunque no se lo pidió | El agente muestra el precio del servicio aunque el cliente no preguntó |

**Estrategia sugerida para la próxima sesión:**
1. Ajustar el `system_prompt` de Don Pelo para incluir un saludo inicial explícito
2. Limpiar el historial entre pruebas (agregar endpoint `/api/admin/conversaciones/reset`)
3. Probar el flujo completo de reserva y validar que crear_turno se llame correctamente

---

## 4. Deuda técnica

| Item | Detalle |
|---|---|
| Tests | No hay tests automatizados. Priorizar integración sobre unitarios. |
| Notificaciones | No se notifica al cliente/profesional cuando se cancela un turno |
| Recordatorio de turno | No hay recordatorio 24hs antes |
| Reasignación automática | Al desactivar un profesional, los turnos se cancelan pero no se reasignan |
| Ausencias puntuales | No existe el concepto de día no laborable o vacaciones |
| Rate limiting del webhook | Rate limit en memoria — se pierde al reiniciar el proceso |

---

## 5. Stack y convenciones

- **Runtime:** Node.js + Express
- **Base de datos:** PostgreSQL
- **ORM:** Sequelize — toda interacción con la DB va a través de Modelos Sequelize, nunca SQL en strings (salvo queries de disponibilidad con `sequelize.query` donde es inevitable)
- **Lenguaje:** JavaScript, CommonJS (`require`/`module.exports`), `'use strict'` en todos los archivos
- **Variables de entorno:** `dotenv`, nunca hardcodear credenciales
- **No usar sin consultar:** TypeScript, ES Modules, Prisma, otros ORMs, frameworks adicionales

---

## 6. Estructura de carpetas

```
src/
  config/sequelize.js      — instancia Sequelize
  models/                  — modelos Sequelize + asociaciones en index.js
  routes/                  — solo ruteo: recibe req, llama al service, devuelve res
  services/                — lógica de negocio
  conversation/store.js    — historial de conversación (carga, guarda, limpia)
  agent/
    tools.js               — definición de tools para Claude API
    executor.js            — ejecuta cada tool llamando al service correspondiente
    prompt.js              — arma el system prompt con contexto del negocio
    runner.js              — loop de Tool Use: llama a Anthropic, ejecuta tools, itera
  webhook/
    index.js               — router Express del webhook
    handler.js             — lógica central: rate limit, lookup de negocio, llama al runner
    providers/twilio.js    — adaptador Twilio (parse, send, validate)
  middlewares/
    auth.js                — valida X-Admin-Secret
    tenant.js              — resuelve negocio por X-Api-Key
    errorHandler.js        — captura errores y responde { error: message }
  app.js                   — setup Express, monta rutas
db/
  migrations/              — scripts SQL numerados (001_init.sql, 002_...)
specs/                     — especificaciones por módulo (ver sección 12)
scripts/
  test-agent.js            — prueba del agente con mock de Anthropic (solo dev)
```

---

## 7. Convenciones de Sequelize

- `timestamps: false` en todos los modelos (o `updatedAt: 'updated_at'` donde aplique)
- `tableName` siempre explícito para evitar pluralización automática
- Asociaciones definidas únicamente en `models/index.js`
- Para transacciones: `sequelize.transaction(async (t) => { ... })`
- Para condiciones complejas: usar `Op` de Sequelize (`Op.gt`, `Op.in`, `Op.lt`, etc.)

---

## 8. Modelo de datos

```
negocios
  id, nombre, rubro, api_key (UNIQUE), whatsapp_number (UNIQUE, nullable), activo, created_at

profesionales
  id, negocio_id (FK), nombre, activo

profesional_horarios
  id, profesional_id (FK), dia_semana (0=dom...6=sáb), hora_inicio TIME, hora_fin TIME
  — un profesional puede tener múltiples bloques por día (mañana y/o tarde)

servicios
  id, negocio_id (FK), nombre, duracion_minutos, precio
  — duracion_minutos: entero positivo sin restricción de múltiplo

clientes
  id, negocio_id (FK), nombre, telefono, email, created_at
  — UNIQUE (negocio_id, telefono)

turnos
  id, negocio_id (FK), cliente_id, profesional_id, servicio_id, fecha_hora, estado, created_at
  — estado: pendiente | confirmado | cancelado

conversaciones
  id, negocio_id (FK), telefono, messages (JSONB), updated_at
  — UNIQUE (negocio_id, telefono)
  — se limpia automáticamente después de 2hs de inactividad
```

---

## 9. Autenticación y tenant

### ADMIN_SECRET — rutas de admin de negocios

El header `X-Admin-Secret` valida al operador del sistema en `/api/admin/negocios/*`.

### X-Api-Key — rutas REST del backend

El header `X-Api-Key` identifica al negocio en todas las demás rutas REST. El middleware `tenant.js` resuelve el `negocio_id` y lo adjunta a `req.negocio`.

### Webhook — sin headers de auth

El webhook identifica al negocio por `whatsapp_number` (campo `to` del mensaje entrante). No pasa por `tenant.js` — hace un lookup directo a Sequelize. El `ADMIN_SECRET` y la `api_key` nunca aparecen en el contexto del agente de IA.

---

## 10. Manejo de errores

Todos los errores pasan por `middlewares/errorHandler.js` que responde:

```json
{ "error": "mensaje descriptivo" }
```

Los services lanzan errores con `statusCode` para que el handler los mapee correctamente. Los errores deben ser lo suficientemente descriptivos para que el agente de IA pueda entender qué falló y reintentar.

---

## 11. Metodología de trabajo (SDD)

1. Antes de implementar cualquier módulo nuevo, definir la spec en `/specs/{modulo}/{modulo}.md`
2. El agente presenta la spec y espera confirmación explícita antes de implementar
3. Un módulo a la vez, sin avanzar sin "ok, seguí"
4. No instalar dependencias sin avisar cuáles y para qué

---

## 12. Deploy del servidor (se hace una vez)

### 12.1 Pasos de deploy en Railway

1. Crear proyecto en [Railway](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Agregar plugin PostgreSQL: dentro del proyecto → **New → Database → PostgreSQL**
3. Vincular la DB al servicio: en el servicio → **Variables → Reference → Postgres → DATABASE_URL**
4. Habilitar red pública en Postgres: servicio Postgres → **Settings → Public Networking → Enable**
5. Correr las migraciones desde la máquina local (requiere la URL pública de Postgres):
   ```bash
   cd /ruta/al/proyecto && DATABASE_URL="postgresql://postgres:PASSWORD@junction.proxy.rlwy.net:PORT/railway" node -e "
   const { Sequelize } = require('sequelize');
   const fs = require('fs');
   const path = require('path');
   const db = new Sequelize(process.env.DATABASE_URL, { dialect: 'postgres', logging: false, dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } });
   const migrationsDir = path.join(process.cwd(), 'db/migrations');
   const files = fs.readdirSync(migrationsDir).sort();
   (async () => {
     await db.authenticate();
     for (const file of files) {
       const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
       await db.query(sql);
       console.log('OK:', file);
     }
     await db.close();
   })().catch(e => { console.error(e.message); process.exit(1); });
   "
   ```
6. Cargar variables de entorno en Railway → servicio backend → **Variables**:

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `8080` |
   | `ANTHROPIC_API_KEY` | key de Anthropic |
   | `ADMIN_SECRET` | secreto del operador (inventarlo, guardarlo bien) |
   | `WHATSAPP_PROVIDER` | `twilio` |
   | `TWILIO_ACCOUNT_SID` | desde Twilio Console |
   | `TWILIO_AUTH_TOKEN` | desde Twilio Console |
   | `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (sandbox) |

7. Railway hace redeploy automático al guardar variables. Verificar que el servidor responde en la URL pública del servicio.

---

---

## 13. Onboarding de cliente nuevo (se repite por cada negocio)

Una vez el servidor está corriendo, dar de alta un negocio nuevo con este flujo:

**Paso 1 — Crear el negocio:**
```bash
curl -X POST https://TU-URL.railway.app/api/admin/negocios \
  -H "X-Admin-Secret: TU_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Nombre del Negocio",
    "rubro": "peluqueria",
    "whatsapp_number": "+5491112345678",
    "system_prompt": "Reglas del negocio..."
  }'
```
Guardar el `api_key` que devuelve — es el identificador del negocio para las rutas REST.

**Paso 2 — Cargar un profesional:**
```bash
curl -X POST https://TU-URL.railway.app/api/profesionales \
  -H "X-Api-Key: API_KEY_DEL_NEGOCIO" \
  -H "Content-Type: application/json" \
  -d '{ "nombre": "Nombre Profesional" }'
```

**Paso 3 — Cargar horarios del profesional** (un registro por bloque horario):
```bash
curl -X POST https://TU-URL.railway.app/api/profesionales/ID/horarios \
  -H "X-Api-Key: API_KEY_DEL_NEGOCIO" \
  -H "Content-Type: application/json" \
  -d '{ "dia_semana": 1, "hora_inicio": "09:00", "hora_fin": "18:00" }'
```
`dia_semana`: 0=domingo, 1=lunes ... 6=sábado.

**Paso 4 — Cargar servicios:**
```bash
curl -X POST https://TU-URL.railway.app/api/servicios \
  -H "X-Api-Key: API_KEY_DEL_NEGOCIO" \
  -H "Content-Type: application/json" \
  -d '{ "nombre": "Corte de pelo", "duracion_minutos": 30, "precio": 5000 }'
```

**Paso 5 — Configurar el system_prompt** (reglas del negocio para el agente):
```bash
curl -X PUT https://TU-URL.railway.app/api/admin/negocios/ID \
  -H "X-Admin-Secret: TU_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "system_prompt": "Sos el asistente virtual de X. El servicio base es Y (id: Z). Si el cliente no especifica servicio, usá siempre el id Z." }'
```

**Paso 6 — Configurar Twilio:**
- En Twilio Console → Messaging → Sandbox → configurar el webhook a:
  `https://TU-URL.railway.app/webhook/whatsapp`
- El número de sandbox es `whatsapp:+14155238886`
- Para producción: solicitar número dedicado en Twilio (requiere aprobación de Meta)

---

---

## 14. Costos de servicios externos

Estimaciones mensuales para operar el sistema. Los costos escalan con la cantidad de negocios y mensajes activos.

### Infraestructura

| Servicio | Plan | Costo estimado |
|---|---|---|
| Railway (servidor) | Hobby | $5 USD/mes fijo + consumo adicional si supera el crédito |
| Railway (PostgreSQL) | incluido en Hobby | $0 (entra dentro del crédito del plan) |

### IA — Anthropic Claude

El modelo actual es **Claude Haiku** (el más económico). Se cobra por tokens procesados.

| Modelo | Input | Output |
|---|---|---|
| Haiku 4.5 | $0.80 / millón tokens | $4.00 / millón tokens |

Estimación por conversación: ~2.000 tokens promedio → **~$0.009 USD por conversación**.
Con 500 conversaciones/mes por negocio → **~$4.50 USD/mes por negocio activo**.

### WhatsApp — Twilio (etapa actual: sandbox)

| Concepto | Costo |
|---|---|
| Sandbox de pruebas | Gratis |
| Número dedicado (producción) | ~$1 USD/mes |
| Mensajes salientes (WhatsApp) | ~$0.005 USD por mensaje |
| Mensajes entrantes | Gratis |

Estimación con 500 mensajes salientes/mes por negocio → **~$3.50 USD/mes por negocio**.

### Resumen por negocio activo

| Concepto | Costo mensual estimado |
|---|---|
| Infraestructura Railway | $5 USD (fijo, compartido entre todos los negocios) |
| IA (Haiku, 500 conversaciones) | ~$4.50 USD por negocio |
| Twilio (500 mensajes salientes) | ~$3.50 USD por negocio |
| **Total por negocio** | **~$8 USD/mes** |

> A partir de ~50-80 negocios activos conviene migrar a Meta WhatsApp Cloud API (1.000 conversaciones gratis/mes por número).

---

## 14b. Deuda técnica de infraestructura

Las migraciones hoy se corren manualmente (ver sección 12). Pendiente: agregar un script `scripts/migrate.js` que corra al iniciar el servidor en producción o como paso de build en Railway.

---

## 15. Specs por módulo

| Módulo | Archivo |
|---|---|
| Negocios | [specs/negocios/negocios.md](specs/negocios/negocios.md) |
| Profesionales | [specs/profesionales/profesionales.md](specs/profesionales/profesionales.md) |
| Servicios | [specs/servicios/servicios.md](specs/servicios/servicios.md) |
| Clientes | [specs/clientes/clientes.md](specs/clientes/clientes.md) |
| Turnos | [specs/turnos/turnos.md](specs/turnos/turnos.md) |
| Disponibilidad | [specs/disponibilidad/disponibilidad.md](specs/disponibilidad/disponibilidad.md) |
| Agente IA | [specs/ia/agent.md](specs/ia/agent.md) |
| Webhook WhatsApp | [specs/whatsapp/webhook.md](specs/whatsapp/webhook.md) |
