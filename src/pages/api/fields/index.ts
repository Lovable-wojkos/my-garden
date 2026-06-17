import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { createField } from "@/lib/services/fields";
import { getUserPreferences } from "@/lib/services/user-preferences";

export const prerender = false;

const CreateFieldSchema = z.object({
  name: z.string().min(1).max(50),
  cols: z.number().int().min(1).max(20),
  rows: z.number().int().min(1).max(20),
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

  const parsed = CreateFieldSchema.safeParse(body);
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

  const { data: prefs } = await getUserPreferences(supabase, user.id);
  if (!prefs?.region_id) {
    return new Response(JSON.stringify({ error: "location_required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await createField(supabase, {
    name: parsed.data.name,
    cols: parsed.data.cols,
    rows: parsed.data.rows,
    region_id: prefs.region_id,
    user_id: user.id,
  });

  if (error) {
    if (error.code === "23503") {
      return new Response(
        JSON.stringify({
          errors: {
            region_id: ["Selected region is invalid."],
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ error: "Failed to create field" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ id: data.id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
