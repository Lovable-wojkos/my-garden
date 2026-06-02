import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { createField } from "@/lib/services/fields";

export const prerender = false;

const createFieldSchema = z.object({
  name: z.string().min(1).max(50),
  cols: z.number().int().min(1).max(20),
  rows: z.number().int().min(1).max(20),
  region_id: z.string().uuid()
});

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Supabase client not configured" }), { status: 500 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const result = createFieldSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: "Bad Request", details: result.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const data = result.data;

  const { data: field, error } = await createField(supabase, {
    name: data.name,
    cols: data.cols,
    rows: data.rows,
    region_id: data.region_id,
    user_id: user.id
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ id: field!.id }), { status: 201, headers: { "Content-Type": "application/json" } });
};
