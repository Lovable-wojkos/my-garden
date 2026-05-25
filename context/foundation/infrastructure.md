---
project: Garden Management App
version: 1
status: selected
created: 2026-05-20
researched_at: 2026-05-20
recommended_platform: Vercel
runner_up: null
context_type: greenfield
tech_stack: Astro 6 SSR + React 19 + Tailwind 4 + Supabase
---

## Platform Decision

**Vercel** is selected as the deployment platform for the Garden Management App MVP.

This decision is based on the tech stack selection (`context/foundation/tech-stack.md`), which specified Vercel as the deployment target. The Astro SSR + React stack is natively supported by Vercel with excellent developer experience and zero-configuration deployment.

## Why Vercel

- **Native Astro support**: Vercel has first-class support for Astro SSR with automatic framework detection
- **Supabase integration**: Server-side secrets (SUPABASE_URL, SUPABASE_ANON_KEY) can be configured via Vercel environment variables
- **Edge functions**: Background weather data pulls can run via Vercel Edge Functions or cron jobs
- **Preview deployments**: Automatic preview URLs for every pull request
- **Global CDN**: Built-in edge network for fast content delivery globally
- **Free tier**: Generous free tier suitable for MVP usage
- **GitHub integration**: Seamless CI/CD with automatic deployments on merge to master

## Operational Story

### Preview
- Automatic preview deployments on every pull request
- Preview URLs shareable for testing before production
- Branch-specific deployments for feature testing

### Secrets
Server-only environment variables (never exposed to client):
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase service role key (server-side)

Configure via:
1. Vercel dashboard: Project Settings → Environment Variables
2. CLI: `npx vercel env add SUPABASE_URL`

### Rollback
- One-click rollback via Vercel dashboard (Deployments tab)
- Instant reversion to previous production deployments
- Deployment history retained for 90 days on free tier

### Approval
- GitHub branch protection rules require PR review before merge
- Manual deployment approval can be enabled if needed
- Preview deployments require no approval

### Logs
- Real-time build logs in Vercel dashboard
- Function execution logs via Vercel Analytics (free tier limited)
- Serverless function logs available in dashboard

## Build Configuration

**Build command**: `npm run build`
**Output directory**: `dist/`
**Install command**: `npm install`
**Node version**: 22.14.0 (specified in `.nvmrc`)

Vercel automatically detects Astro configuration and applies appropriate build settings.

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Supabase secrets exposed via client code | High | Use `astro:env` for server-only secrets; never import in client components |
| Build fails due to missing env vars | Medium | Configure all required env vars in Vercel before first deployment |
| Background jobs timeout (weather pulls) | Low | Use Vercel Cron Jobs or external worker service for long-running tasks |
| Free tier limits exceeded | Low | Monitor usage; upgrade to Pro tier if limits approached |

## Deployment Checklist

- [ ] Create Vercel project (import from GitHub)
- [ ] Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables
- [ ] Set Node.js version to 22.14.0 in project settings
- [ ] Enable automatic deployments on merge to master
- [ ] Test preview deployment on a pull request
- [ ] Verify production build and runtime
- [ ] Configure custom domain (optional)
