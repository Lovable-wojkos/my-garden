import type { APIRoute } from "astro";
import { z } from "zod";
import { logAuthError, signInErrorRedirect } from "@/lib/auth/errors";
import { isSameOriginRequest, resolveAppOrigin } from "@/lib/auth/origin";
import { pl } from "@/lib/copy/pl";
import { createClient } from "@/lib/supabase";

const MagicLinkSchema = z.object({
  email: z.preprocess((val) => (typeof val === "string" ? val.trim() : val), z.email()),
});

export const POST: APIRoute = async (context) => {
  const appOrigin = resolveAppOrigin(context.request.url);
  if (!isSameOriginRequest(context.request, appOrigin)) {
    return context.redirect(signInErrorRedirect(pl.auth.errors.sendFailed));
  }

  const form = await context.request.formData();
  const parsed = MagicLinkSchema.safeParse({ email: form.get("email") });

  if (!parsed.success) {
    return context.redirect(signInErrorRedirect(pl.auth.errors.emailInvalid));
  }

  const { email } = parsed.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(signInErrorRedirect(pl.auth.errors.notConfigured));
  }

  const emailRedirectTo = `${appOrigin}/auth/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    logAuthError("magic-link", error);
    return context.redirect(signInErrorRedirect(pl.auth.errors.sendFailed));
  }

  const checkEmailUrl = import.meta.env.DEV
    ? `/auth/check-email?dev_redirect=${encodeURIComponent(emailRedirectTo)}`
    : "/auth/check-email";

  return context.redirect(checkEmailUrl);
};
