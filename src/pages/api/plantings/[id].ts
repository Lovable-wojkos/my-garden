import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { deletePlanting, getPlantingById, updatePlanting } from "@/lib/services/plantings";

export const prerender = false;

const UpdatePlantingSchema = z.object({
  plant_id: z.uuid().nullable().optional(),
  plant_name: z.string().min(1).max(100).nullable().optional(),
  seeding_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const PATCH: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = context.params;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Database not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = UpdatePlantingSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "general");
      (errors[key] ??= []).push(issue.message);
    }
    return new Response(JSON.stringify({ errors }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: existing, error: fetchError } = await getPlantingById(supabase, id);
  if (fetchError) {
    return new Response(JSON.stringify({ error: "Planting not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existing.user_id !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await updatePlanting(supabase, id, parsed.data);
  if (error) {
    return new Response(JSON.stringify({ error: "Failed to update planting" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = context.params;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Database not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: existing, error: fetchError } = await getPlantingById(supabase, id);
  if (fetchError) {
    return new Response(JSON.stringify({ error: "Planting not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existing.user_id !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await deletePlanting(supabase, id);
  if (error) {
    return new Response(JSON.stringify({ error: "Failed to delete planting" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, { status: 204 });
};
