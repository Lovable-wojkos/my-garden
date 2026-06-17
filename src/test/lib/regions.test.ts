import { describe, expect, it, vi } from "vitest";
import type { RegionRow } from "@/types";
import { findOrCreateRegion } from "@/lib/services/regions";

const EXISTING_REGION: RegionRow = {
  id: "region-1",
  latitude: 52.229676,
  longitude: 21.012229,
  display_name: "Warsaw, Masovian Voivodeship, Poland",
  created_at: "2026-06-17T00:00:00Z",
};

function makeFindOrCreateClient(options: {
  existing: RegionRow | null;
  inserted?: RegionRow;
  selectError?: unknown;
  insertError?: unknown;
}) {
  const selectBuilder: Record<string, unknown> = {};
  const selectChain = () => selectBuilder;
  selectBuilder.select = vi.fn(selectChain);
  selectBuilder.eq = vi.fn(selectChain);
  selectBuilder.maybeSingle = vi.fn(() =>
    Promise.resolve(
      options.selectError ? { data: null, error: options.selectError } : { data: options.existing, error: null },
    ),
  );

  const insertBuilder: Record<string, unknown> = {};
  const insertChain = () => insertBuilder;
  insertBuilder.insert = vi.fn(insertChain);
  insertBuilder.select = vi.fn(insertChain);
  insertBuilder.single = vi.fn(() =>
    Promise.resolve(
      options.insertError
        ? { data: null, error: options.insertError }
        : { data: options.inserted ?? EXISTING_REGION, error: null },
    ),
  );

  let call = 0;
  return {
    from: vi.fn((table: string) => {
      if (table !== "regions") throw new Error(`unexpected table: ${table}`);
      if (options.existing) {
        return selectBuilder;
      }
      call++;
      return call === 1 ? selectBuilder : insertBuilder;
    }),
    _selectBuilder: selectBuilder,
    _insertBuilder: insertBuilder,
  };
}

describe("findOrCreateRegion", () => {
  it("returns existing region when coordinates match", async () => {
    const client = makeFindOrCreateClient({ existing: EXISTING_REGION });

    const { data, error } = await findOrCreateRegion(client as any, {
      latitude: 52.229676,
      longitude: 21.012229,
      displayName: "Warsaw, Masovian Voivodeship, Poland",
    });

    expect(error).toBeNull();
    expect(data?.id).toBe("region-1");
    expect(client.from).toHaveBeenCalledOnce();
  });

  it("inserts a new region when coordinates are not found", async () => {
    const inserted: RegionRow = {
      ...EXISTING_REGION,
      id: "region-new",
      display_name: "Krakow, Lesser Poland Voivodeship, Poland",
      latitude: 50.06465,
      longitude: 19.94498,
    };
    const client = makeFindOrCreateClient({ existing: null, inserted });

    const { data, error } = await findOrCreateRegion(client as any, {
      latitude: 50.06465,
      longitude: 19.94498,
      displayName: "Krakow, Lesser Poland Voivodeship, Poland",
    });

    expect(error).toBeNull();
    expect(data?.id).toBe("region-new");
    expect(client.from).toHaveBeenCalledTimes(2);
    expect(client._insertBuilder.insert).toHaveBeenCalledWith({
      latitude: 50.06465,
      longitude: 19.94498,
      display_name: "Krakow, Lesser Poland Voivodeship, Poland",
    });
  });

  it("returns the same region id on repeated calls with identical coordinates", async () => {
    const client = makeFindOrCreateClient({ existing: EXISTING_REGION });

    const first = await findOrCreateRegion(client as any, {
      latitude: 52.229676,
      longitude: 21.012229,
      displayName: "Warsaw, Masovian Voivodeship, Poland",
    });
    const second = await findOrCreateRegion(client as any, {
      latitude: 52.229676,
      longitude: 21.012229,
      displayName: "Warsaw, Masovian Voivodeship, Poland",
    });

    expect(first.data?.id).toBe("region-1");
    expect(second.data?.id).toBe("region-1");
  });
});
