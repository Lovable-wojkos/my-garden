-- ============================================================
-- Initial schema: regions, plants, plant_requests, fields,
-- plantings, weather_records
-- ============================================================

-- ─────────────────────────────────────────
-- regions (seeded lookup table)
-- ─────────────────────────────────────────
CREATE TABLE regions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text UNIQUE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

-- SELECT open to all authenticated users
CREATE POLICY "regions_select_authenticated"
  ON regions FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE intentionally omitted for authenticated role
-- (service role bypasses RLS)

-- ─────────────────────────────────────────
-- plants (shared catalog)
-- ─────────────────────────────────────────
CREATE TABLE plants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  growth_days    int NOT NULL,
  watering_needs text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plants_select_authenticated"
  ON plants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "plants_insert_admin"
  ON plants FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "plants_update_admin"
  ON plants FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "plants_delete_admin"
  ON plants FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');

-- ─────────────────────────────────────────
-- plant_requests (user submissions)
-- ─────────────────────────────────────────
CREATE TABLE plant_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  notes      text,
  status     text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT plant_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

ALTER TABLE plant_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plant_requests_select_owner"
  ON plant_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "plant_requests_insert_owner"
  ON plant_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "plant_requests_update_owner"
  ON plant_requests FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "plant_requests_delete_owner"
  ON plant_requests FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────
-- fields (per-user garden fields)
-- ─────────────────────────────────────────
CREATE TABLE fields (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  cols       int NOT NULL,
  rows       int NOT NULL,
  region_id  uuid NOT NULL REFERENCES regions(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fields_select_owner"
  ON fields FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "fields_insert_owner"
  ON fields FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "fields_update_owner"
  ON fields FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "fields_delete_owner"
  ON fields FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────
-- plantings (per-cell crop assignments)
-- ─────────────────────────────────────────
CREATE TABLE plantings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id     uuid NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_id     uuid REFERENCES plants(id),
  plant_name   text,
  cell_row     int NOT NULL,
  cell_col     int NOT NULL,
  seeding_date date NOT NULL,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (field_id, cell_row, cell_col)
);

ALTER TABLE plantings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plantings_select_owner"
  ON plantings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "plantings_insert_owner"
  ON plantings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "plantings_update_owner"
  ON plantings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "plantings_delete_owner"
  ON plantings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────
-- weather_records (per-region nightly data)
-- ─────────────────────────────────────────
CREATE TABLE weather_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id     uuid NOT NULL REFERENCES regions(id),
  recorded_at   timestamptz NOT NULL,
  temperature_c numeric(5,2),
  rainfall_mm   numeric(6,2),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE weather_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weather_records_select_authenticated"
  ON weather_records FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE intentionally omitted for authenticated role
-- (nightly cron uses service role key which bypasses RLS)

-- ─────────────────────────────────────────
-- Seed: 16 Polish voivodeships (IMGW regions)
-- Codes use standard voivodeship abbreviations;
-- exact IMGW station codes to be refined in S-01.
-- ─────────────────────────────────────────
INSERT INTO regions (code, name) VALUES
  ('DS', 'Dolnośląskie'),
  ('KP', 'Kujawsko-Pomorskie'),
  ('LU', 'Lubelskie'),
  ('LB', 'Lubuskie'),
  ('LD', 'Łódzkie'),
  ('MA', 'Małopolskie'),
  ('MZ', 'Mazowieckie'),
  ('OP', 'Opolskie'),
  ('PK', 'Podkarpackie'),
  ('PD', 'Podlaskie'),
  ('PM', 'Pomorskie'),
  ('SL', 'Śląskie'),
  ('SK', 'Świętokrzyskie'),
  ('WN', 'Warmińsko-Mazurskie'),
  ('WP', 'Wielkopolskie'),
  ('ZP', 'Zachodniopomorskie');
