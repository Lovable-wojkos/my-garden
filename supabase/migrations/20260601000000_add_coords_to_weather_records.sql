-- Extend weather_records for coordinate-based storage (F-02)
-- Makes region_id nullable so rows can be stored without a region reference.
-- Adds latitude/longitude columns and a partial unique index for coord-based dedup.

ALTER TABLE weather_records ALTER COLUMN region_id DROP NOT NULL;
ALTER TABLE weather_records ADD COLUMN latitude numeric(9,6);
ALTER TABLE weather_records ADD COLUMN longitude numeric(9,6);

-- Coordinate-based dedup (only applies when lat/lng are non-null)
CREATE UNIQUE INDEX idx_weather_records_coord_recorded
  ON weather_records (latitude, longitude, recorded_at)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
