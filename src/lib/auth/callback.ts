import type { AstroCookies } from "astro";
import { createClient } from "@/lib/supabase";

export async function handleAuthCallback(
  searchParams: URLSearchParams,
  headers: Headers,
  cookies: AstroCookies,
): Promise<{ redirect: string }> {
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = createClient(headers, cookies);
  if (!supabase) {
    return { redirect: `/auth/signin?error=${encodeURIComponent("Supabase is not configured")}` };
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { redirect: `/auth/signin?error=${encodeURIComponent(error.message)}` };
    }
    return { redirect: "/dashboard" };
  }

  if (tokenHash && type) {
    // Supabase verifyOtp token_hash flow uses type "email" (magiclink/signup types are deprecated).
    const verifyType = type === "magiclink" || type === "signup" ? "email" : type;
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: verifyType as "email" | "invite" | "recovery" | "email_change",
    });
    if (error) {
      return { redirect: `/auth/signin?error=${encodeURIComponent(error.message)}` };
    }
    return { redirect: "/dashboard" };
  }

  return { redirect: `/auth/signin?error=${encodeURIComponent("Invalid authentication link")}` };
}
