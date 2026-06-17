import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import * as fieldsService from "@/lib/services/fields";
import * as regionsService from "@/lib/services/regions";
import * as userPreferencesService from "@/lib/services/user-preferences";
import { POST } from "@/pages/api/user-preferences";

vi.mock("@/lib/supabase");
vi.mock("@/lib/services/fields");
vi.mock("@/lib/services/regions");
vi.mock("@/lib/services/user-preferences");

const TEST_USER = { id: "user-123" };

const VALID_BODY = {
  city_name: "Warsaw, Masovian Voivodeship, Poland",
  latitude: 52.229676,
  longitude: 21.012229,
};

const REGION = {
  id: "region-abc",
  latitude: 52.229676,
  longitude: 21.012229,
  display_name: "Warsaw, Masovian Voivodeship, Poland",
  created_at: "2026-06-17T00:00:00Z",
};

const PREFS = {
  user_id: TEST_USER.id,
  city_name: VALID_BODY.city_name,
  latitude: VALID_BODY.latitude,
  longitude: VALID_BODY.longitude,
  region_id: REGION.id,
  updated_at: "2026-06-17T12:00:00Z",
};

function makeContext(body?: unknown, user: unknown = TEST_USER): Pick<APIContext, "request" | "cookies" | "locals"> {
  return {
    request: new Request("http://localhost/api/user-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    cookies: { set: vi.fn() } as any,
    locals: { user } as any,
  };
}

describe("POST /api/user-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue({} as any);
    vi.mocked(regionsService.findOrCreateRegion).mockResolvedValue({ data: REGION, error: null });
    vi.mocked(userPreferencesService.upsertUserPreferences).mockResolvedValue({ data: PREFS, error: null });
    vi.mocked(fieldsService.updateFieldsRegionForUser).mockResolvedValue({ error: null } as any);
  });

  it("returns 401 when user is not authenticated", async () => {
    const response = await POST(makeContext(VALID_BODY, null) as any);
    expect(response.status).toBe(401);
  });

  it("upserts region and updates all user fields on city selection", async () => {
    const response = await POST(makeContext(VALID_BODY) as any);

    expect(response.status).toBe(200);
    expect(regionsService.findOrCreateRegion).toHaveBeenCalledWith(expect.anything(), {
      latitude: VALID_BODY.latitude,
      longitude: VALID_BODY.longitude,
      displayName: VALID_BODY.city_name,
    });
    expect(userPreferencesService.upsertUserPreferences).toHaveBeenCalledWith(expect.anything(), {
      user_id: TEST_USER.id,
      city_name: VALID_BODY.city_name,
      latitude: VALID_BODY.latitude,
      longitude: VALID_BODY.longitude,
      region_id: REGION.id,
    });
    expect(fieldsService.updateFieldsRegionForUser).toHaveBeenCalledWith(expect.anything(), TEST_USER.id, REGION.id);

    const json = await response.json();
    expect(json.region_id).toBe(REGION.id);
  });

  it("propagates a new region id when city changes", async () => {
    const newRegion = { ...REGION, id: "region-xyz", display_name: "Krakow, Lesser Poland Voivodeship, Poland" };
    vi.mocked(regionsService.findOrCreateRegion).mockResolvedValue({ data: newRegion, error: null });
    vi.mocked(userPreferencesService.upsertUserPreferences).mockResolvedValue({
      data: { ...PREFS, region_id: newRegion.id, city_name: newRegion.display_name },
      error: null,
    });

    const response = await POST(
      makeContext({
        city_name: newRegion.display_name,
        latitude: 50.06465,
        longitude: 19.94498,
      }) as any,
    );

    expect(response.status).toBe(200);
    expect(fieldsService.updateFieldsRegionForUser).toHaveBeenCalledWith(expect.anything(), TEST_USER.id, "region-xyz");
  });
});
