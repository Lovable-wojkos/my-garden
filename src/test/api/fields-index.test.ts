/**
 * Dual auth semantics:
 * `/api/fields` is NOT listed in PROTECTED_ROUTES (see src/middleware.ts).
 * Unauthenticated requests reach this handler and receive 401 JSON — not a 302
 * redirect to /auth/signin. In contrast, `/api/plantings` is middleware-protected
 * and would redirect unauthenticated browser requests before the handler runs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import * as fieldsService from "@/lib/services/fields";
import * as userPreferencesService from "@/lib/services/user-preferences";
import { POST } from "@/pages/api/fields/index";

vi.mock("@/lib/supabase");
vi.mock("@/lib/services/fields");
vi.mock("@/lib/services/user-preferences");

const TEST_USER = { id: "user-123" };
const REGION_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const VALID_BODY = {
  name: "Back Garden",
  cols: 5,
  rows: 4,
};

const PREFS_WITH_REGION = {
  user_id: TEST_USER.id,
  city_name: "Warsaw, Masovian Voivodeship, Poland",
  latitude: 52.229676,
  longitude: 21.012229,
  region_id: REGION_ID,
  updated_at: "2026-06-17T12:00:00Z",
};

function makeContext(body?: unknown, user: unknown = TEST_USER): Pick<APIContext, "request" | "cookies" | "locals"> {
  return {
    request: new Request("http://localhost/api/fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    cookies: { set: vi.fn() } as any,
    locals: { user } as any,
  };
}

describe("POST /api/fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(userPreferencesService.getUserPreferences).mockResolvedValue({
      data: PREFS_WITH_REGION,
      error: null,
    });
  });

  it("returns 401 JSON when user is not authenticated (handler-only guard, not middleware redirect)", async () => {
    const response = await POST(makeContext(VALID_BODY, null) as any);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid JSON body", async () => {
    const context: Pick<APIContext, "request" | "cookies" | "locals"> = {
      request: new Request("http://localhost/api/fields", {
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

  it("returns 400 with field errors when name is empty", async () => {
    const response = await POST(makeContext({ ...VALID_BODY, name: "" }) as any);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.errors.name).toBeDefined();
  });

  it("returns 400 with field errors when cols or rows are out of range", async () => {
    const response = await POST(makeContext({ ...VALID_BODY, cols: 0, rows: 21 }) as any);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.errors.cols).toBeDefined();
    expect(json.errors.rows).toBeDefined();
  });

  it("returns 400 when user has no location set", async () => {
    vi.mocked(userPreferencesService.getUserPreferences).mockResolvedValue({ data: null, error: null });

    const response = await POST(makeContext(VALID_BODY) as any);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("location_required");
    expect(fieldsService.createField).not.toHaveBeenCalled();
  });

  it("returns 400 when user preferences lack region_id", async () => {
    vi.mocked(userPreferencesService.getUserPreferences).mockResolvedValue({
      data: { ...PREFS_WITH_REGION, region_id: null },
      error: null,
    });

    const response = await POST(makeContext(VALID_BODY) as any);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("location_required");
    expect(fieldsService.createField).not.toHaveBeenCalled();
  });

  it("returns 503 when database is not configured", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const response = await POST(makeContext(VALID_BODY) as any);
    expect(response.status).toBe(503);
  });

  it("returns 201 with field id and assigns region from user preferences", async () => {
    vi.mocked(fieldsService.createField).mockResolvedValue({
      data: { id: "field-abc" } as any,
      error: null,
    } as any);

    const response = await POST(makeContext(VALID_BODY) as any);

    expect(response.status).toBe(201);
    expect(fieldsService.createField).toHaveBeenCalledWith(expect.anything(), {
      ...VALID_BODY,
      region_id: REGION_ID,
      user_id: TEST_USER.id,
    });
    const json = await response.json();
    expect(json.id).toBe("field-abc");
  });
});
