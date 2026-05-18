-- Historial de conversaciones WhatsApp por negocio y teléfono

CREATE TABLE IF NOT EXISTS conversaciones (
  id          SERIAL PRIMARY KEY,
  negocio_id  INTEGER NOT NULL REFERENCES negocios(id),
  telefono    VARCHAR(20) NOT NULL,
  messages    JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMP DEFAULT NOW(),
  CONSTRAINT conversaciones_negocio_telefono_unique UNIQUE (negocio_id, telefono)
);

CREATE INDEX IF NOT EXISTS idx_conversaciones_negocio ON conversaciones (negocio_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_updated ON conversaciones (updated_at);
