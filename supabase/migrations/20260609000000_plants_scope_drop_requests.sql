-- 1. Extend plants table
ALTER TABLE plants
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN status text NOT NULL DEFAULT 'global'
    CHECK (status IN ('pending', 'global')),
  ALTER COLUMN growth_days DROP NOT NULL;

-- 2. Replace plants RLS policies
DROP POLICY IF EXISTS plants_select_authenticated ON plants;
DROP POLICY IF EXISTS plants_insert_admin ON plants;
DROP POLICY IF EXISTS plants_update_admin ON plants;
DROP POLICY IF EXISTS plants_delete_admin ON plants;

-- authenticated users see: all global plants + their own pending plants
CREATE POLICY plants_select ON plants FOR SELECT TO authenticated
  USING (status = 'global' OR (status = 'pending' AND user_id = auth.uid()));

-- authenticated users can insert their own pending plants (consumed by S-03)
CREATE POLICY plants_insert_user ON plants FOR INSERT TO authenticated
  WITH CHECK (status = 'pending' AND user_id = auth.uid());

-- UPDATE and DELETE on plants are admin-only; service-role bypasses RLS, no policy needed

-- 3. Seed initial global catalog
INSERT INTO plants (name, status, growth_days, watering_needs) VALUES
  ('Tomato',    'global', 70,  'high'),
  ('Carrot',    'global', 75,  'medium'),
  ('Potato',    'global', 90,  'medium'),
  ('Onion',     'global', 100, 'low'),
  ('Lettuce',   'global', 45,  'high'),
  ('Cucumber',  'global', 60,  'high'),
  ('Pepper',    'global', 80,  'medium'),
  ('Beet',      'global', 60,  'medium'),
  ('Zucchini',  'global', 55,  'medium'),
  ('Garlic',    'global', 240, 'low');

-- 4. Drop plant_requests (policies and index first, then table)
DROP POLICY IF EXISTS plant_requests_select_owner ON plant_requests;
DROP POLICY IF EXISTS plant_requests_insert_owner ON plant_requests;
DROP POLICY IF EXISTS plant_requests_update_owner ON plant_requests;
DROP POLICY IF EXISTS plant_requests_delete_owner ON plant_requests;
DROP INDEX IF EXISTS idx_plant_requests_user_id;
DROP TABLE IF EXISTS plant_requests;
