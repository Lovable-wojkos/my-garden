import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import * as plantingsService from "@/lib/services/plantings";
import { POST } from "@/pages/api/plantings/index";

vi.mock("@/lib/supabase");
vi.mock("@/lib/services/plantings");

const TEST_USER = { id: "user-123" };

const VALID_BODY = {
  field_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  plant_name: "Tomato",
  cell_row: 0,
  cell_col: 0,
  seeding_date: "2026-05-01",
};

function makeContext(body?: unknown, user: unknown = TEST_USER): Pick<APIContext, "request" | "cookies" | "locals"> {
  return {
    request: new Request("http://localhost/api/plantings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    cookies: { set: vi.fn() } as any,
    locals: { user } as any,
  };
}

describe("POST /api/plantings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const response = await POST(makeContext(VALID_BODY, null) as any);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    const context: Pick<APIContext, "request" | "cookies" | "locals"> = {
      request: new Request("http://localhost/api/plantings", {
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

  it("returns 400 when neither plant_id nor plant_name is provided", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    const body = { ...VALID_BODY, plant_name: undefined };
    const response = await POST(makeContext(body) as any);
    expect(response.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    const response = await POST(makeContext({ plant_name: "Tomato" }) as any);
    expect(response.status).toBe(400);
  });

  it("returns 503 when database is not configured", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const response = await POST(makeContext(VALID_BODY) as any);
    expect(response.status).toBe(503);
  });

  it("returns 400 with cell-occupied message on 23505 unique violation", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantingsService.createPlanting).mockResolvedValue({
      data: null,
      error: { code: "23505", message: "unique_violation" } as any,
    } as any);
    const response = await POST(makeContext(VALID_BODY) as any);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(JSON.stringify(json)).toContain("occupied");
  });

  it("returns 500 on unexpected database error", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantingsService.createPlanting).mockResolvedValue({
      data: null,
      error: { code: "99999", message: "unexpected" } as any,
    } as any);
    const response = await POST(makeContext(VALID_BODY) as any);
    expect(response.status).toBe(500);
  });

  it("returns 201 with planting id on success", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(plantingsService.createPlanting).mockResolvedValue({
      data: { id: "planting-abc" } as any,
      error: null,
    } as any);
    const response = await POST(makeContext(VALID_BODY) as any);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.id).toBe("planting-abc");
  });
});
