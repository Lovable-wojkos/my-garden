import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import * as plantsService from "@/lib/services/plants";
import { GET, POST } from "@/pages/api/plant-requests/index";

vi.mock("@/lib/supabase");
vi.mock("@/lib/services/plants");

const TEST_USER = { id: "user-123" };

const PENDING_PLANT = {
  id: "plant-pending-1",
  name: "Bazylia",
  growth_days: null,
  watering_needs: null,
  user_id: "user-123",
  status: "pending" as const,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

function makePostContext(
  body?: unknown,
  user: unknown = TEST_USER,
): Pick<APIContext, "request" | "cookies" | "locals"> {
  return {
    request: new Request("http://localhost/api/plant-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    cookies: { set: vi.fn() } as any,
    locals: { user } as any,
  };
}

function makeGetContext(user: unknown = TEST_USER): Pick<APIContext, "request" | "cookies" | "locals"> {
  return {
    request: new Request("http://localhost/api/plant-requests", { method: "GET" }),
    cookies: { set: vi.fn() } as any,
    locals: { user } as any,
  };
}

describe("POST /api/plant-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const response = await POST(makePostContext({ name: "Bazylia" }, null) as any);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    const context: Pick<APIContext, "request" | "cookies" | "locals"> = {
      request: new Request("http://localhost/api/plant-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json{{",
      }),
      cookies: { set: vi.fn() } as any,
      locals: { user: TEST_USER } as any,
    };
    const response = await POST(context as any);
    expect(response.status).toBe(400);
  });

  it("returns 400 when name is too short", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    const response = await POST(makePostContext({ name: "A" }) as any);
    expect(response.status).toBe(400);
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    const response = await POST(makePostContext({}) as any);
    expect(response.status).toBe(400);
  });

  it("returns 503 when supabase client is unavailable", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const response = await POST(makePostContext({ name: "Bazylia" }) as any);
    expect(response.status).toBe(503);
  });

  it("returns 201 with plant row on success", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantsService.createUserPlant).mockResolvedValue({
      data: PENDING_PLANT,
      error: null,
    } as any);

    const response = await POST(makePostContext({ name: "  Bazylia  " }) as any);
    expect(response.status).toBe(201);

    const json = await response.json();
    expect(json).toEqual(PENDING_PLANT);

    expect(plantsService.createUserPlant).toHaveBeenCalledWith({}, { name: "Bazylia", user_id: "user-123" });
  });

  it("returns 500 on database error", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantsService.createUserPlant).mockResolvedValue({
      data: null,
      error: { message: "db error" },
    } as any);

    const response = await POST(makePostContext({ name: "Bazylia" }) as any);
    expect(response.status).toBe(500);
  });
});

describe("GET /api/plant-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const response = await GET(makeGetContext(null) as any);
    expect(response.status).toBe(401);
  });

  it("returns 200 with user's pending plants", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantsService.getUserPendingPlants).mockResolvedValue({
      data: [PENDING_PLANT],
      error: null,
    } as any);

    const response = await GET(makeGetContext() as any);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.plants).toEqual([PENDING_PLANT]);
    expect(plantsService.getUserPendingPlants).toHaveBeenCalledWith({}, "user-123");
  });
});
