import { describe, expect, it } from "vitest";
import {
  aggregateFieldWatering,
  evaluatePlantingWatering,
  evaluateWatering,
  normalizeWateringNeeds,
  WATERING_THRESHOLDS_MM,
} from "@/lib/watering";
import type { PlantingRow, PlantRow } from "@/types";

const basePlanting: PlantingRow = {
  id: "planting-1",
  field_id: "field-1",
  user_id: "user-1",
  plant_id: "plant-tomato",
  plant_name: "Tomato",
  cell_row: 0,
  cell_col: 0,
  seeding_date: "2026-05-01",
  notes: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

const tomatoPlant: PlantRow = {
  id: "plant-tomato",
  name: "Tomato",
  growth_days: 70,
  watering_needs: "high",
  user_id: null,
  status: "global",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("normalizeWateringNeeds", () => {
  it("returns null for null, empty, or whitespace", () => {
    expect(normalizeWateringNeeds(null)).toBeNull();
    expect(normalizeWateringNeeds("")).toBeNull();
    expect(normalizeWateringNeeds("   ")).toBeNull();
  });

  it("normalizes case and trims", () => {
    expect(normalizeWateringNeeds(" HIGH ")).toBe("high");
    expect(normalizeWateringNeeds("Medium")).toBe("medium");
    expect(normalizeWateringNeeds("low")).toBe("low");
  });

  it("returns null for unrecognized strings", () => {
    expect(normalizeWateringNeeds("very high")).toBeNull();
    expect(normalizeWateringNeeds("n/a")).toBeNull();
  });
});

describe("evaluateWatering", () => {
  describe("low tier (threshold 10 mm)", () => {
    const needs = "low";

    it("returns ok at threshold and above", () => {
      expect(evaluateWatering(needs, WATERING_THRESHOLDS_MM.low)).toBe("ok");
      expect(evaluateWatering(needs, 15)).toBe("ok");
    });

    it("returns water_soon between 50% and threshold", () => {
      expect(evaluateWatering(needs, 5)).toBe("water_soon");
      expect(evaluateWatering(needs, 9.9)).toBe("water_soon");
    });

    it("returns water_now below 50% threshold", () => {
      expect(evaluateWatering(needs, 4.9)).toBe("water_now");
      expect(evaluateWatering(needs, 0)).toBe("water_now");
    });
  });

  describe("medium tier (threshold 20 mm)", () => {
    const needs = "medium";

    it("returns ok at threshold and above", () => {
      expect(evaluateWatering(needs, 20)).toBe("ok");
      expect(evaluateWatering(needs, 25)).toBe("ok");
    });

    it("returns water_soon between 50% and threshold", () => {
      expect(evaluateWatering(needs, 10)).toBe("water_soon");
      expect(evaluateWatering(needs, 19.9)).toBe("water_soon");
    });

    it("returns water_now below 50% threshold", () => {
      expect(evaluateWatering(needs, 9.9)).toBe("water_now");
    });
  });

  describe("high tier (threshold 35 mm)", () => {
    const needs = "high";

    it("returns ok at threshold and above", () => {
      expect(evaluateWatering(needs, 35)).toBe("ok");
      expect(evaluateWatering(needs, 40)).toBe("ok");
    });

    it("returns water_soon between 50% and threshold", () => {
      expect(evaluateWatering(needs, 17.5)).toBe("water_soon");
      expect(evaluateWatering(needs, 34.9)).toBe("water_soon");
    });

    it("returns water_now below 50% threshold (tomato scenario)", () => {
      expect(evaluateWatering(needs, 5)).toBe("water_now");
      expect(evaluateWatering(needs, 17.4)).toBe("water_now");
    });
  });

  it("returns unknown for null or unrecognized needs", () => {
    expect(evaluateWatering(null, 20)).toBe("unknown");
    expect(evaluateWatering("extreme", 20)).toBe("unknown");
  });
});

describe("evaluatePlantingWatering", () => {
  it("returns unknown for manual planting without plant_id", () => {
    const manual = { ...basePlanting, plant_id: null, plant_name: "Custom" };
    expect(evaluatePlantingWatering(manual, [tomatoPlant], 20)).toBe("unknown");
  });

  it("returns unknown when plant_id is not in catalog", () => {
    expect(evaluatePlantingWatering(basePlanting, [], 20)).toBe("unknown");
  });

  it("evaluates linked plant watering needs", () => {
    expect(evaluatePlantingWatering(basePlanting, [tomatoPlant], 40)).toBe("ok");
    expect(evaluatePlantingWatering(basePlanting, [tomatoPlant], 5)).toBe("water_now");
  });
});

describe("aggregateFieldWatering", () => {
  it("returns null for empty statuses", () => {
    expect(aggregateFieldWatering([])).toBeNull();
  });

  it("returns null when all statuses are unknown", () => {
    expect(aggregateFieldWatering(["unknown", "unknown"])).toBeNull();
  });

  it("returns ok when all evaluable statuses are ok", () => {
    expect(aggregateFieldWatering(["ok", "ok", "unknown"])).toBe("ok");
  });

  it("returns worst-case among evaluable statuses", () => {
    expect(aggregateFieldWatering(["ok", "water_soon"])).toBe("water_soon");
    expect(aggregateFieldWatering(["ok", "water_now", "water_soon"])).toBe("water_now");
    expect(aggregateFieldWatering(["water_soon", "unknown"])).toBe("water_soon");
  });

  it("ignores unknown when mixing with evaluable statuses", () => {
    expect(aggregateFieldWatering(["unknown", "ok"])).toBe("ok");
    expect(aggregateFieldWatering(["unknown", "water_now"])).toBe("water_now");
  });
});
