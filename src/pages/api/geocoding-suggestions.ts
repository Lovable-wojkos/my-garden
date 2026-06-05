export const prerender = false;

import type { APIRoute } from "astro";
import { geocodeCity } from "@/lib/services/open-meteo";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return new Response(JSON.stringify({ error: "query_too_short" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const results = await geocodeCity(q);
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "upstream_unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};
