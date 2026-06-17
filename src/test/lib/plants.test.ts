import { describe, expect, it, vi } from "vitest";
import type { PlantRow } from "@/types";
import {
  getPlants,
  createUserPlant,
  getPendingPlants,
  getUserPendingPlants,
  approvePlant,
  rejectPlant,
} from "@/lib/services/plants";
import { EXPECTED_CATALOG } from "@/test/fixtures/expected-catalog";

// Build a chainable Supabase query builder mock
function makeQueryBuilder(resolvedValue: unknown) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.delete = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.single = vi.fn(() => Promise.resolve(resolvedValue));
  builder.maybeSingle = vi.fn(() => Promise.resolve(resolvedValue));
  builder.overrideTypes = vi.fn(() => Promise.resolve(resolvedValue));
  // Allow awaiting the builder directly (for queries that don't end in .single())
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolvedValue).then(resolve);
  return builder;
}

function makeClient(resolvedValue: unknown) {
  const builder = makeQueryBuilder(resolvedValue);
  return { from: vi.fn(() => builder), _builder: builder };
}

const GLOBAL_PLANT: PlantRow = {
  id: "plant-1",
  name: "Tomato",
  growth_days: 70,
  watering_needs: "high",
  user_id: null,
  status: "global",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const PENDING_PLANT: PlantRow = {
  id: "plant-2",
  name: "MyVeg",
  growth_days: null,
  watering_needs: null,
  user_id: "user-42",
  status: "pending",
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

function catalogToPlantRows(): PlantRow[] {
  return EXPECTED_CATALOG.map((entry) => ({
    id: entry.id,
    name: entry.name,
    growth_days: entry.growth_days,
    watering_needs: entry.watering_needs,
    user_id: null,
    status: "global" as const,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }));
}

/** Mock that simulates Supabase filtering pending rows when eq("status", "global") is applied. */
function makeClientWithCatalog(includePending = true) {
  const globalRows = catalogToPlantRows();
  const pendingRow: PlantRow = {
    id: "plant-pending",
    name: "UserPending",
    growth_days: null,
    watering_needs: null,
    user_id: "user-99",
    status: "pending",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  };
  const allRows = includePending ? [...globalRows, pendingRow] : globalRows;

  const builder: Record<string, unknown> = {};
  let statusFilter: string | null = null;
  const chain = () => builder;
  const filteredResult = () => ({
    data: statusFilter === "global" ? allRows.filter((r) => r.status === "global") : allRows,
    error: null,
  });

  builder.select = vi.fn(chain);
  builder.eq = vi.fn((col: string, val: string) => {
    if (col === "status") statusFilter = val;
    return builder;
  });
  builder.order = vi.fn(chain);
  builder.overrideTypes = vi.fn(() => Promise.resolve(filteredResult()));
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(filteredResult()).then(resolve);

  return { from: vi.fn(() => builder), _builder: builder };
}

describe("getPlants", () => {
  it("returns complete global catalog with correct attributes", async () => {
    const client = makeClientWithCatalog(true);
    const result = await getPlants(client as any);

    expect(result.data).toHaveLength(EXPECTED_CATALOG.length);
    for (const expected of EXPECTED_CATALOG) {
      const found = result.data?.find((p) => p.name === expected.name);
      expect(found).toBeDefined();
      expect(found?.growth_days).toBe(expected.growth_days);
      expect(found?.watering_needs).toBe(expected.watering_needs);
    }
  });

  it("excludes pending plants from results", async () => {
    const client = makeClientWithCatalog(true);
    const result = await getPlants(client as any);

    expect(result.data?.every((p) => p.status !== "pending")).toBe(true);
    expect(result.data?.some((p) => p.name === "UserPending")).toBe(false);
  });

  it("filters by status = 'global'", async () => {
    const { client, builder } = (() => {
      const c = makeClient({ data: [GLOBAL_PLANT], error: null });
      return { client: c, builder: c._builder };
    })();

    await getPlants(client as any);

    expect(builder.eq).toHaveBeenCalledWith("status", "global");
  });

  it("orders results by name", async () => {
    const c = makeClient({ data: [GLOBAL_PLANT], error: null });
    await getPlants(c as any);
    expect(c._builder.order).toHaveBeenCalledWith("name");
  });
});

describe("createUserPlant", () => {
  it("inserts a pending plant with the given name and user_id", async () => {
    const c = makeClient({ data: PENDING_PLANT, error: null });
    await createUserPlant(c as any, { name: "MyVeg", user_id: "user-42" });

    expect(c._builder.insert).toHaveBeenCalledWith({
      name: "MyVeg",
      user_id: "user-42",
      status: "pending",
    });
  });

  it("returns the new PlantRow on success", async () => {
    const c = makeClient({ data: PENDING_PLANT, error: null });
    const result = await createUserPlant(c as any, { name: "MyVeg", user_id: "user-42" });
    expect(result.data).toEqual(PENDING_PLANT);
  });
});

describe("getPendingPlants", () => {
  it("filters by status = 'pending'", async () => {
    const c = makeClient({ data: [PENDING_PLANT], error: null });
    await getPendingPlants(c as any);
    expect(c._builder.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("orders results by created_at descending", async () => {
    const c = makeClient({ data: [PENDING_PLANT], error: null });
    await getPendingPlants(c as any);
    expect(c._builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});

describe("getUserPendingPlants", () => {
  it("filters by status = 'pending' and user_id", async () => {
    const c = makeClient({ data: [PENDING_PLANT], error: null });
    await getUserPendingPlants(c as any, "user-42");
    expect(c._builder.eq).toHaveBeenCalledWith("status", "pending");
    expect(c._builder.eq).toHaveBeenCalledWith("user_id", "user-42");
  });

  it("orders results by created_at descending", async () => {
    const c = makeClient({ data: [PENDING_PLANT], error: null });
    await getUserPendingPlants(c as any, "user-42");
    expect(c._builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});

describe("approvePlant", () => {
  it("updates the plant to global with growth_days and watering_needs", async () => {
    const c = makeClient({ data: { ...PENDING_PLANT, status: "global", growth_days: 30 }, error: null });
    await approvePlant(c as any, "plant-2", { growth_days: 30, watering_needs: "medium" });

    expect(c._builder.update).toHaveBeenCalledWith({
      status: "global",
      growth_days: 30,
      watering_needs: "medium",
    });
    expect(c._builder.eq).toHaveBeenCalledWith("id", "plant-2");
    expect(c._builder.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("handles null watering_needs", async () => {
    const c = makeClient({ data: { ...PENDING_PLANT, status: "global", growth_days: 60 }, error: null });
    await approvePlant(c as any, "plant-2", { growth_days: 60 });

    expect(c._builder.update).toHaveBeenCalledWith({
      status: "global",
      growth_days: 60,
      watering_needs: null,
    });
  });
});

describe("rejectPlant", () => {
  it("deletes the plant by id", async () => {
    const c = makeClient({ error: null });
    await rejectPlant(c as any, "plant-2");

    expect(c._builder.delete).toHaveBeenCalled();
    expect(c._builder.eq).toHaveBeenCalledWith("id", "plant-2");
    expect(c._builder.eq).toHaveBeenCalledWith("status", "pending");
  });
});
