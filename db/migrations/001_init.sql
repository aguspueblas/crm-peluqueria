-- Migración inicial: tablas base del CRM de peluquería

CREATE TABLE IF NOT EXISTS clientes (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  telefono    VARCHAR(20)  UNIQUE NOT NULL,
  email       VARCHAR(150),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profesionales (
  id      SERIAL PRIMARY KEY,
  nombre  VARCHAR(100) NOT NULL,
  activo  BOOLEAN DEFAULT TRUE
);

-- Horario semanal por profesional: cada fila es un bloque de atención.
-- Un profesional puede tener 0, 1 o 2 bloques por día (mañana y/o tarde).
-- dia_semana: 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado
CREATE TABLE IF NOT EXISTS profesional_horarios (
  id              SERIAL PRIMARY KEY,
  profesional_id  INTEGER NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  dia_semana      SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio     TIME NOT NULL,
  hora_fin        TIME NOT NULL,
  CONSTRAINT horario_valido CHECK (hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_horarios_profesional ON profesional_horarios (profesional_id, dia_semana);

CREATE TABLE IF NOT EXISTS servicios (
  id                SERIAL PRIMARY KEY,
  nombre            VARCHAR(100) NOT NULL,
  duracion_minutos  INTEGER NOT NULL,
  precio            NUMERIC(10, 2)
);

CREATE TABLE IF NOT EXISTS turnos (
  id              SERIAL PRIMARY KEY,
  cliente_id      INTEGER NOT NULL REFERENCES clientes(id),
  profesional_id  INTEGER NOT NULL REFERENCES profesionales(id),
  servicio_id     INTEGER NOT NULL REFERENCES servicios(id),
  fecha_hora      TIMESTAMP NOT NULL,
  estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  created_at      TIMESTAMP DEFAULT NOW(),
  CONSTRAINT estado_valido CHECK (estado IN ('pendiente', 'confirmado', 'cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos (fecha_hora);
CREATE INDEX IF NOT EXISTS idx_turnos_profesional ON turnos (profesional_id);
CREATE INDEX IF NOT EXISTS idx_turnos_cliente ON turnos (cliente_id);

-- Datos iniciales de ejemplo
INSERT INTO servicios (nombre, duracion_minutos, precio) VALUES
  ('Corte de pelo',        30,  1500.00),
  ('Corte + barba',        45,  2000.00),
  ('Coloración',           90,  4500.00),
  ('Mechas',              120,  6000.00),
  ('Brushing',             30,  1200.00);

-- Horario estándar de ejemplo para un profesional (se carga cuando se crea el profesional)
-- Lunes a viernes: 10-13 y 16-21 | Sábado: 10-13 únicamente
-- Ejemplo disponible en comentario para copiar al insertar profesionales:
--
-- INSERT INTO profesional_horarios (profesional_id, dia_semana, hora_inicio, hora_fin) VALUES
--   (1, 1, '10:00', '13:00'), (1, 1, '16:00', '21:00'),  -- lunes
--   (1, 2, '10:00', '13:00'), (1, 2, '16:00', '21:00'),  -- martes
--   (1, 3, '10:00', '13:00'), (1, 3, '16:00', '21:00'),  -- miércoles
--   (1, 4, '10:00', '13:00'), (1, 4, '16:00', '21:00'),  -- jueves
--   (1, 5, '10:00', '13:00'), (1, 5, '16:00', '21:00'),  -- viernes
--   (1, 6, '10:00', '13:00');                             -- sábado solo mañana
