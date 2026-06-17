export const prerender = false;

import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateFieldsRegionForUser } from "@/lib/services/fields";
import { findOrCreateRegion } from "@/lib/services/regions";
import { getUserPreferences, upsertUserPreferences } from "@/lib/services/user-preferences";

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "supabase_unavailable" }), { status: 503 });
  }

  const { data, error } = await getUserPreferences(supabase, user.id);
  if (error) {
    return new Response(JSON.stringify({ error: "database_error" }), { status: 500 });
  }
  if (!data) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "supabase_unavailable" }), { status: 503 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return new Response(JSON.stringify({ error: "body_must_be_object" }), { status: 400 });
  }

  const { city_name, latitude, longitude } = body as Record<string, unknown>;

  if (typeof city_name !== "string" || city_name.trim().length === 0) {
    return new Response(JSON.stringify({ error: "city_name must be a non-empty string" }), { status: 400 });
  }
  if (typeof latitude !== "number" || !Number.isFinite(latitude)) {
    return new Response(JSON.stringify({ error: "latitude must be a finite number" }), { status: 400 });
  }
  if (typeof longitude !== "number" || !Number.isFinite(longitude)) {
    return new Response(JSON.stringify({ error: "longitude must be a finite number" }), { status: 400 });
  }

  const { data: region, error: regionError } = await findOrCreateRegion(supabase, {
    latitude,
    longitude,
    displayName: city_name.trim(),
  });

  if (regionError || !region) {
    return new Response(JSON.stringify({ error: "database_error" }), { status: 500 });
  }

  const { data, error } = await upsertUserPreferences(supabase, {
    user_id: user.id,
    city_name: city_name.trim(),
    latitude,
    longitude,
    region_id: region.id,
  });

  if (error) {
    return new Response(JSON.stringify({ error: "database_error" }), { status: 500 });
  }

  const { error: fieldsError } = await updateFieldsRegionForUser(supabase, user.id, region.id);
  if (fieldsError) {
    return new Response(JSON.stringify({ error: "database_error" }), { status: 500 });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
