import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

// PROTECTED_ROUTES: user-facing paths that require auth.
// /api/cron/* routes authenticate via x-vercel-cron header, NOT middleware — do not add them here.
const PROTECTED_ROUTES = [
  "/dashboard",
  "/admin",
  "/api/admin",
  "/api/weather",
  "/api/user-preferences",
  "/api/geocoding-suggestions",
  "/api/plantings",
  "/api/plant-requests",
];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
