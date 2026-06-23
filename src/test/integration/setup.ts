let supabaseAvailable: boolean | null = null;

/**
 * Returns true when SUPABASE_URL responds and required keys are present.
 * Result is cached for the Vitest worker process.
 */
export async function isLocalSupabaseAvailable(): Promise<boolean> {
  if (supabaseAvailable !== null) return supabaseAvailable;

  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    supabaseAvailable = false;
    return false;
  }

  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(5_000),
    });
    supabaseAvailable = response.ok;
  } catch {
    supabaseAvailable = false;
  }

  return supabaseAvailable;
}

/** Skip guard for integration specs — call once at file top with describe.skipIf. */
export async function requireLocalSupabase(): Promise<boolean> {
  return isLocalSupabaseAvailable();
}
