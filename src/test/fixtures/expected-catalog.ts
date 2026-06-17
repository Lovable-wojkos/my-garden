/**
 * Expected global plant catalog — mirrors seed data in
 * supabase/migrations/20260609000000_plants_scope_drop_requests.sql
 */
export interface ExpectedCatalogEntry {
  id: string;
  name: string;
  growth_days: number;
  watering_needs: "high" | "medium" | "low";
}

export const EXPECTED_CATALOG: ExpectedCatalogEntry[] = [
  { id: "seed-plant-tomato", name: "Tomato", growth_days: 70, watering_needs: "high" },
  { id: "seed-plant-carrot", name: "Carrot", growth_days: 75, watering_needs: "medium" },
  { id: "seed-plant-potato", name: "Potato", growth_days: 90, watering_needs: "medium" },
  { id: "seed-plant-onion", name: "Onion", growth_days: 100, watering_needs: "low" },
  { id: "seed-plant-lettuce", name: "Lettuce", growth_days: 45, watering_needs: "high" },
  { id: "seed-plant-cucumber", name: "Cucumber", growth_days: 60, watering_needs: "high" },
  { id: "seed-plant-pepper", name: "Pepper", growth_days: 80, watering_needs: "medium" },
  { id: "seed-plant-beet", name: "Beet", growth_days: 60, watering_needs: "medium" },
  { id: "seed-plant-zucchini", name: "Zucchini", growth_days: 55, watering_needs: "medium" },
  { id: "seed-plant-garlic", name: "Garlic", growth_days: 240, watering_needs: "low" },
];
