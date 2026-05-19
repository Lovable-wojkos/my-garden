---
starter_id: 10x-astro-starter
package_manager: npm
project_name: garden-management-app
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: true
---

## Why this stack

A solo gardener building a mobile-first garden management app in 3 weeks (after-hours) with magic link auth, nightly weather data pulls, and admin plant approval workflow needs a typed, convention-based starter that handles auth + database + deployment out of the box. Astro+Supabase+Cloudflare (deployed to Vercel) is the recommended default for `(web-app, js)` and passes all four agent-friendly gates: TypeScript end-to-end with Zod schemas, file-based routing conventions, popular in training data, and well-documented. Supabase provides PostgreSQL + auth + storage; background jobs run via edge functions or external workers. The 3-week timeline and solo context favor battle-tested over experimental.
