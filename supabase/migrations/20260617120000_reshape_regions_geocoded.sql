-- Reshape regions from voivodeships to Open-Meteo geocoded places.
-- Dev/MVP: truncates fields and weather_records; users re-pick city and recreate fields.

TRUNCATE weather_records;
TRUNCATE fields CASCADE;

DELETE FROM regions;

ALTER TABLE regions DROP CONSTRAINT IF EXISTS regions_code_key;
-- migration-review: acknowledged — dropping legacy voivodeship columns replaced by geocoded latitude/longitude/display_name
ALTER TABLE regions DROP COLUMN code;
-- migration-review: acknowledged — dropping legacy voivodeship columns replaced by geocoded latitude/longitude/display_name
ALTER TABLE regions DROP COLUMN name;

ALTER TABLE regions
  ADD COLUMN latitude numeric(9, 6) NOT NULL,
  ADD COLUMN longitude numeric(9, 6) NOT NULL,
  ADD COLUMN display_name text NOT NULL;

ALTER TABLE regions ADD CONSTRAINT regions_latitude_longitude_unique UNIQUE (latitude, longitude);

ALTER TABLE user_preferences
  ADD COLUMN region_id uuid REFERENCES regions(id);

CREATE POLICY "regions_insert_authenticated"
  ON regions FOR INSERT
  TO authenticated
  WITH CHECK (true);
