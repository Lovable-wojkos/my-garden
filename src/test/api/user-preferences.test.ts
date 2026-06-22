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

const WARSAW_REGION = {
  id: "region-warszawa",
  latitude: 52.229676,
  longitude: 21.012229,
  display_name: "Warszawa, powiat warszawski, Mazowieckie, Polska",
  created_at: "2026-06-17T00:00:00Z",
};

const OGONY_REGION = {
  id: "region-ogony",
  latitude: 52.154789,
  longitude: 21.045123,
  display_name: "Ogony, powiat warszawski, Mazowieckie, Polska",
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

  it("links region_id from findOrCreateRegion on Warszawa then Ogony switch", async () => {
    vi.mocked(regionsService.findOrCreateRegion).mockResolvedValueOnce({ data: WARSAW_REGION, error: null });
    vi.mocked(userPreferencesService.upsertUserPreferences).mockResolvedValueOnce({
      data: {
        ...PREFS,
        region_id: WARSAW_REGION.id,
        city_name: WARSAW_REGION.display_name,
        latitude: WARSAW_REGION.latitude,
        longitude: WARSAW_REGION.longitude,
      },
      error: null,
    });

    const warsawResponse = await POST(
      makeContext({
        city_name: WARSAW_REGION.display_name,
        latitude: WARSAW_REGION.latitude,
        longitude: WARSAW_REGION.longitude,
      }) as any,
    );
    expect(warsawResponse.status).toBe(200);
    expect(userPreferencesService.upsertUserPreferences).toHaveBeenLastCalledWith(expect.anything(), {
      user_id: TEST_USER.id,
      city_name: WARSAW_REGION.display_name,
      latitude: WARSAW_REGION.latitude,
      longitude: WARSAW_REGION.longitude,
      region_id: WARSAW_REGION.id,
    });

    vi.mocked(regionsService.findOrCreateRegion).mockResolvedValueOnce({ data: OGONY_REGION, error: null });
    vi.mocked(userPreferencesService.upsertUserPreferences).mockResolvedValueOnce({
      data: {
        ...PREFS,
        region_id: OGONY_REGION.id,
        city_name: OGONY_REGION.display_name,
        latitude: OGONY_REGION.latitude,
        longitude: OGONY_REGION.longitude,
      },
      error: null,
    });

    const ogonyResponse = await POST(
      makeContext({
        city_name: OGONY_REGION.display_name,
        latitude: OGONY_REGION.latitude,
        longitude: OGONY_REGION.longitude,
      }) as any,
    );
    expect(ogonyResponse.status).toBe(200);

    const upsertCall = vi.mocked(userPreferencesService.upsertUserPreferences).mock.calls.at(-1)?.[1];
    expect(upsertCall?.region_id).toBe(OGONY_REGION.id);
    expect(upsertCall?.latitude).toBe(OGONY_REGION.latitude);
    expect(upsertCall?.longitude).toBe(OGONY_REGION.longitude);
    expect(fieldsService.updateFieldsRegionForUser).toHaveBeenLastCalledWith(
      expect.anything(),
      TEST_USER.id,
      OGONY_REGION.id,
    );

    const warsawJson = await warsawResponse.json();
    const ogonyJson = await ogonyResponse.json();
    expect(warsawJson.region_id).toBe(WARSAW_REGION.id);
    expect(ogonyJson.region_id).toBe(OGONY_REGION.id);
    expect(ogonyJson.region_id).not.toBe(warsawJson.region_id);
  });

  it("never persists region_id without matching request coordinates in the same upsert", async () => {
    const response = await POST(makeContext(VALID_BODY) as any);
    expect(response.status).toBe(200);

    const upsertArgs = vi.mocked(userPreferencesService.upsertUserPreferences).mock.calls[0]?.[1];
    const findOrCreateArgs = vi.mocked(regionsService.findOrCreateRegion).mock.calls[0]?.[1];

    expect(upsertArgs?.latitude).toBe(findOrCreateArgs?.latitude);
    expect(upsertArgs?.longitude).toBe(findOrCreateArgs?.longitude);
    expect(upsertArgs?.region_id).toBe(REGION.id);
  });
});
