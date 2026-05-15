# Documentación Técnica — CRM Peluquería

---

## 1. Stack y versiones

| Tecnología | Versión | Rol |
|---|---|---|
| Node.js | 22.x | Runtime |
| Express | 4.x | Framework HTTP |
| Sequelize | 6.x | ORM |
| PostgreSQL | 16 | Base de datos |
| pg | 8.x | Driver PostgreSQL (usado por Sequelize internamente) |
| dotenv | 16.x | Variables de entorno |
| Docker / Docker Compose | — | Entorno reproducible |

---

## 2. Levantar el proyecto

### Con Docker (recomendado)

```bash
# Primera vez o cuando cambió el schema:
docker compose down -v
docker compose up --build

# Reinicios normales (sin cambios de schema):
docker compose up
```

El flag `-v` borra el volumen de PostgreSQL. Es necesario cuando se modifica `001_init.sql` porque PostgreSQL solo ejecuta los scripts de `/docker-entrypoint-initdb.d/` cuando la base está vacía.

### Sin Docker (desarrollo local)

```bash
# Requisitos: Node 22, PostgreSQL 16 corriendo

npm install
cp .env.example .env       # completar con credenciales locales

# Crear base y cargar schema
createdb crm_peluqueria
psql crm_peluqueria < db/migrations/001_init.sql

npm run dev                # nodemon, recarga automática
```

### Variables de entorno

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto del servidor | 3000 |
| `DB_HOST` | Host de PostgreSQL | localhost |
| `DB_PORT` | Puerto de PostgreSQL | 5432 |
| `DB_NAME` | Nombre de la base | crm_peluqueria |
| `DB_USER` | Usuario de PostgreSQL | — |
| `DB_PASSWORD` | Contraseña | — |

En Docker, estas variables se inyectan directamente en `docker-compose.yml` (no se usa `.env` en el contenedor).

---

## 3. Arquitectura de carpetas

```
src/
  app.js                  → setup de Express: middlewares globales, montaje de rutas
  config/
    sequelize.js          → instancia Sequelize (singleton, importar desde acá siempre)
  models/
    index.js              → carga todos los modelos y define asociaciones
    Profesional.js        → tabla profesionales
    ProfesionalHorario.js → tabla profesional_horarios
    Cliente.js            → tabla clientes
    Servicio.js           → tabla servicios
    Turno.js              → tabla turnos
  routes/
    turnos.js             → rutas públicas /api/turnos
    clientes.js           → rutas públicas /api/clientes
    disponibilidad.js     → rutas públicas /api/disponibilidad
    admin/
      profesionales.js    → rutas admin /api/admin/profesionales
  services/
    turnos.service.js         → lógica de negocio de turnos
    clientes.service.js       → lógica de negocio de clientes
    disponibilidad.service.js → cálculo de slots disponibles
    profesionales.service.js  → lógica de negocio de profesionales
  middlewares/
    errorHandler.js       → captura errores y responde { error: message }

db/
  migrations/
    001_init.sql          → schema inicial (tablas, índices, datos base)

docs/
  TECHNICAL.md            → este archivo
```

### Responsabilidades por capa

- **Route:** solo recibe el request, llama al service, devuelve la response. Sin lógica de negocio.
- **Service:** toda la lógica de negocio, validaciones y queries. Lanza errores con `status` para que el errorHandler los capture.
- **Model:** define la estructura de la tabla. Sin lógica de negocio.

---

## 4. Cómo agregar una nueva ruta

### Paso 1 — Crear el modelo (si la tabla es nueva)

```js
// src/models/MiEntidad.js
'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const MiEntidad = sequelize.define('MiEntidad', {
  id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
}, {
  tableName: 'mi_entidad',   // siempre explícito
  timestamps: false,         // si la tabla no tiene createdAt/updatedAt
});

module.exports = MiEntidad;
```

### Paso 2 — Registrar el modelo y sus asociaciones en index.js

```js
// src/models/index.js
const MiEntidad = require('./MiEntidad');

// asociaciones
MiEntidad.hasMany(OtraEntidad, { as: 'alias', foreignKey: 'mi_entidad_id' });
OtraEntidad.belongsTo(MiEntidad, { foreignKey: 'mi_entidad_id' });

module.exports = { ..., MiEntidad };
```

### Paso 3 — Crear el service

