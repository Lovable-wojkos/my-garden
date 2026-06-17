import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { createServiceRoleClient } from "@/lib/supabase";
import * as plantsService from "@/lib/services/plants";
import { PATCH, DELETE } from "@/pages/api/admin/plant-requests/[id]";

vi.mock("@/lib/supabase");
vi.mock("@/lib/services/plants");

const ADMIN_USER = { id: "admin-123", app_metadata: { role: "admin" } };
const REGULAR_USER = { id: "user-456", app_metadata: {} };
const PLANT_ID = "plant-uuid-001";

function makeContext(
  method: "PATCH" | "DELETE",
  body?: unknown,
  user: unknown = ADMIN_USER,
): Pick<APIContext, "request" | "cookies" | "locals" | "params"> {
  return {
    request: new Request(`http://localhost/api/admin/plant-requests/${PLANT_ID}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    cookies: { set: vi.fn() } as any,
    locals: { user } as any,
    params: { id: PLANT_ID },
  };
}

describe("PATCH /api/admin/plant-requests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-admin user", async () => {
    const response = await PATCH(makeContext("PATCH", { growth_days: 30 }, REGULAR_USER) as any);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Forbidden");
  });

  it("returns 422 when growth_days is missing", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({} as any);
    const response = await PATCH(makeContext("PATCH", {}) as any);
    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.errors).toBeDefined();
    expect(json.errors.growth_days).toBeDefined();
  });

  it("returns 422 when growth_days is not a positive integer", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({} as any);
    const response = await PATCH(makeContext("PATCH", { growth_days: 0 }) as any);
    expect(response.status).toBe(422);
  });

  it("returns 503 when service-role client is unavailable", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(null);
    const response = await PATCH(makeContext("PATCH", { growth_days: 30 }) as any);
    expect(response.status).toBe(503);
  });

  it("returns 200 with approved plant on success", async () => {
    const plant = { id: PLANT_ID, name: "Rose", status: "global", growth_days: 30 };
    vi.mocked(createServiceRoleClient).mockReturnValue({} as any);
    vi.mocked(plantsService.approvePlant).mockResolvedValue({ data: plant, error: null } as any);
    const response = await PATCH(makeContext("PATCH", { growth_days: 30, watering_needs: "medium" }) as any);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.plant).toEqual(plant);
  });
});

describe("DELETE /api/admin/plant-requests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-admin user", async () => {
    const response = await DELETE(makeContext("DELETE", undefined, REGULAR_USER) as any);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Forbidden");
  });

  it("returns 503 when service-role client is unavailable", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(null);
    const response = await DELETE(makeContext("DELETE") as any);
    expect(response.status).toBe(503);
  });

  it("returns 200 ok on success", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({} as any);
    vi.mocked(plantsService.rejectPlant).mockResolvedValue({ data: { id: PLANT_ID }, error: null } as any);
    const response = await DELETE(makeContext("DELETE") as any);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
  });
});
