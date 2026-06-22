/**
 * Expected Polish voivodeship regions — mirrors seed data in
 * supabase/migrations/20260525000000_initial_schema.sql (lines 200–216)
 *
 * Consumed by:
 * - Post-reset smoke test in scripts/db-smoke.mjs (live DB validation)
 */
export interface ExpectedRegionEntry {
  code: string;
  name: string;
}

export const EXPECTED_REGIONS: ExpectedRegionEntry[] = [
  { code: "DS", name: "Dolnośląskie" },
  { code: "KP", name: "Kujawsko-Pomorskie" },
  { code: "LU", name: "Lubelskie" },
  { code: "LB", name: "Lubuskie" },
  { code: "LD", name: "Łódzkie" },
  { code: "MA", name: "Małopolskie" },
  { code: "MZ", name: "Mazowieckie" },
  { code: "OP", name: "Opolskie" },
  { code: "PK", name: "Podkarpackie" },
  { code: "PD", name: "Podlaskie" },
  { code: "PM", name: "Pomorskie" },
  { code: "SL", name: "Śląskie" },
  { code: "SK", name: "Świętokrzyskie" },
  { code: "WN", name: "Warmińsko-Mazurskie" },
  { code: "WP", name: "Wielkopolskie" },
  { code: "ZP", name: "Zachodniopomorskie" },
];
