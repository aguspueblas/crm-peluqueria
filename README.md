# crm-peluqueria

Backend REST para gestión de turnos en peluquerías.
Pensado para integrarse con WhatsApp y una IA (Claude API) que interprete mensajes y ejecute acciones.

## Stack

- Node.js + Express
- PostgreSQL (driver: `pg`)
- JavaScript (CommonJS)

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Crear base de datos y cargar esquema
createdb crm_peluqueria
psql crm_peluqueria < db/migrations/001_init.sql

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 4. Levantar el servidor
npm run dev
```

## Endpoints

| Método | Ruta                        | Descripción                        |
|--------|-----------------------------|------------------------------------|
| GET    | /health                     | Health check                       |
| GET    | /api/clientes               | Listar clientes                    |
| GET    | /api/clientes/:id           | Obtener cliente por ID             |
| POST   | /api/clientes               | Crear cliente                      |
| PUT    | /api/clientes/:id           | Actualizar cliente                 |
| GET    | /api/turnos                 | Listar turnos                      |
| POST   | /api/turnos                 | Crear turno                        |
| PUT    | /api/turnos/:id             | Actualizar turno                   |
| DELETE | /api/turnos/:id             | Cancelar turno                     |
| GET    | /api/disponibilidad?fecha=  | Consultar slots disponibles        |
