import type { PlantingRow, PlantRow } from "@/types";

export function getHarvestDate(planting: PlantingRow, plants: PlantRow[]): string {
  if (!planting.plant_id) return "–";
  const plant = plants.find((p) => p.id === planting.plant_id);
  if (plant?.growth_days == null) return "–";
  const seeding = new Date(planting.seeding_date);
  seeding.setDate(seeding.getDate() + plant.growth_days);
  return seeding.toLocaleDateString("pl-PL");
}
