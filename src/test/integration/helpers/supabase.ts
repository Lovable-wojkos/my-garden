import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import type { FieldRow, PlantingRow, RegionRow } from "@/types";

const TEST_PASSWORD = "integration-test-password-do-not-use";

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export interface TestUsers {
  userA: TestUser;
  userB: TestUser;
}

export interface TestSession {
  client: SupabaseClient;
  cookieStore: Map<string, string>;
}

const WARSAW_LAT = 52.229676;
const WARSAW_LNG = 21.012229;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for integration tests`);
  }
  return value;
}

export function createServiceRoleClient(): SupabaseClient {
  return createSupabaseClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function uniqueEmail(label: string): string {
  return `integration-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function createAuthUser(service: SupabaseClient, email: string): Promise<TestUser> {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create test user ${email}: ${error?.message ?? "missing user"}`);
  }

  return { id: data.user.id, email, password: TEST_PASSWORD };
}

export async function createTestUsers(): Promise<TestUsers> {
  const service = createServiceRoleClient();
  const userA = await createAuthUser(service, uniqueEmail("a"));
  const userB = await createAuthUser(service, uniqueEmail("b"));
  return { userA, userB };
}

export async function signInTestUser(user: TestUser): Promise<TestSession> {
  const cookieStore = new Map<string, string>();
  const client = createServerClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return [...cookieStore.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          cookieStore.set(name, value);
        }
      },
    },
  });

  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error) {
    throw new Error(`Failed to sign in ${user.email}: ${error.message}`);
  }

  return { client, cookieStore };
}

export function createAstroCookies(cookieStore: Map<string, string>): AstroCookies {
  return {
    get(name: string) {
      const value = cookieStore.get(name);
      return value !== undefined ? { value } : undefined;
    },
    set(name: string, value: string) {
      cookieStore.set(name, value);
    },
    delete(name: string) {
      cookieStore.delete(name);
    },
    merge() {},
    headers() {
      return new Headers();
    },
  } as AstroCookies;
}

export async function seedTestRegion(
  service: SupabaseClient,
  displayName = "Integration Test Warsaw",
): Promise<RegionRow> {
  const { data, error } = await service
    .from("regions")
    .upsert(
      {
        latitude: WARSAW_LAT,
        longitude: WARSAW_LNG,
        display_name: displayName,
      },
      { onConflict: "latitude,longitude" },
    )
    .select("*")
    .single<RegionRow>();

  if (error || !data) {
    throw new Error(`Failed to seed test region: ${error?.message ?? "missing row"}`);
  }

  return data;
}

export async function seedFieldForUser(
  service: SupabaseClient,
  user: TestUser,
  regionId: string,
  name = "Integration Test Field",
): Promise<FieldRow> {
  const { data, error } = await service
    .from("fields")
    .insert({
      user_id: user.id,
      name,
      cols: 4,
      rows: 4,
      region_id: regionId,
    })
    .select("*")
    .single<FieldRow>();

  if (error || !data) {
    throw new Error(`Failed to seed field for ${user.email}: ${error?.message ?? "missing row"}`);
  }

  return data;
}

export async function seedPlantingForUser(
  service: SupabaseClient,
  user: TestUser,
  fieldId: string,
  overrides: Partial<{ cell_row: number; cell_col: number; plant_name: string; seeding_date: string }> = {},
): Promise<PlantingRow> {
  const { data, error } = await service
    .from("plantings")
    .insert({
      field_id: fieldId,
      user_id: user.id,
      plant_name: overrides.plant_name ?? "Test Tomato",
      cell_row: overrides.cell_row ?? 0,
      cell_col: overrides.cell_col ?? 0,
      seeding_date: overrides.seeding_date ?? "2026-06-01",
    })
    .select("*")
    .single<PlantingRow>();

  if (error || !data) {
    throw new Error(`Failed to seed planting: ${error?.message ?? "missing row"}`);
  }

  return data;
}

export async function teardownTestUsers(users: TestUsers, regionIds: string[] = []): Promise<void> {
  const service = createServiceRoleClient();
  const userIds = [users.userA.id, users.userB.id];

  await service.from("plantings").delete().in("user_id", userIds);
  await service.from("fields").delete().in("user_id", userIds);

  if (regionIds.length > 0) {
    await service.from("weather_records").delete().in("region_id", regionIds);
    await service.from("regions").delete().in("id", regionIds);
  }

  for (const userId of userIds) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error(`Failed to delete test user ${userId}: ${error.message}`);
    }
  }
}
