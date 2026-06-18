import type { PlantingRow, PlantRow } from "@/types";

export type WateringLevel = "low" | "medium" | "high";

export type WateringStatus = "ok" | "water_soon" | "water_now" | "unknown";

export const WATERING_THRESHOLDS_MM: Record<WateringLevel, number> = {
  low: 10,
  medium: 20,
  high: 35,
};

export function normalizeWateringNeeds(needs: string | null): WateringLevel | null {
  if (!needs?.trim()) return null;
  const normalized = needs.trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return null;
}

export function evaluateWatering(needs: string | null, rainfall7dMm: number): WateringStatus {
  const level = normalizeWateringNeeds(needs);
  if (!level) return "unknown";

  const threshold = WATERING_THRESHOLDS_MM[level];
  if (rainfall7dMm >= threshold) return "ok";
  if (rainfall7dMm < threshold * 0.5) return "water_now";
  return "water_soon";
}

export function evaluatePlantingWatering(
  planting: PlantingRow,
  plants: PlantRow[],
  rainfall7dMm: number,
): WateringStatus {
  if (!planting.plant_id) return "unknown";
  const plant = plants.find((p) => p.id === planting.plant_id);
  if (!plant) return "unknown";
  return evaluateWatering(plant.watering_needs, rainfall7dMm);
}

export function aggregateFieldWatering(statuses: WateringStatus[]): WateringStatus | null {
  const evaluable = statuses.filter((s) => s !== "unknown");
  if (evaluable.length === 0) return null;

  if (evaluable.includes("water_now")) return "water_now";
  if (evaluable.includes("water_soon")) return "water_soon";
  return "ok";
}
