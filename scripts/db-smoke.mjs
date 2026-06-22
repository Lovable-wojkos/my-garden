#!/usr/bin/env node

import pg from "pg";

// Import fixtures
const { EXPECTED_CATALOG } = await import("../src/test/fixtures/expected-catalog.ts");
const { EXPECTED_REGIONS } = await import("../src/test/fixtures/expected-regions.ts");

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function runSmoke() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to Postgres");

    let passed = 0;
    let failed = 0;

    // 1. Check required tables exist
    console.log("\nChecking required tables...");
    const requiredTables = ["regions", "plants", "fields", "plantings", "weather_records", "user_preferences"];

    for (const table of requiredTables) {
      const result = await client.query(
        `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        );
      `,
        [table],
      );

      if (result.rows[0].exists) {
        console.log(`  ✓ Table "${table}" exists`);
        passed++;
      } else {
        console.error(`  ✗ Table "${table}" missing`);
        failed++;
      }
    }

    // 2. Check plant_requests does NOT exist
    console.log("\nChecking deleted tables...");
    const result = await client.query(
      `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'plant_requests'
      );
    `,
    );

    if (!result.rows[0].exists) {
      console.log(`  ✓ Table "plant_requests" successfully dropped`);
      passed++;
    } else {
      console.error(`  ✗ Table "plant_requests" still exists (should be dropped)`);
      failed++;
    }

    // 3. Verify regions count and content
    console.log("\nVerifying regions...");
    const regionsResult = await client.query("SELECT code, name FROM regions ORDER BY code");
    const dbRegions = regionsResult.rows;

    if (dbRegions.length === 16) {
      console.log(`  ✓ Found 16 regions`);
      passed++;
    } else {
      console.error(`  ✗ Expected 16 regions, found ${dbRegions.length}`);
      failed++;
    }

    // Check each expected region exists with correct name
    let regionsMatch = true;
    for (const expected of EXPECTED_REGIONS) {
      const found = dbRegions.find((r) => r.code === expected.code);
      if (!found) {
        console.error(`  ✗ Region "${expected.code}" not found in database`);
        regionsMatch = false;
        failed++;
      } else if (found.name !== expected.name) {
        console.error(`  ✗ Region "${expected.code}": expected name "${expected.name}", got "${found.name}"`);
        regionsMatch = false;
        failed++;
      }
    }

    if (regionsMatch && dbRegions.length === EXPECTED_REGIONS.length) {
      console.log(`  ✓ All regions match by code and name`);
      passed++;
    }

    // 4. Verify global plants count and content
    console.log("\nVerifying global plants...");
    const plantsResult = await client.query(`
      SELECT name, growth_days, watering_needs, status
      FROM plants
      WHERE status = 'global'
      ORDER BY name
    `);
    const dbPlants = plantsResult.rows;

    if (dbPlants.length === 10) {
      console.log(`  ✓ Found 10 global plants`);
      passed++;
    } else {
      console.error(`  ✗ Expected 10 global plants, found ${dbPlants.length}`);
      failed++;
    }

    // Check each expected plant exists with correct attributes
    let plantsMatch = true;
    for (const expected of EXPECTED_CATALOG) {
      const found = dbPlants.find((p) => p.name === expected.name);
      if (!found) {
        console.error(`  ✗ Plant "${expected.name}" not found in database`);
        plantsMatch = false;
        failed++;
      } else if (
        found.growth_days !== expected.growth_days ||
        found.watering_needs !== expected.watering_needs ||
        found.status !== "global"
      ) {
        console.error(`  ✗ Plant "${expected.name}": mismatch in attributes`);
        console.error(
          `    Expected: growth_days=${expected.growth_days}, watering_needs=${expected.watering_needs}, status=global`,
        );
        console.error(
          `    Got:      growth_days=${found.growth_days}, watering_needs=${found.watering_needs}, status=${found.status}`,
        );
        plantsMatch = false;
        failed++;
      }
    }

    if (plantsMatch && dbPlants.length === EXPECTED_CATALOG.length) {
      console.log(`  ✓ All plants match by name and attributes`);
      passed++;
    }

    // Summary
    console.log(`\n${"=".repeat(50)}`);
    console.log(`Smoke test summary: ${passed} passed, ${failed} failed`);
    console.log(`${"=".repeat(50)}\n`);

    await client.end();
    return failed === 0 ? 0 : 1;
  } catch (error) {
    console.error("Error running smoke test:", error);
    await client.end();
    return 1;
  }
}

const exitCode = await runSmoke();
process.exit(exitCode);
