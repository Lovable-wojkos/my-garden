import type { APIRoute } from "astro";
import { SITE_URL } from "astro:env/server";
import { createClient } from "@/lib/supabase";

function resolveAppOrigin(requestUrl: string): string {
  if (SITE_URL) {
    return SITE_URL.replace(/\/$/, "");
  }
  return new URL(requestUrl).origin;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const origin = resolveAppOrigin(context.request.url);
  const emailRedirectTo = `${origin}/auth/callback`;

  if (import.meta.env.DEV) {
    console.log("[magic-link] emailRedirectTo:", emailRedirectTo, "| SITE_URL:", SITE_URL ?? "(not set, using request origin)");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  const checkEmailUrl = import.meta.env.DEV
    ? `/auth/check-email?dev_redirect=${encodeURIComponent(emailRedirectTo)}`
    : "/auth/check-email";

  return context.redirect(checkEmailUrl);
};