```js
// src/services/mientidad.service.js
'use strict';

const { Op } = require('sequelize');
const { MiEntidad } = require('../models');

async function getAll() {
  return MiEntidad.findAll({ order: [['nombre', 'ASC']] });
}

async function getById(id) {
  const entidad = await MiEntidad.findByPk(id);
  if (!entidad) throw notFound('MiEntidad no encontrada');
  return entidad;
}

async function create(data) {
  if (!data.nombre) throw badRequest('El campo nombre es requerido');
  return MiEntidad.create(data);
}

// helpers de error — patrón estándar del proyecto
function notFound(msg)   { const e = new Error(msg); e.status = 404; return e; }
function badRequest(msg) { const e = new Error(msg); e.status = 400; return e; }
function conflict(msg)   { const e = new Error(msg); e.status = 409; return e; }

module.exports = { getAll, getById, create };
```

### Paso 4 — Crear la route

```js
// src/routes/mientidad.js
'use strict';

const express = require('express');
const router = express.Router();
const service = require('../services/mientidad.service');

router.get('/', async (req, res, next) => {
  try {
    res.json(await service.getAll());
  } catch (err) {
    next(err);   // siempre pasar al errorHandler
  }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await service.create(req.body));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

### Paso 5 — Montar la route en app.js

```js
// src/app.js
const miEntidadRoutes = require('./routes/mientidad');
app.use('/api/mientidad', miEntidadRoutes);
```

---

## 5. Patrones Sequelize

### Consulta simple

```js
// todos
await Profesional.findAll({ order: [['nombre', 'ASC']] });

// por PK
await Profesional.findByPk(id);

// con condición
await Turno.findOne({ where: { cliente_id: 1, estado: 'pendiente' } });
```

### Con asociaciones (include)

```js
await Turno.findAll({
  include: [
    { model: Cliente,     attributes: ['id', 'nombre'] },
    { model: Profesional, attributes: ['id', 'nombre'] },
    { model: Servicio,    attributes: ['id', 'nombre', 'duracion_minutos'] },
  ],
  order: [['fecha_hora', 'ASC']],
});
```

### Operadores (Op)

```js
const { Op } = require('sequelize');

// mayor que
where: { fecha_hora: { [Op.gt]: new Date() } }

// en lista
where: { estado: { [Op.in]: ['pendiente', 'confirmado'] } }

// entre fechas
where: { fecha_hora: { [Op.gte]: inicio, [Op.lte]: fin } }

// distinto
where: { id: { [Op.ne]: excluir_id } }

// menor o igual
where: { hora_inicio: { [Op.lte]: '10:00:00' } }
```

### Transacciones

Usar cuando una operación involucra múltiples writes que deben ser atómicos.

```js
const sequelize = require('../config/sequelize');

