import type { APIRoute } from "astro";
import { createServiceRoleClient } from "@/lib/supabase";
import { getPendingPlants } from "@/lib/services/plants";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  if (context.locals.user?.app_metadata?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const serviceClient = createServiceRoleClient();
  if (!serviceClient) {
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await getPendingPlants(serviceClient);
  if (error) {
    return new Response(JSON.stringify({ error: "Failed to fetch pending plants" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ plants: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
