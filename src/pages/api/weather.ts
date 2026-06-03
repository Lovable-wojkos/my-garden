export const prerender = false;

import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { getWeather } from "@/lib/services/open-meteo";

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "supabase_unavailable" }), { status: 503 });
  }

  const url = new URL(context.request.url);
  const latStr = url.searchParams.get("lat");
  const lngStr = url.searchParams.get("lng");

  if (!latStr || !lngStr) {
    return new Response(JSON.stringify({ error: "lat and lng query params are required" }), { status: 400 });
  }

  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return new Response(JSON.stringify({ error: "lat and lng must be numeric" }), { status: 400 });
  }

  try {
    const weatherData = await getWeather(lat, lng);
    return new Response(JSON.stringify(weatherData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "upstream_unavailable" }), { status: 502 });
  }
};
