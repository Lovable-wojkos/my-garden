// ─────────────────────────────────────────────────────────────
// Shared database entity types
// Row     = what SELECT returns
// Insert  = what INSERT accepts (id/timestamps optional)
// Update  = partial Insert for UPDATE statements
// ─────────────────────────────────────────────────────────────

// ── regions ──────────────────────────────────────────────────
export interface RegionRow {
  id: string;
  code: string;
  name: string;
  created_at: string;
}

export interface RegionInsert {
  id?: string;
  code: string;
  name: string;
  created_at?: string;
}

export type RegionUpdate = Partial<RegionInsert>;

// ── plants ───────────────────────────────────────────────────
export interface PlantRow {
  id: string;
  name: string;
  growth_days: number;
  watering_needs: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlantInsert {
  id?: string;
  name: string;
  growth_days: number;
  watering_needs?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type PlantUpdate = Partial<PlantInsert>;

// ── plant_requests ───────────────────────────────────────────
export type PlantRequestStatus = "pending" | "approved" | "rejected";

export interface PlantRequestRow {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  status: PlantRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface PlantRequestInsert {
  id?: string;
  user_id: string;
  name: string;
  notes?: string | null;
  status?: PlantRequestStatus;
  created_at?: string;
  updated_at?: string;
}

export type PlantRequestUpdate = Partial<PlantRequestInsert>;

// ── fields ───────────────────────────────────────────────────
export interface FieldRow {
  id: string;
  user_id: string;
  name: string;
  cols: number;
  rows: number;
  region_id: string;
  created_at: string;
  updated_at: string;
}

export interface FieldInsert {
  id?: string;
  user_id: string;
  name: string;
  cols: number;
  rows: number;
  region_id: string;
  created_at?: string;
  updated_at?: string;
}

export type FieldUpdate = Partial<FieldInsert>;

// ── plantings ────────────────────────────────────────────────
export interface PlantingRow {
  id: string;
  field_id: string;
  user_id: string;
  plant_id: string | null;
  plant_name: string | null;
  cell_row: number;
  cell_col: number;
  seeding_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlantingInsert {
  id?: string;
  field_id: string;
  user_id: string;
  plant_id?: string | null;
  plant_name?: string | null;
  cell_row: number;
  cell_col: number;
  seeding_date: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type PlantingUpdate = Partial<PlantingInsert>;

// ── weather_records ──────────────────────────────────────────
export interface WeatherRecordRow {
  id: string;
  region_id: string | null;
  recorded_at: string;
  temperature_c: number | null;
  rainfall_mm: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface WeatherRecordInsert {
  id?: string;
  region_id?: string | null;
  recorded_at: string;
  temperature_c?: number | null;
  rainfall_mm?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
}

export type WeatherRecordUpdate = Partial<WeatherRecordInsert>;

// ── user_preferences ─────────────────────────────────────────
export interface UserPreferencesRow {
  user_id: string;
  city_name: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

export interface UserPreferencesInsert {
  user_id: string;
  city_name: string;
  latitude: number;
  longitude: number;
  updated_at?: string;
}

export type UserPreferencesUpdate = Partial<UserPreferencesInsert>;
