import type { APIRoute } from "astro";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase";
import { approvePlant, rejectPlant } from "@/lib/services/plants";

export const prerender = false;

const ApproveSchema = z.object({
  growth_days: z.number().int().min(1),
  watering_needs: z.string().optional(),
});

function adminGuard(context: Parameters<APIRoute>[0]) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (context.locals.user?.app_metadata?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

function serviceClientOrError() {
  const client = createServiceRoleClient();
  if (client === null) {
    return {
      client: null,
      errorResponse: new Response(JSON.stringify({ error: "Service unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  return { client, errorResponse: null };
}

export const PATCH: APIRoute = async (context) => {
  const guard = adminGuard(context);
  if (guard) return guard;

  const { client, errorResponse } = serviceClientOrError();
  if (errorResponse) return errorResponse;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ errors: { general: ["Invalid JSON"] } }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "general");
      (errors[key] ??= []).push(issue.message);
    }
    return new Response(JSON.stringify({ errors }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = context.params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing plant ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await approvePlant(client, id, parsed.data);
  if (error) {
    return new Response(JSON.stringify({ error: "Failed to approve plant" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!data) {
    return new Response(JSON.stringify({ error: "Pending plant not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ plant: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async (context) => {
  const guard = adminGuard(context);
  if (guard) return guard;

  const { client, errorResponse } = serviceClientOrError();
  if (errorResponse) return errorResponse;

  const id = context.params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing plant ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await rejectPlant(client, id);
  if (error) {
    return new Response(JSON.stringify({ error: "Failed to reject plant" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!data) {
    return new Response(JSON.stringify({ error: "Pending plant not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