const resultado = await sequelize.transaction(async (t) => {
  const profesional = await Profesional.create({ nombre }, { transaction: t });

  for (const h of horarios) {
    await ProfesionalHorario.create(
      { profesional_id: profesional.id, ...h },
      { transaction: t }
    );
  }

  return profesional;  // si algo falla, el ROLLBACK es automático
});
```

### Queries complejas (raw SQL)

Cuando la query involucra aritmética de fechas, JOINs complejos o funciones SQL que Sequelize no puede expresar limpiamente:

```js
const resultados = await sequelize.query(
  `SELECT t.id FROM turnos t
   JOIN servicios s ON s.id = t.servicio_id
   WHERE t.profesional_id = :profesional_id
     AND t.fecha_hora < :fin::timestamptz
     AND t.fecha_hora + (s.duracion_minutos || ' minutes')::interval > :inicio::timestamptz`,
  {
    replacements: { profesional_id, fin, inicio },
    type: sequelize.QueryTypes.SELECT,
  }
);
```

Usar `replacements` (nunca interpolación de strings) para evitar SQL injection.

---

## 6. Manejo de errores

El middleware `errorHandler.js` captura todos los errores lanzados con `next(err)` y responde:

```json
{ "error": "Mensaje descriptivo" }
```

Para lanzar errores con el status HTTP correcto desde un service:

```js
function notFound(msg)      { const e = new Error(msg); e.status = 404; return e; }
function badRequest(msg)    { const e = new Error(msg); e.status = 400; return e; }
function conflict(msg)      { const e = new Error(msg); e.status = 409; return e; }
function unprocessable(msg) { const e = new Error(msg); e.status = 422; return e; }
```

| Status | Cuándo usarlo |
|---|---|
| 400 | Input inválido, campos faltantes, regla de negocio violada |
| 404 | Recurso no encontrado |
| 409 | Conflicto de datos (solapamiento, duplicado) |
| 422 | Operación semánticamente inválida (transición de estado inválida) |
| 500 | Error no esperado (se loguea, no se expone detalle al cliente) |

---

## 7. Base de datos y migraciones

Las migraciones son scripts SQL numerados en `db/migrations/`. No se usa el sistema de migraciones de Sequelize — el schema se gestiona manualmente.

**Convención de nombres:** `NNN_descripcion.sql` (ej: `002_agregar_notas_turno.sql`)

Sequelize usa `sync: false` implícito — nunca altera las tablas automáticamente. Si necesitás cambiar el schema:

1. Creá un nuevo archivo `db/migrations/002_xxx.sql` con los `ALTER TABLE` necesarios
2. Corré `psql crm_peluqueria < db/migrations/002_xxx.sql` en local
3. En Docker, bajá con `-v` y volvé a levantar para que aplique desde cero (o conectate al contenedor y corrés el script manualmente)

---

## 8. Separación Admin / API pública

Las rutas se dividen en dos grupos con distintos propósitos:

| Prefijo | Propósito | Quién lo usa |
|---|---|---|
| `/api/admin/*` | Gestión del negocio | Dueño / panel interno |
| `/api/*` | Operaciones de agenda | IA / WhatsApp (futuro) |

En el MVP ambos grupos son abiertos. Cuando se agregue autenticación, el middleware de auth se monta solo sobre `/api/admin/`.

---

## 9. Endpoints disponibles

### Health
| Método | Ruta | Descripción |
|---|---|---|
| GET | /health | Estado del servidor |

### Admin — Profesionales
| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/admin/profesionales | Listar con horarios |
| GET | /api/admin/profesionales/:id | Obtener uno |
| POST | /api/admin/profesionales | Crear con horario inicial |
| PUT | /api/admin/profesionales/:id | Editar / activar / desactivar |
| POST | /api/admin/profesionales/:id/horarios | Agregar bloque de horario |
| PUT | /api/admin/profesionales/:id/horarios/:hid | Modificar bloque |
| DELETE | /api/admin/profesionales/:id/horarios/:hid | Eliminar bloque |

### Turnos
| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/turnos | Listar (filtros: fecha, profesional_id, cliente_id, estado) |
| GET | /api/turnos/:id | Obtener uno |
| POST | /api/turnos | Crear |
| PUT | /api/turnos/:id | Modificar fecha/hora o estado |
| DELETE | /api/turnos/:id | Cancelar (soft delete) |

### Clientes
| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/clientes | Listar |
| GET | /api/clientes/:id | Obtener uno |
| POST | /api/clientes | Crear |
| PUT | /api/clientes/:id | Actualizar |

---

## 10. Ejemplos de request / response por endpoint

### POST /api/admin/profesionales — Crear profesional

```json
// Body
{
  "nombre": "María González",
  "horarios": [
    { "dia_semana": 1, "hora_inicio": "10:00", "hora_fin": "13:00" },
    { "dia_semana": 1, "hora_inicio": "14:00", "hora_fin": "20:00" },
    { "dia_semana": 2, "hora_inicio": "10:00", "hora_fin": "13:00" },
    { "dia_semana": 2, "hora_inicio": "14:00", "hora_fin": "20:00" },
    { "dia_semana": 3, "hora_inicio": "10:00", "hora_fin": "13:00" },
    { "dia_semana": 3, "hora_inicio": "14:00", "hora_fin": "20:00" },
    { "dia_semana": 4, "hora_inicio": "10:00", "hora_fin": "13:00" },
    { "dia_semana": 4, "hora_inicio": "14:00", "hora_fin": "20:00" },
    { "dia_semana": 5, "hora_inicio": "10:00", "hora_fin": "13:00" },
    { "dia_semana": 5, "hora_inicio": "14:00", "hora_fin": "20:00" },
    { "dia_semana": 6, "hora_inicio": "10:00", "hora_fin": "13:00" }
  ]
}
```

> `dia_semana`: `0`=domingo · `1`=lunes · `2`=martes · `3`=miércoles · `4`=jueves · `5`=viernes · `6`=sábado

```json
// Response 201
{
  "id": 1,
  "nombre": "María González",
  "activo": true,
  "horarios": [
    { "id": 1, "dia_semana": 1, "hora_inicio": "10:00:00", "hora_fin": "13:00:00" },
    { "id": 2, "dia_semana": 1, "hora_inicio": "14:00:00", "hora_fin": "20:00:00" }
  ]
}
```

### PUT /api/admin/profesionales/:id — Editar o desactivar

```json
// Cambiar nombre
{ "nombre": "María G." }

// Desactivar (cancela todos los turnos futuros automáticamente)
{ "activo": false }

// Response 200
{
  "id": 1,
  "nombre": "María G.",
  "activo": false,
  "horarios": [...],
  "turnos_cancelados": 3
}
```

### POST /api/admin/profesionales/:id/horarios — Agregar bloque

```json
// Body
{ "dia_semana": 4, "hora_inicio": "10:00", "hora_fin": "13:00" }

// Response 201
{ "id": 12, "profesional_id": 1, "dia_semana": 4, "hora_inicio": "10:00:00", "hora_fin": "13:00:00" }
```

### POST /api/clientes — Crear cliente

```json
// Body
{
  "nombre": "Juan Pérez",
  "telefono": "1122334455",
  "email": "juan@mail.com"    // opcional
}

// Response 201
{
  "id": 1,
  "nombre": "Juan Pérez",
  "telefono": "1122334455",
  "email": "juan@mail.com",
  "created_at": "2026-05-15T02:00:00.000Z"
}
```

### POST /api/turnos — Crear turno

```json
// Body
{
  "cliente_id": 1,
  "profesional_id": 1,
  "servicio_id": 1,
  "fecha_hora": "2026-06-02T10:00:00"
}
```

> `fecha_hora` debe ser una fecha futura, dentro del horario del profesional.
> Para conocer los `servicio_id` disponibles consultá directamente la DB — los servicios se cargaron con la migración inicial.

```json
// Response 201
{
  "id": 1,
  "cliente_id": 1,
  "profesional_id": 1,
  "servicio_id": 1,
  "fecha_hora": "2026-06-02T13:00:00.000Z",
  "estado": "pendiente",
  "created_at": "2026-05-15T02:00:00.000Z",
  "Cliente": { "id": 1, "nombre": "Juan Pérez", "telefono": "1122334455" },
  "Profesional": { "id": 1, "nombre": "María González" },
  "Servicio": { "id": 1, "nombre": "Corte de pelo", "duracion_minutos": 30, "precio": "1500.00" }
}
```

### PUT /api/turnos/:id — Cambiar estado o reprogramar

```json
// Confirmar
{ "estado": "confirmado" }

// Cancelar
{ "estado": "cancelado" }

// Reprogramar (revalida todas las reglas)
{ "fecha_hora": "2026-06-02T11:00:00" }

// Reprogramar y confirmar en un solo request
{ "fecha_hora": "2026-06-02T11:00:00", "estado": "confirmado" }
```

### GET /api/turnos — Listar con filtros

```
GET /api/turnos                           → todos
GET /api/turnos?fecha=2026-06-02          → turnos de un día
GET /api/turnos?profesional_id=1          → agenda de un profesional
GET /api/turnos?cliente_id=1             → historial de un cliente
GET /api/turnos?estado=pendiente         → filtrar por estado
GET /api/turnos?fecha=2026-06-02&profesional_id=1  → combinados
```

### Servicios disponibles (cargados con la migración inicial)

| id | nombre | duracion_minutos | precio |
|---|---|---|---|
| 1 | Corte de pelo | 30 | 1500 |
| 2 | Corte + barba | 45 | 2000 |
| 3 | Coloración | 90 | 4500 |
| 4 | Mechas | 120 | 6000 |
| 5 | Brushing | 30 | 1200 |

---

## 11. Convenciones de código

- `'use strict'` al inicio de cada archivo
- CommonJS: `require` / `module.exports` — no usar ES Modules (`import/export`)
- Sin comentarios salvo que el WHY no sea obvio
- Validar solo en el boundary del sistema (input del usuario, APIs externas)
- No instalar dependencias sin acordarlo primero
- Toda interacción con la DB a través de modelos Sequelize; raw queries solo cuando Sequelize no puede expresar la lógica limpiamente
