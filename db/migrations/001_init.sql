-- Migración inicial: schema multi-tenant

CREATE TABLE IF NOT EXISTS negocios (
  id                SERIAL PRIMARY KEY,
  nombre            VARCHAR(100) NOT NULL,
  rubro             VARCHAR(100) NOT NULL,
  api_key           VARCHAR(64)  UNIQUE NOT NULL,
  whatsapp_number   VARCHAR(20)  UNIQUE,
  activo            BOOLEAN      DEFAULT TRUE,
  created_at        TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profesionales (
  id          SERIAL PRIMARY KEY,
  negocio_id  INTEGER      NOT NULL REFERENCES negocios(id),
  nombre      VARCHAR(100) NOT NULL,
  activo      BOOLEAN      DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS profesional_horarios (
  id              SERIAL PRIMARY KEY,
  profesional_id  INTEGER  NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  dia_semana      SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio     TIME     NOT NULL,
  hora_fin        TIME     NOT NULL,
  CONSTRAINT horario_valido CHECK (hora_fin > hora_inicio)
);

CREATE TABLE IF NOT EXISTS servicios (
  id                SERIAL PRIMARY KEY,
  negocio_id        INTEGER        NOT NULL REFERENCES negocios(id),
  nombre            VARCHAR(100)   NOT NULL,
  duracion_minutos  INTEGER        NOT NULL,
  precio            NUMERIC(10, 2)
);

CREATE TABLE IF NOT EXISTS clientes (
  id          SERIAL PRIMARY KEY,
  negocio_id  INTEGER      NOT NULL REFERENCES negocios(id),
  nombre      VARCHAR(100) NOT NULL,
  telefono    VARCHAR(20)  NOT NULL,
  email       VARCHAR(150),
  created_at  TIMESTAMP    DEFAULT NOW(),
  CONSTRAINT clientes_negocio_telefono_unique UNIQUE (negocio_id, telefono)
);

CREATE TABLE IF NOT EXISTS turnos (
  id              SERIAL PRIMARY KEY,
  negocio_id      INTEGER NOT NULL REFERENCES negocios(id),
  cliente_id      INTEGER NOT NULL REFERENCES clientes(id),
  profesional_id  INTEGER NOT NULL REFERENCES profesionales(id),
  servicio_id     INTEGER NOT NULL REFERENCES servicios(id),
  fecha_hora      TIMESTAMP NOT NULL,
  estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  created_at      TIMESTAMP DEFAULT NOW(),
  CONSTRAINT estado_valido CHECK (estado IN ('pendiente', 'confirmado', 'cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_horarios_profesional   ON profesional_horarios (profesional_id, dia_semana);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha           ON turnos (fecha_hora);
CREATE INDEX IF NOT EXISTS idx_turnos_profesional     ON turnos (profesional_id);
CREATE INDEX IF NOT EXISTS idx_turnos_cliente         ON turnos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_turnos_negocio         ON turnos (negocio_id);
CREATE INDEX IF NOT EXISTS idx_profesionales_negocio  ON profesionales (negocio_id);
CREATE INDEX IF NOT EXISTS idx_servicios_negocio      ON servicios (negocio_id);
CREATE INDEX IF NOT EXISTS idx_clientes_negocio       ON clientes (negocio_id);
