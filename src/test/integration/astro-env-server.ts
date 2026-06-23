// Integration tests read real keys from process.env (loaded in vitest.integration.config.ts / setup.ts).
// Do not use astro-virtual.ts mock values here.

function env(name: string): string {
  return process.env[name] ?? "";
}

export const SUPABASE_URL = env("SUPABASE_URL");
export const SUPABASE_ANON_KEY = env("SUPABASE_ANON_KEY");
export const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
export const CRON_SECRET = env("CRON_SECRET");
export const SITE_URL = env("SITE_URL") || "http://localhost:4321";

export const defineMiddleware = (fn: unknown) => fn;
