import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import * as plantingsService from "@/lib/services/plantings";
import { PATCH, DELETE } from "@/pages/api/plantings/[id]";

vi.mock("@/lib/supabase");
vi.mock("@/lib/services/plantings");

const TEST_USER = { id: "user-123" };
const PLANTING_ID = "planting-abc";

const EXISTING_PLANTING = {
  id: PLANTING_ID,
  user_id: "user-123",
  field_id: "field-1",
  plant_id: null,
  plant_name: "Tomato",
  cell_row: 0,
  cell_col: 0,
  seeding_date: "2026-05-01",
  notes: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

function makeContext(
  method: string,
  body?: unknown,
  user: unknown = TEST_USER,
  id = PLANTING_ID,
): Pick<APIContext, "request" | "cookies" | "locals" | "params"> {
  return {
    request: new Request(`http://localhost/api/plantings/${id}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    cookies: { set: vi.fn() } as any,
    locals: { user } as any,
    params: { id },
  };
}

describe("PATCH /api/plantings/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const response = await PATCH(makeContext("PATCH", { seeding_date: "2026-06-01" }, null) as any);
    expect(response.status).toBe(401);
  });

  it("returns 503 when database is not configured", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const response = await PATCH(makeContext("PATCH", { seeding_date: "2026-06-01" }) as any);
    expect(response.status).toBe(503);
  });

  it("returns 404 when planting not found", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantingsService.getPlantingById).mockResolvedValue({
      data: null,
      error: { message: "not found" } as any,
    } as any);
    const response = await PATCH(makeContext("PATCH", { seeding_date: "2026-06-01" }) as any);
    expect(response.status).toBe(404);
  });

  it("returns 403 when planting belongs to a different user", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantingsService.getPlantingById).mockResolvedValue({
      data: { ...EXISTING_PLANTING, user_id: "other-user" },
      error: null,
    } as any);
    const response = await PATCH(makeContext("PATCH", { seeding_date: "2026-06-01" }) as any);
    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid body fields", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantingsService.getPlantingById).mockResolvedValue({
      data: EXISTING_PLANTING,
      error: null,
    } as any);
    // seeding_date not in YYYY-MM-DD format
    const response = await PATCH(makeContext("PATCH", { seeding_date: "not-a-date" }) as any);
    expect(response.status).toBe(400);
  });

  it("returns 200 with updated planting on success", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantingsService.getPlantingById).mockResolvedValue({
      data: EXISTING_PLANTING,
      error: null,
    } as any);
    const updated = { ...EXISTING_PLANTING, seeding_date: "2026-06-01" };
    vi.mocked(plantingsService.updatePlanting).mockResolvedValue({
      data: updated,
      error: null,
    } as any);
    const response = await PATCH(makeContext("PATCH", { seeding_date: "2026-06-01" }) as any);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.seeding_date).toBe("2026-06-01");
  });
});

describe("DELETE /api/plantings/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const response = await DELETE(makeContext("DELETE", undefined, null) as any);
    expect(response.status).toBe(401);
  });

  it("returns 503 when database is not configured", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const response = await DELETE(makeContext("DELETE") as any);
    expect(response.status).toBe(503);
  });

  it("returns 404 when planting not found", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantingsService.getPlantingById).mockResolvedValue({
      data: null,
      error: { message: "not found" } as any,
    } as any);
    const response = await DELETE(makeContext("DELETE") as any);
    expect(response.status).toBe(404);
  });

  it("returns 403 when planting belongs to a different user", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantingsService.getPlantingById).mockResolvedValue({
      data: { ...EXISTING_PLANTING, user_id: "other-user" },
      error: null,
    } as any);
    const response = await DELETE(makeContext("DELETE") as any);
    expect(response.status).toBe(403);
  });

  it("returns 204 on success", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantingsService.getPlantingById).mockResolvedValue({
      data: EXISTING_PLANTING,
      error: null,
    } as any);
    vi.mocked(plantingsService.deletePlanting).mockResolvedValue({ error: null } as any);
    const response = await DELETE(makeContext("DELETE") as any);
    expect(response.status).toBe(204);
  });
});
