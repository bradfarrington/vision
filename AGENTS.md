<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working practices

Brad switches between machines frequently. **The git repo is the single source of truth** — every decision, plan, or discussion outcome worth keeping must be written into this repo (this file for agent rules/decisions, or `docs/`) and committed + pushed in the same session it was made. Never leave important context only in machine-level agent memory, local settings, or an uncommitted working tree.

# Vision CRM — project decisions

See `design_handoff_vision_crm/README.md` (architecture, theming, design system) and `design_handoff_vision_crm/TASKS.md` (phased build plan) — these are the source of truth for the build.

## Backend & multi-tenant security — decided 2026-07-21

Backend is **Supabase** (Postgres + Auth + Data API). Multi-tenancy is the model from the handoff: single database, shared `public` schema, `company_id` on every tenant-owned row. Enforcement decisions:

- **RLS is the enforcement layer, Supabase-native.** Each user's `company_id` (and role) is stamped into their JWT `app_metadata` by a custom access-token hook (`public.custom_access_token_hook`). RLS policies on every tenant table compare `company_id` against `public.current_company_id()`, which reads `auth.jwt() -> 'app_metadata' ->> 'company_id'`. We do NOT use the handoff's raw-Postgres `SET LOCAL app.company_id` pattern — it fights Supabase's Data API/Realtime.
- **Every table in `public` has RLS enabled** (Supabase exposes `public` via the Data API; RLS-off = readable with the anon key). Tenant tables get the tenant-isolation policy; global tables (`companies` catalog, platform-admin data) get explicit admin-only policies.
- **`company_id` is `NOT NULL` + FK → `companies.id` + indexed** on every tenant table (the handoff `schema.ts` had it nullable with no FK — fixed during the port).
- **Data access uses `@supabase/ssr`** server clients carrying the user's session, so RLS applies to every query. **Drizzle is dropped** (the handoff suggested it, but it predates the Supabase decision; an ORM connecting as a privileged role would bypass RLS). TS types come from `supabase gen types`.
- **Auth**: Supabase Auth + a `public.users` profile row per `auth.users`, carrying `company_id` + role. Tenant ID is only ever read from the JWT — never from request body/params.
- **Schema lives in git** as Supabase CLI migrations under `supabase/migrations/`; the dashboard is not used to make schema changes. Build order: Wave 1 = isolation foundation + `customers`/`leads` slice + isolation test; Wave 2 = fan the same RLS treatment out to the remaining tables.

## AI website builder (future phase) — decided 2026-07-20

Tenants will build websites with AI inside the CRM and publish them to Vercel:

- **One Vercel project per tenant website, with its own deployments.** Do NOT use a shared multi-tenant sites app — this was considered and explicitly rejected.
- All Vercel interaction (project creation, deploys, custom domains, SSL) happens headlessly from the CRM backend via the Vercel REST API. Tenants must never see the Vercel dashboard or be redirected to Vercel.
- SEO split: the CRM itself must be noindexed and invisible to search engines; tenant websites must be SEO-first and rank on Google (custom domains, server-rendered HTML, per-site sitemaps/robots, LocalBusiness JSON-LD).
- Open question (deliberately deferred): where generated site code is stored — likely AI-generated files stored per-site in the CRM's storage (bucket/DB, versioned) and pushed to the tenant's Vercel project on each publish. Decide when the builder phase starts.
