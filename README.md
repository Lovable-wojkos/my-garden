# My Garden

A gardening companion app for tracking fields, plantings, and weather.

## Tech Stack

- [Astro](https://astro.build/) v6 - Server-side rendering
- [React](https://react.dev/) v19 - Interactive UI components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type safety
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS
- [Supabase](https://supabase.com/) - Auth, database, and storage
- [Vercel](https://vercel.com/) - Deployment and cron jobs

## Prerequisites

- Node.js v22.14.0 (see `.nvmrc`)
- npm (comes with Node.js)
- [Docker](https://www.docker.com/) for local Supabase (optional)

## Getting Started

1. Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd my-garden
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
```

3. Configure Supabase — see [Supabase Configuration](#supabase-configuration) below.

4. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` — Start development server
- `npm run build` — Production build (SSR via `@astrojs/vercel`)
- `npm run preview` — Preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — Auto-fix ESLint issues
- `npm run format` — Prettier

## Project Structure

```
src/
├── components/       # Astro & React components
│   └── ui/           # shadcn/ui components
├── lib/
│   ├── services/     # Business logic
│   └── supabase.ts   # Supabase client
├── pages/
│   ├── api/          # API endpoints
│   │   └── cron/     # Vercel cron handlers
│   ├── auth/         # Auth pages
│   └── dashboard/    # Protected pages
├── middleware.ts      # Auth middleware
└── types.ts          # Shared types
supabase/
└── migrations/       # SQL migrations
```

## Supabase Configuration

Environment variables are declared via Astro's `astro:env` schema and treated as **server-only secrets**.

### Local development (Docker)

1. Start the local Supabase stack:

```bash
npx supabase start
```

2. Copy the credentials printed by the CLI into `.env`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

3. Apply migrations:

```bash
npx supabase db reset
```

Studio UI is available at `http://localhost:54323`.

### Cloud Supabase project

Add these to your `.env`:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | `anon` public key from Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key — **keep secret**, used by cron jobs only |

### Auth routes

| Route | Description |
|-------|-------------|
| `/auth/signin` | Email-only magic-link sign-in |
| `/auth/check-email` | Post-submit "check your inbox" page |
| `/auth/callback` | Magic-link callback (session exchange) |
| `/auth/signup` | Redirects to `/auth/signin` (bookmark compatibility) |
| `/dashboard` | Protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to `PROTECTED_ROUTES` to require authentication.

### Magic link — Supabase URL configuration

Magic-link emails redirect to `{SITE_URL}/auth/callback`. If Supabase **Site URL** or **Redirect URLs** are wrong, the link may land on an unrelated page (e.g. Vercel signup from a starter placeholder).

**Local Supabase** (`npx supabase start`):

1. Emails appear in **Inbucket** (URL printed by `supabase start`), not your real inbox.
2. After changing `supabase/config.toml`, restart: `npx supabase stop && npx supabase start`.
3. Set `SITE_URL=http://localhost:4321` in `.env`.

**Hosted Supabase** (cloud project in `.env`):

1. Dashboard → **Authentication** → **URL Configuration**
2. **Site URL**: `http://localhost:4321` while developing locally (or your production URL when deployed)
3. **Redirect URLs** — add both:
   - `http://localhost:4321/auth/callback`
   - `http://127.0.0.1:4321/auth/callback`
   - (production) `https://<your-domain>/auth/callback`
4. Set `SITE_URL` in `.env` to the same origin you use in the browser (e.g. `http://localhost:4321`).

Remove any placeholder Vercel starter URL from Site URL unless that deployment actually exists.

## Deployment (Vercel)

1. Install the Vercel CLI and log in:

```bash
npm i -g vercel
vercel login
```

2. Deploy:

```bash
vercel deploy --prod
```

3. Set environment variables in Vercel dashboard → Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for cron jobs) |
| `CRON_SECRET` | Random secret for securing cron endpoints (see below) |

## Cron Jobs

A daily weather sync runs at midnight UTC via Vercel Cron. The schedule is defined in [`vercel.json`](vercel.json).

### Setup

1. Generate a secret:

```bash
openssl rand -hex 32
```

2. Add `CRON_SECRET` to Vercel environment variables (and locally to `.env`).

3. Vercel automatically passes `Authorization: Bearer <CRON_SECRET>` when invoking crons.

### Monitoring

- Vercel dashboard → your project → **Settings → Cron Jobs** — view schedule and trigger manually with "Run Now"
- Vercel dashboard → **Logs** — filter by `/api/cron/weather` to see invocation history

### Manual trigger (for testing)

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-app>.vercel.app/api/cron/weather
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs lint + build on every push and PR to `master`. Configure these as repository secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## License

MIT
