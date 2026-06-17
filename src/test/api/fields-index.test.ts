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
import { POST } from "@/pages/api/fields/index";

vi.mock("@/lib/supabase");
vi.mock("@/lib/services/fields");

const TEST_USER = { id: "user-123" };

const VALID_BODY = {
  name: "Back Garden",
  cols: 5,
  rows: 4,
  region_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
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
  });

  it("returns 401 JSON when user is not authenticated (handler-only guard, not middleware redirect)", async () => {
    const response = await POST(makeContext(VALID_BODY, null) as any);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid JSON body", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
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
    vi.mocked(createClient).mockReturnValue({} as any);
    const response = await POST(makeContext({ ...VALID_BODY, name: "" }) as any);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.errors.name).toBeDefined();
  });

  it("returns 400 with field errors when cols or rows are out of range", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    const response = await POST(makeContext({ ...VALID_BODY, cols: 0, rows: 21 }) as any);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.errors.cols).toBeDefined();
    expect(json.errors.rows).toBeDefined();
  });

  it("returns 400 with field errors when region_id is not a valid UUID", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    const response = await POST(makeContext({ ...VALID_BODY, region_id: "not-a-uuid" }) as any);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.errors.region_id).toBeDefined();
  });

  it("returns 503 when database is not configured", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const response = await POST(makeContext(VALID_BODY) as any);
    expect(response.status).toBe(503);
  });

  it("returns 201 with field id on success", async () => {
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(fieldsService.createField).mockResolvedValue({
      data: { id: "field-abc" } as any,
      error: null,
    } as any);
    const response = await POST(makeContext(VALID_BODY) as any);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.id).toBe("field-abc");
  });
});
