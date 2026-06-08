import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { createPlanting, getPlantingsByField } from "@/lib/services/plantings";

export const prerender = false;

const GetPlantingsSchema = z.object({
  field_id: z.uuid(),
});

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const fieldId = context.url.searchParams.get("field_id");
  const parsed = GetPlantingsSchema.safeParse({ field_id: fieldId });
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Missing or invalid field_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Database not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await getPlantingsByField(supabase, parsed.data.field_id);
  if (error) {
    return new Response(JSON.stringify({ error: "Failed to fetch plantings" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

const CreatePlantingSchema = z
  .object({
    field_id: z.uuid(),
    plant_id: z.uuid().nullable().optional(),
    plant_name: z.string().min(1).max(100).nullable().optional(),
    cell_row: z.number().int().min(0),
    cell_col: z.number().int().min(0),
    seeding_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine((data) => data.plant_id != null || (data.plant_name != null && data.plant_name.trim().length > 0), {
    message: "Either plant_id or plant_name must be provided",
    path: ["plant_id"],
  });

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
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

  const parsed = CreatePlantingSchema.safeParse(body);
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

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Database not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await createPlanting(supabase, {
    ...parsed.data,
    user_id: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return new Response(JSON.stringify({ errors: { cell: ["This cell is already occupied."] } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Failed to create planting" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ id: data.id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
