import type { AstroCookies } from "astro";
import { logAuthError, signInErrorRedirect } from "@/lib/auth/errors";
import { pl } from "@/lib/copy/pl";
import { createClient } from "@/lib/supabase";

const ALLOWED_OTP_TYPES = new Set(["email", "magiclink", "signup"]);

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
    return { redirect: signInErrorRedirect(pl.auth.errors.notConfigured) };
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logAuthError("callback:pkce", error);
      return { redirect: signInErrorRedirect(pl.auth.errors.callbackFailed) };
    }
    return { redirect: "/dashboard" };
  }

  if (tokenHash && type) {
    if (!ALLOWED_OTP_TYPES.has(type)) {
      return { redirect: signInErrorRedirect(pl.auth.errors.callbackFailed) };
    }

    // Supabase verifyOtp token_hash flow uses type "email" (magiclink/signup types are deprecated).
    const verifyType = type === "magiclink" || type === "signup" ? "email" : type;
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: verifyType as "email" | "invite" | "recovery" | "email_change",
    });
    if (error) {
      logAuthError("callback:verify-otp", error);
      return { redirect: signInErrorRedirect(pl.auth.errors.callbackFailed) };
    }
    return { redirect: "/dashboard" };
  }

  return { redirect: signInErrorRedirect(pl.auth.errors.invalidLink) };
}
