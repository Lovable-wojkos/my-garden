// ⚠️ WARNING: MOCK VALUES FOR TESTING ONLY
// These values are injected via vitest.config.ts module resolution for astro:env/server.
// NEVER use these in production code. NEVER copy-paste into non-test files.

export const SUPABASE_URL = "http://localhost:54321";
export const SUPABASE_ANON_KEY = "test-anon-key-do-not-use-in-production";
export const SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-do-not-use-in-production";
export const CRON_SECRET = "test-cron-secret-do-not-use-in-production";

export const defineMiddleware = (fn: unknown) => fn;
