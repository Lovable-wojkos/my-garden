-- Merge of unapplied migrations:
-- - 20260526171029_fix_rls_update_with_check.sql
-- - 20260526195254_fix_admin_jwt_claim.sql
-- - 20260526195651_add_fk_indexes.sql

-- Fix UPDATE policies: add WITH CHECK (user_id = auth.uid()) to prevent
-- ownership transfer (a user changing their row's user_id to another UUID).
-- Also: plant_requests status is admin-only — users may not change it.
-- Admins use service-role client (bypasses RLS). PostgreSQL requires DROP + CREATE.

-- plant_requests: prevent user from changing status (admin uses service-role)
DROP POLICY IF EXISTS "plant_requests_update_owner" ON plant_requests;
CREATE POLICY "plant_requests_update_owner"
  ON plant_requests FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND status = (SELECT pr.status FROM plant_requests pr WHERE pr.id = plant_requests.id)
  );

-- fields
DROP POLICY IF EXISTS "fields_update_owner" ON fields;
CREATE POLICY "fields_update_owner"
  ON fields FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- plantings
DROP POLICY IF EXISTS "plantings_update_owner" ON plantings;
CREATE POLICY "plantings_update_owner"
  ON plantings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix admin JWT claim extraction in plants policies.
-- Replace fragile double-cast (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role'
-- with idiomatic (auth.jwt() -> 'app_metadata' ->> 'role').
-- The -> operator extracts a jsonb field; ->> then extracts the string value.

DROP POLICY IF EXISTS "plants_insert_admin" ON plants;
CREATE POLICY "plants_insert_admin"
  ON plants FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "plants_update_admin" ON plants;
CREATE POLICY "plants_update_admin"
  ON plants FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "plants_delete_admin" ON plants;
CREATE POLICY "plants_delete_admin"
  ON plants FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Add indexes on FK / common filter columns (PostgreSQL does not auto-index FKs).
-- Also adds UNIQUE constraint on weather_records(region_id, recorded_at) to
-- prevent duplicate entries from cron retries.

-- fields
CREATE INDEX IF NOT EXISTS idx_fields_user_id ON fields (user_id);

-- plant_requests
CREATE INDEX IF NOT EXISTS idx_plant_requests_user_id ON plant_requests (user_id);

-- plantings
CREATE INDEX IF NOT EXISTS idx_plantings_field_id ON plantings (field_id);
CREATE INDEX IF NOT EXISTS idx_plantings_user_id ON plantings (user_id);

-- weather_records: composite index for region+time queries; unique to prevent cron duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_weather_records_region_recorded
  ON weather_records (region_id, recorded_at DESC);
