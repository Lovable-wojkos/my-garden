import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { createServiceRoleClient } from "@/lib/supabase";
import * as plantsService from "@/lib/services/plants";
import { GET } from "@/pages/api/admin/plant-requests/index";

vi.mock("@/lib/supabase");
vi.mock("@/lib/services/plants");

const ADMIN_USER = { id: "admin-123", app_metadata: { role: "admin" } };
const REGULAR_USER = { id: "user-456", app_metadata: {} };

function makeContext(user: unknown = ADMIN_USER): Pick<APIContext, "request" | "cookies" | "locals"> {
  return {
    request: new Request("http://localhost/api/admin/plant-requests"),
    cookies: { set: vi.fn() } as any,
    locals: { user } as any,
  };
}

describe("GET /api/admin/plant-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-admin user", async () => {
    const response = await GET(makeContext(REGULAR_USER) as any);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Forbidden");
  });

  it("returns 503 when service-role client is unavailable", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(null);
    const response = await GET(makeContext() as any);
    expect(response.status).toBe(503);
  });

  it("returns 500 on Supabase error", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({} as any);
    vi.mocked(plantsService.getPendingPlants).mockResolvedValue({
      data: null,
      error: { message: "db error" } as any,
    } as any);
    const response = await GET(makeContext() as any);
    expect(response.status).toBe(500);
  });

  it("returns 200 with plants list for admin", async () => {
    const plants = [{ id: "p1", name: "Rose", status: "pending" }];
    vi.mocked(createServiceRoleClient).mockReturnValue({} as any);
    vi.mocked(plantsService.getPendingPlants).mockResolvedValue({
      data: plants,
      error: null,
    } as any);
    const response = await GET(makeContext() as any);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.plants).toEqual(plants);
  });
});
