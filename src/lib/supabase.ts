import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "astro:env/server";

/**
 * Create a Supabase SSR client bound to the current request's cookies.
 * Returns null when SUPABASE_URL or SUPABASE_ANON_KEY is not configured
 * (e.g. local dev before .env is set up). All callers must null-check before
 * passing the result to service functions.
 */
export function createClient(requestHeaders: Headers, cookies: AstroCookies) {
  const url = SUPABASE_URL;
  const key = SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(requestHeaders.get("Cookie") ?? "").map(({ name, value }) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
