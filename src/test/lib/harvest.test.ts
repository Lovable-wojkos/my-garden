import { describe, expect, it } from "vitest";
import { getHarvestDate } from "@/lib/harvest";
import type { PlantingRow, PlantRow } from "@/types";
import { EXPECTED_CATALOG } from "@/test/fixtures/expected-catalog";

const mockPlants: PlantRow[] = [
  {
    id: "plant-1",
    name: "Tomato",
    growth_days: 70,
    watering_needs: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const basePlanting: PlantingRow = {
  id: "planting-1",
  field_id: "field-1",
  user_id: "user-1",
  plant_id: "plant-1",
  plant_name: "Tomato",
  cell_row: 0,
  cell_col: 0,
  seeding_date: "2026-05-01",
  notes: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

describe("getHarvestDate", () => {
  it('returns "–" when planting has no plant_id', () => {
    expect(getHarvestDate({ ...basePlanting, plant_id: null }, mockPlants)).toBe("–");
  });

  it('returns "–" when plant_id is not found in catalog', () => {
    expect(getHarvestDate({ ...basePlanting, plant_id: "unknown-id" }, mockPlants)).toBe("–");
  });

  it('returns "–" when catalog is empty', () => {
    expect(getHarvestDate(basePlanting, [])).toBe("–");
  });

  it('returns "–" when matched plant has growth_days null', () => {
    const plants: PlantRow[] = [
      {
        id: "plant-null-growth",
        name: "UnknownPeriod",
        growth_days: null,
        watering_needs: null,
        user_id: null,
        status: "global",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const planting = { ...basePlanting, plant_id: "plant-null-growth" };
    expect(getHarvestDate(planting, plants)).toBe("–");
  });

  it("returns harvest date for Tomato seed catalog entry using oracle computation", () => {
    const tomato = EXPECTED_CATALOG.find((p) => p.name === "Tomato");
    expect(tomato).toBeDefined();
    if (!tomato) throw new Error("Tomato entry missing from EXPECTED_CATALOG");

    const plants: PlantRow[] = [
      {
        id: tomato.id,
        name: tomato.name,
        growth_days: tomato.growth_days,
        watering_needs: tomato.watering_needs,
        user_id: null,
        status: "global",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const planting: PlantingRow = {
      ...basePlanting,
      plant_id: tomato.id,
      plant_name: tomato.name,
      seeding_date: "2026-05-01",
    };

    const seeding = new Date("2026-05-01");
    seeding.setDate(seeding.getDate() + tomato.growth_days);
    const expected = seeding.toLocaleDateString("pl-PL");

    expect(getHarvestDate(planting, plants)).toBe(expected);
  });

  it("returns harvest date = seeding_date + growth_days", () => {
    // Compute expected using the same arithmetic to avoid locale-specific hard-coding
    const seeding = new Date("2026-05-01");
    seeding.setDate(seeding.getDate() + 70);
    const expected = seeding.toLocaleDateString("pl-PL");
    expect(getHarvestDate(basePlanting, mockPlants)).toBe(expected);
  });

  it("calculates correctly for a different growth period", () => {
    const plants: PlantRow[] = [
      {
        id: "plant-2",
        name: "Radish",
        growth_days: 25,
        watering_needs: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const planting = { ...basePlanting, plant_id: "plant-2", seeding_date: "2026-06-01" };
    const seeding = new Date("2026-06-01");
    seeding.setDate(seeding.getDate() + 25);
    const expected = seeding.toLocaleDateString("pl-PL");
    expect(getHarvestDate(planting, plants)).toBe(expected);
  });
});
