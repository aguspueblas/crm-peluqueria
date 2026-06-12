-- AgendAI: admin_users, admin_negocio, admin_conversaciones
-- Atomic data migration: admin_phone -> admin_users + admin_negocio, then DROP COLUMN

CREATE TABLE IF NOT EXISTS admin_users (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL DEFAULT 'Admin',
  telefono    VARCHAR(20)  UNIQUE NOT NULL,
  activo      BOOLEAN      DEFAULT TRUE,
  created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_negocio (
  admin_user_id  INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  negocio_id     INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  PRIMARY KEY (admin_user_id, negocio_id)
);

CREATE TABLE IF NOT EXISTS admin_conversaciones (
  id             SERIAL PRIMARY KEY,
  admin_user_id  INTEGER   NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  negocio_id     INTEGER   NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  messages       JSONB     NOT NULL DEFAULT '[]',
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_conv_unique UNIQUE (admin_user_id, negocio_id)
);

-- Migrate existing admin_phone values to admin_users + admin_negocio, then drop the column
DO $$
DECLARE
  r          RECORD;
  new_admin  INTEGER;
BEGIN
  FOR r IN
    SELECT id AS negocio_id, admin_phone AS telefono
    FROM   negocios
    WHERE  admin_phone IS NOT NULL
  LOOP
    -- find-or-create admin_user by phone
    SELECT id INTO new_admin
    FROM   admin_users
    WHERE  telefono = r.telefono;

    IF new_admin IS NULL THEN
      INSERT INTO admin_users (telefono) VALUES (r.telefono)
      RETURNING id INTO new_admin;
    END IF;

    -- link admin to business (ignore if already linked)
    INSERT INTO admin_negocio (admin_user_id, negocio_id)
    VALUES (new_admin, r.negocio_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  ALTER TABLE negocios DROP COLUMN IF EXISTS admin_phone;
END;
$$;
