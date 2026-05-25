---
project: Garden Management App
deployment_target: Vercel
created: 2026-05-20
status: pending
---

# Vercel Deployment Plan

## Pre-requisites

### Manual Setup Gates

1. **Vercel Account**
   - Create account at https://vercel.com
   - Install Vercel CLI: `npm i -g vercel` (optional but recommended)

2. **Supabase Project**
   - Create Supabase project at https://supabase.com
   - Obtain project URL and service role key from Supabase dashboard
   - Run migrations: `supabase db push` (if not already done)

3. **GitHub Repository**
   - Repository must be public or private with Vercel GitHub integration
   - Ensure repository has proper access permissions

## Automated Steps (Agent-Owned)

### Step 1: Install Vercel CLI and Login

```bash
npm i -g vercel
vercel login
```

### Step 2: Initialize Vercel Project

```bash
vercel
```

Follow prompts:
- Link to existing project? No
- Project name: garden-management-app (or custom)
- Directory: ./ (current directory)
- Override settings? No

Vercel will auto-detect:
- Framework: Astro
- Build command: `npm run build`
- Output directory: `dist/`
- Install command: `npm install`

### Step 3: Configure Environment Variables

**Option A: Via CLI (recommended for first deployment)**

```bash
vercel env add SUPABASE_URL
# Enter your Supabase project URL
# Select: Production, Preview, Development (add to all)

vercel env add SUPABASE_ANON_KEY
# Enter your Supabase service role key (anon key is insufficient for server-side)
# Select: Production, Preview, Development (add to all)
```

**Option B: Via Vercel Dashboard**

1. Go to Project Settings → Environment Variables
2. Add `SUPABASE_URL` (production value)
3. Add `SUPABASE_ANON_KEY` (production value)
4. Add same variables for Preview and Development environments

### Step 4: Configure Node.js Version

Vercel should auto-detect from `.nvmrc`, but verify:

**Via CLI:**
```bash
vercel env add NODE_VERSION
# Enter: 22.14.0
# Select: Production, Preview, Development
```

**Or via Vercel Dashboard:**
- Project Settings → General → Node.js Version: 22.14.0

### Step 5: Deploy to Production

```bash
vercel --prod
```

This will:
- Build the project with `npm run build`
- Deploy to Vercel edge network
- Provide production URL (e.g., https://garden-management-app.vercel.app)

### Step 6: Enable GitHub Integration (Optional but Recommended)

1. Go to Vercel dashboard → Project Settings → Git
2. Connect GitHub repository
3. Enable automatic deployments on push to `master` branch
4. Enable preview deployments for all pull requests

## Verification Steps

### 1. Build Verification

After deployment, verify the build succeeded:
- Check Vercel dashboard for green checkmark
- Review build logs for any errors
- Ensure no missing environment variables

### 2. Runtime Verification

Test the deployed application:
- Visit production URL
- Test authentication flow (magic link login)
- Verify Supabase connection works
- Test core user flow (create field, add plants, view weather)

### 3. Environment Variable Verification

Ensure secrets are not exposed to client:
- Open browser DevTools → Network tab
- Check that SUPABASE_ANON_KEY is not in any client-side bundle
- Verify server-side requests use the service role key

### 4. Preview Deployment Verification

If GitHub integration enabled:
- Create a test branch
- Push a small change
- Verify preview deployment URL is generated
- Test preview environment with separate data

## Rollback Procedure

If deployment fails or issues are discovered:

**Via Vercel Dashboard:**
1. Go to Deployments tab
2. Find previous successful deployment
3. Click "..." → "Promote to Production"

**Via CLI:**
```bash
vercel rollback
```

## Post-Deployment Configuration

### Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add custom domain
3. Configure DNS records as instructed by Vercel

### Monitoring

- Enable Vercel Analytics (free tier available)
- Set up error tracking (e.g., Sentry) if needed
- Monitor build logs for any recurring issues

## Known Limitations

- **Background jobs**: Weather data pulls need Vercel Cron Jobs or external worker service
- **Function timeout**: Serverless functions have 10-60 second timeout limits (depending on plan)
- **Free tier limits**: 100GB bandwidth, 6,000 minutes of execution per month

## Success Criteria

Deployment is successful when:
- [ ] Production build completes without errors
- [ ] Application loads at production URL
- [ ] Authentication flow works (magic link)
- [ ] Supabase database connection succeeds
- [ ] Core user flow (field creation, plant selection, weather view) functions
- [ ] Environment variables are not exposed to client
- [ ] Preview deployments work (if GitHub integration enabled)

## Next Steps After Deployment

1. Monitor application for first 24-48 hours
2. Set up Supabase backups
3. Configure background job for weather data pulls (Vercel Cron or external service)
4. Consider error tracking integration
5. Plan for custom domain setup
