import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET, POST } from "@/pages/api/plantings/index";
import { requireLocalSupabase } from "@/test/integration/setup";
import {
  createAstroCookies,
  createServiceRoleClient,
  createTestUsers,
  seedFieldForUser,
  seedTestRegion,
  signInTestUser,
  teardownTestUsers,
  type TestUsers,
} from "@/test/integration/helpers/supabase";

const supabaseAvailable = await requireLocalSupabase();

describe.skipIf(!supabaseAvailable)("API plantings cross-tenant RLS", () => {
  let users: TestUsers;
  let regionId: string;
  let fieldBId: string;
  let service: ReturnType<typeof createServiceRoleClient>;

  beforeAll(async () => {
    service = createServiceRoleClient();
    users = await createTestUsers();
    const region = await seedTestRegion(service, "API RLS Integration Warsaw");
    regionId = region.id;
    const fieldB = await seedFieldForUser(service, users.userB, regionId, "API User B Field");
    fieldBId = fieldB.id;
  });

  afterAll(async () => {
    await teardownTestUsers(users, [regionId]);
  });

  async function makeContextForUserA(path: string, init?: RequestInit) {
    const session = await signInTestUser(users.userA);
    const url = new URL(`http://localhost${path}`);
    const cookieHeader = [...session.cookieStore.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
    const headers = new Headers(init?.headers);
    if (cookieHeader) headers.set("Cookie", cookieHeader);
    if (init?.body) headers.set("Content-Type", "application/json");

    return {
      url,
      request: new Request(url.toString(), { ...init, headers }),
      cookies: createAstroCookies(session.cookieStore),
      locals: { user: { id: users.userA.id, email: users.userA.email } },
    };
  }

  it("GET /api/plantings?field_id=<B> returns 200 and empty array for User A", async () => {
    const context = await makeContextForUserA(`/api/plantings?field_id=${fieldBId}`, { method: "GET" });
    const response = await GET(context as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([]);
  });

  it("POST planting on User B field fails for User A", async () => {
    const context = await makeContextForUserA("/api/plantings", {
      method: "POST",
      body: JSON.stringify({
        field_id: fieldBId,
        plant_name: "Cross-tenant Tomato",
        cell_row: 2,
        cell_col: 2,
        seeding_date: "2026-06-01",
      }),
    });

    const response = await POST(context as any);
    expect(response.status).not.toBe(201);
  });
});
