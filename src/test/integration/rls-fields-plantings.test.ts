import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getFieldById, updateField } from "@/lib/services/fields";
import { createPlanting, deletePlanting, getPlantingsByField, updatePlanting } from "@/lib/services/plantings";
import { requireLocalSupabase } from "@/test/integration/setup";
import {
  createServiceRoleClient,
  createTestUsers,
  seedFieldForUser,
  seedPlantingForUser,
  seedTestRegion,
  signInTestUser,
  teardownTestUsers,
  type TestUsers,
} from "@/test/integration/helpers/supabase";

const supabaseAvailable = await requireLocalSupabase();

describe.skipIf(!supabaseAvailable)("RLS fields and plantings", () => {
  let users: TestUsers;
  let regionId: string;
  let fieldBId: string;
  let plantingBId: string;
  let service: ReturnType<typeof createServiceRoleClient>;

  beforeAll(async () => {
    service = createServiceRoleClient();
    users = await createTestUsers();
    const region = await seedTestRegion(service, "RLS Integration Warsaw");
    regionId = region.id;

    const fieldB = await seedFieldForUser(service, users.userB, regionId, "User B Secret Field");
    fieldBId = fieldB.id;
    const plantingB = await seedPlantingForUser(service, users.userB, fieldBId, {
      plant_name: "User B Tomato",
    });
    plantingBId = plantingB.id;
  });

  afterAll(async () => {
    await teardownTestUsers(users, [regionId]);
  });

  it("User A cannot SELECT User B field by id", async () => {
    const session = await signInTestUser(users.userA);
    const { data, error } = await getFieldById(session.client, fieldBId);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("User A sees empty plantings for User B field", async () => {
    const session = await signInTestUser(users.userA);
    const { data, error } = await getPlantingsByField(session.client, fieldBId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("User A cannot UPDATE User B field", async () => {
    const session = await signInTestUser(users.userA);
    const { data, error } = await updateField(session.client, fieldBId, { name: "Hijacked" });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("User A cannot DELETE User B planting", async () => {
    const session = await signInTestUser(users.userA);
    const { error } = await deletePlanting(session.client, plantingBId);
    expect(error).toBeNull();

    const { data: stillThere } = await service.from("plantings").select("id").eq("id", plantingBId).single();
    expect(stillThere?.id).toBe(plantingBId);
  });

  it("User A cannot INSERT planting on User B field", async () => {
    const session = await signInTestUser(users.userA);
    const { data, error } = await createPlanting(session.client, {
      field_id: fieldBId,
      user_id: users.userA.id,
      plant_name: "Sneaky Plant",
      cell_row: 1,
      cell_col: 1,
      seeding_date: "2026-06-01",
    });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("User A cannot UPDATE User B planting", async () => {
    const session = await signInTestUser(users.userA);
    const { data, error } = await updatePlanting(session.client, plantingBId, { plant_name: "Stolen" });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("User A cannot transfer own field ownership to User B", async () => {
    const fieldA = await seedFieldForUser(service, users.userA, regionId, "User A Field");
    const session = await signInTestUser(users.userA);
    const { data, error } = await updateField(session.client, fieldA.id, { user_id: users.userB.id });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});
