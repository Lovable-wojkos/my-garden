# Vercel Cron Job Research for Nightly Weather Job Scaffold

This document outlines the findings and design considerations for implementing the Vercel Cron Job to pull nightly weather data.

## 1. Configuration (vercel.json)

A `vercel.json` file must be created or updated at the root of the project to declare the cron schedule:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/nightly-weather",
      "schedule": "0 2 * * *"
    }
  ]
}
```

## 2. Astro API Route Handler (src/pages/api/cron/nightly-weather.ts)

Astro is configured for SSR, meaning API routes handle incoming requests dynamically. The endpoint should implement security verification and trigger the data fetch service:

```typescript
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Fetch coordinates of active regions from Supabase
    // 2. Request weather history from Open-Meteo for those coordinates
    // 3. Batch upsert measurements to the weather_records table

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

## 3. Key Constraints & Platform Behaviors

- **Hobby Plan Limits**: On Vercel's Hobby tier, cron jobs can run at most once per day. Deployments with more frequent expressions will fail.
- **Hobby Invocation Window**: Invocations on Hobby plans are randomized within the specified hour (e.g., `0 2 * * *` triggers anytime between 02:00:00 and 02:59:59 UTC).
- **Idempotency**: Due to potential duplicate event delivery in event-driven systems, the DB write operations must use Supabase upserts based on `(region_id, recorded_at)` constraints to ensure runs are idempotent.
- **Concurrency & Duration**: If the job runtime exceeds the invocation frequency, concurrent execution might occur. For a nightly job on the Hobby plan, this is highly unlikely, but the function duration is still bound by the standard Vercel Function execution timeout.
- **Redirect Handling**: Vercel cron calls do not follow 3xx HTTP redirects. The endpoint must directly respond with 200 OK or appropriate error codes.
- **Wired Environment Variable**: The `CRON_SECRET` variable must be added to Vercel's project configuration and is automatically appended as `Authorization: Bearer <secret>` on cron invocations.
