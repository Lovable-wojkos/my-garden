import { describe, expect, it } from "vitest";
import { aggregateWateringEventsMm, sumAllWateringEventsMm } from "@/lib/services/watering-events";
import type { WateringEventRow } from "@/types";

function makeEvent(overrides: Partial<WateringEventRow>): WateringEventRow {
  return {
    id: "event-1",
    user_id: "user-1",
    field_id: null,
    watered_at: "2026-06-20",
    amount_mm: 2,
    created_at: "2026-06-20T12:00:00Z",
    ...overrides,
  };
}

describe("aggregateWateringEventsMm", () => {
  it("returns 0 for empty rows", () => {
    expect(aggregateWateringEventsMm([], "field-a")).toBe(0);
  });

  it("sums field-specific events only for matching field", () => {
    const rows = [
      makeEvent({ id: "e1", field_id: "field-a", amount_mm: 2 }),
      makeEvent({ id: "e2", field_id: "field-b", amount_mm: 4 }),
    ];

    expect(aggregateWateringEventsMm(rows, "field-a")).toBe(2);
    expect(aggregateWateringEventsMm(rows, "field-b")).toBe(4);
    expect(aggregateWateringEventsMm(rows, "field-c")).toBe(0);
  });

  it("counts null-field events for any field", () => {
    const rows = [makeEvent({ id: "e1", field_id: null, amount_mm: 2 })];

    expect(aggregateWateringEventsMm(rows, "field-a")).toBe(2);
    expect(aggregateWateringEventsMm(rows, "field-b")).toBe(2);
  });

  it("sums mixed field-specific and null-field events", () => {
    const rows = [
      makeEvent({ id: "e1", field_id: "field-a", amount_mm: 2 }),
      makeEvent({ id: "e2", field_id: null, amount_mm: 3 }),
    ];

    expect(aggregateWateringEventsMm(rows, "field-a")).toBe(5);
    expect(aggregateWateringEventsMm(rows, "field-b")).toBe(3);
  });

  it("sums multiple events on the same field", () => {
    const rows = [
      makeEvent({ id: "e1", field_id: "field-a", amount_mm: 2 }),
      makeEvent({ id: "e2", field_id: "field-a", amount_mm: 2 }),
      makeEvent({ id: "e3", field_id: null, amount_mm: 2 }),
    ];

    expect(aggregateWateringEventsMm(rows, "field-a")).toBe(6);
  });
});

describe("sumAllWateringEventsMm", () => {
  it("sums every event once regardless of field_id", () => {
    const rows = [
      makeEvent({ id: "e1", field_id: "field-a", amount_mm: 2 }),
      makeEvent({ id: "e2", field_id: null, amount_mm: 2 }),
    ];

    expect(sumAllWateringEventsMm(rows)).toBe(4);
  });

  it("coerces numeric strings from the database", () => {
    const rows = [makeEvent({ amount_mm: "2.00" as unknown as number })];

    expect(sumAllWateringEventsMm(rows)).toBe(2);
  });
});
