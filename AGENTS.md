<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working practices

Brad switches between machines frequently. **The git repo is the single source of truth** — every decision, plan, or discussion outcome worth keeping must be written into this repo (this file for agent rules/decisions, or `docs/`) and committed + pushed in the same session it was made. Never leave important context only in machine-level agent memory, local settings, or an uncommitted working tree.

# Vision CRM — project decisions

See `design_handoff_vision_crm/README.md` (architecture, theming, design system) and `design_handoff_vision_crm/TASKS.md` (phased build plan) — these are the source of truth for the build.

## UI build method & design fidelity — decided 2026-07-21

- **The designed screens are the visual source of truth.** `design_handoff_vision_crm/Vision CRM Screens.dc.html` (all screens) and `VisionSidebar.dc.html` are Claude-design exports. Each phase is built by **faithfully transcribing that screen's markup** — exact inline styles, SVG icon paths, measurements, colours — into React components on our stack (Next + shadcn + Tailwind), wired to live Supabase data.
- **Do NOT run the `.dc.html` runtime in production.** Those files render via a design-tool preview engine (`x-dc` / `DCLogic` / `_ds_bundle.js`); we port the HTML/CSS/SVG into JSX, not the engine.
- **Neutral palette = the screens' zinc ramp** (`#e7e7ea` hairline, `#a1a1aa` placeholder, `#f4f4f5` canvas, `#18181b` dark, `#71717a`/`#3f3f46` text, `#1a7f3e` success). The `_ds` token files ship a cooler graphite ramp that visibly diverges — **we follow the screens, not `_ds`.** Global tokens live in `src/app/globals.css`.
- **Vision blue `#2f7de1` is the accent slot only** and is tenant-themed: `--accent-blue`/`--primary`/`--ring` come from `companies.brand_color_1` via `src/lib/theme.ts` (`tenantThemeVars`), applied on the shell root. Semantic colours (success/warning/danger) are platform-fixed and never themed.
- **Topbar logo** defaults to `/vision-mark.png`; a tenant's own `company.logo_url` overrides it once upload lands.

## Backend & multi-tenant security — decided 2026-07-21

Backend is **Supabase** (Postgres + Auth + Data API). Multi-tenancy is the model from the handoff: single database, shared `public` schema, `company_id` on every tenant-owned row. Enforcement decisions:

- **RLS is the enforcement layer, Supabase-native.** Each user's `company_id` (and role) is stamped into their JWT `app_metadata` by a custom access-token hook (`public.custom_access_token_hook`). RLS policies on every tenant table compare `company_id` against `public.current_company_id()`, which reads `auth.jwt() -> 'app_metadata' ->> 'company_id'`. We do NOT use the handoff's raw-Postgres `SET LOCAL app.company_id` pattern — it fights Supabase's Data API/Realtime.
- **Every table in `public` has RLS enabled** (Supabase exposes `public` via the Data API; RLS-off = readable with the anon key). Tenant tables get the tenant-isolation policy; global tables (`companies` catalog, platform-admin data) get explicit admin-only policies.
- **`company_id` is `NOT NULL` + FK → `companies.id` + indexed** on every tenant table (the handoff `schema.ts` had it nullable with no FK — fixed during the port).
- **Data access uses `@supabase/ssr`** server clients carrying the user's session, so RLS applies to every query. **Drizzle is dropped** (the handoff suggested it, but it predates the Supabase decision; an ORM connecting as a privileged role would bypass RLS). TS types come from `supabase gen types`.
- **Auth**: Supabase Auth + a `public.users` profile row per `auth.users`, carrying `company_id` + role. Tenant ID is only ever read from the JWT — never from request body/params.
- **Schema lives in git** as Supabase CLI migrations under `supabase/migrations/`; the dashboard is not used to make schema changes. Build order: Wave 1 = isolation foundation + `customers`/`leads` slice + isolation test; Wave 2 = fan the same RLS treatment out to the remaining tables.

## Auth, onboarding & platform email — decided 2026-07-21

- **Auth = Supabase Auth**, email + password (login/reset designs: `design_handoff_vision_crm/45-sign-in.html`, `46a-reset-request.html`, `46b-reset-set-new.html`). No company/subdomain field on login — tenant comes from `public.users.company_id` → JWT.
- **Platform auth emails send from `support@getvision.uk` via the Resend API**, using the Supabase **Send Email Hook** → edge function `supabase/functions/send-auth-email` (NOT SMTP — chosen for full template control + tracking). Templates are Vision-branded in code and link to `/auth/confirm`. These are Vision-platform emails (login, reset, invite) and are SEPARATE from tenant marketing/customer emails, which send from each tenant's OWN domain set up inside the CRM (`email_domains`/`email_sender_addresses`). Never merge the two.
- **We never set user passwords.** Provisioning is invite-based: onboarding creates a **company + its first owner** (`company_admin`); that owner invites their staff via Supabase `inviteUserByEmail`, and each user sets their own password from the invite link. Platform admins never handle plaintext passwords.
- **Two onboarding doors, one data model:** (A) self-serve **free trial** — public signup creates a new company + owner with `plan='trial'` + `trial_ends_at`; (B) manual/sales provisioning creates the same. **License-per-seat** is enforced on invites: a company has `seat_limit`; inviting a user checks active users < `seat_limit`. Billing = Stripe per-seat (later).
- **Build now:** login + reset wired to Supabase Auth (Resend SMTP), entitlement columns on `companies`. **Defer to pre-launch:** self-serve trial signup UI, company-admin invite UI with seat enforcement, Stripe billing. Entitlement columns are added now so none of that is a retrofit.

## Hosting — decided 2026-07-21

- **The Next.js CRM deploys to Vercel.** The Supabase Auth email function (`send-auth-email`) stays on Supabase, not Vercel — two hosting homes by design.
- Production deploy checklist (env vars + Supabase Site URL/redirect allow-list, so reset links don't point at localhost) lives in `docs/auth-setup.md` § Deploying to Vercel.
- Tenant websites deploy to their own per-tenant Vercel projects via the Vercel API (see below), separate from the CRM deployment.

## AI website builder (future phase) — decided 2026-07-20

Tenants will build websites with AI inside the CRM and publish them to Vercel:

- **One Vercel project per tenant website, with its own deployments.** Do NOT use a shared multi-tenant sites app — this was considered and explicitly rejected.
- All Vercel interaction (project creation, deploys, custom domains, SSL) happens headlessly from the CRM backend via the Vercel REST API. Tenants must never see the Vercel dashboard or be redirected to Vercel.
- SEO split: the CRM itself must be noindexed and invisible to search engines; tenant websites must be SEO-first and rank on Google (custom domains, server-rendered HTML, per-site sitemaps/robots, LocalBusiness JSON-LD).
- Open question (deliberately deferred): where generated site code is stored — likely AI-generated files stored per-site in the CRM's storage (bucket/DB, versioned) and pushed to the tenant's Vercel project on each publish. Decide when the builder phase starts.

## Phase 4 — Customers & leads (core CRM) — decided 2026-07-21

Design coverage from `Vision CRM Screens.dc.html` is uneven, so this records what is transcribed vs designed net-new:

- **Authoritative designs (transcribe faithfully):** Dashboard (screen 01), Customers **list** (02), Customer **detail** "Margaret Ellison" (03), Lead **detail** "uPVC Casement Windows ×8" (04). Built pixel-accurately on our stack against live Supabase data.
- **Net-new (no design exists — designed to match the system):** a **Leads list** (mirrors the Customers-list table template + the stage-badge palette below), a **New Lead** form, and a **New Customer** form. The handoff only ships the two trigger buttons and the in-customer-detail lead-card pattern — no list/kanban and no create forms. Kept visually consistent with the transcribed screens (same `<main>` frame, table grid, pill filters, buttons).
- **Canonical lead stage badges** (from the design system block + live usage): New `#f4f4f5`/`#3f3f46` (dot `#71717a`) · Survey booked white + `#e7e7ea` border · Quoted `#18181b`/`#fff` · Won `#e7f4ec`/`#1a7f3e` · Lost `#fdecec`/`#d64545` · In progress (contract) `#fdf2dc`/`#b86e00`. Geometry `font-size:11px; font-weight:600; padding:3px 9px; border-radius:999px`. Lives in `src/lib/leads.ts`.
- **Lead pipeline stage is keyed off `leads.status`**; `leads.result` (`alive`/`won`/`lost`) marks the closed outcome. "Live" lead = status not in (won, lost).
- **Dashboard v1 wires live data** for the pieces the schema supports (KPI counts, pipeline value, lead sources by `leads.source`, today's diary from `fitting_appointments`); the richer analytics widgets (team performance, revenue-by-month bars) stay visually faithful with representative figures until their data paths land in later phases.
- **`PROPOSED`/amber-badged fields in the design are not-yet-in-schema** annotations — rendered only where a real column backs them, otherwise omitted.

## Lookup dropdowns (tenant-editable pick-lists) — decided 2026-07-21

Any field that should be a controlled pick-list (title, property type, payment terms, marketing source, relationship types, lead source, etc.) uses the tenant-editable dropdown pattern, NOT free text, to avoid mixed/inconsistent data:

- **Storage:** generic `tenant_options` table (`company_id`, `list_key`, `label`), or a dedicated table when the options need structure (e.g. `relationship_types` carries a forward/inverse pair). Both are `company_id`-scoped + RLS tenant-isolated.
- **Seed defaults for ALL tenants first.** Every new lookup MUST ship a sensible default set, seeded into every existing tenant (see `20260721097000_lookup_defaults.sql` for the pattern: `insert … select from companies cross join (values …) on conflict do nothing`). New tenants get theirs seeded at onboarding (future phase).
- **Additions are per-tenant.** "Add new" from the dropdown writes to that tenant's list only, so one tenant's custom values never leak into another's.
- **UI:** the reusable searchable `Combo` (`src/components/crm/combo.tsx`) — search + inline "Add new" + remove, accent-themed. Wire it inline via `EditableField type="lookup"` (`listKey` + `lookupOptions`), backed by `addTenantOption` / `deleteTenantOption`. Fetch several lists at once with `getTenantOptionLists([...])`.
- The stored value on the record stays the **label text** (no FK), so legacy/free-text values still display even if not in the list.

## Customer record & inline editing — built 2026-07-21

The customer detail (`src/app/(app)/customers/[id]/page.tsx`) is a **tabbed record**
(Overview · Contacts · Relationships · Address & access · Billing & account ·
Marketing & permissions · Additional info · Documents · Notes), read from
**`getCustomerRecord()`** (`src/lib/data/customer-record.ts`) — the customer plus
all related lists in one round-trip.

- **Everything edits inline** (no separate edit screen for day-to-day). `EditableField`
  (`src/components/crm/editable-field.tsx`) is the workhorse: `type` ∈
  `text | textarea | number | date | select | boolean | tristate | lookup`. It saves via a
  per-entity field action with a **strict column allowlist** (`updateCustomerField`,
  `updateLeadField`, `updateContactField`, `updateRelationshipField`, `setCustomFieldValue`).
  After a save it calls **`router.refresh()`** — server-action revalidation alone did NOT
  re-render the client tabs.
- **Reusable inputs** (accent-themed, plain-text-until-click):
  - `Combo` (`combo.tsx`) — searchable dropdown + inline "Add new" + remove. Backed by
    `tenant_options` (via `listKey`) OR a custom `onAddNew`/`onDelete` (staff, custom-field lists).
  - `DatePicker` (`date-picker.tsx`) — custom calendar; header drills day→month→year.
    Replaces the native date input everywhere (`EditableField type="date"`).
  - `tristate` — blank / Yes / No (used for marketing consent, which is null by default).
- **Lookups** follow the "Lookup dropdowns" decision above (`tenant_options`, seeded for all
  tenants in `20260721097000`, per-tenant add). **Staff pickers** (Sales manager; later
  Salesperson) come from `staff_members` filtered by role via `getSalesStaff()` /
  `addSalesStaff()` — NOT auth `users`.
- **Contacts mirror the name fields**: first/last → a default `customer_contacts` row
  (`origin='primary'`), 2nd name → `origin='secondary'`, kept in sync; the **default contact
  drives the overview "Main" card**. **Salutation auto-derives** from Title + surname.
- **Relationships are directional**: `relationship_types` are forward/inverse pairs; each
  `customer_relationships` row stores per-side wording (`label_a`/`label_b`) and is bidirectional
  (one row, shown from both customers).
- **Notes threads** reuse `lead_notes` with a `category` (`marketing` vs general).
- **Custom fields** (`custom_field_definitions`/`custom_field_values`): dropdown fields set a
  `list_key` → `tenant_options`; free-text fields don't. Standard fields are migration-seeded
  for all tenants (`20260721099200`), not per-tenant demo SQL.
- **Financials** panel (Billing tab) computes contract balance from `finance_lines`.

### Gotchas for future work
- **Generated types are stale.** Migrations `20260721094000`–`099200` add columns/tables not yet
  in `src/lib/supabase/types.ts`, so data code uses a loose `const db = supabase as any` pattern and
  actions cast insert/update payloads. **Run
  `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`** to restore real typing
  and remove the casts.
- **Inserts set `company_id` via `getCompanyId()`**, which reads `current_company_id()` (the verified
  JWT claim) — NOT `getUser().app_metadata` (that lacks the hook-stamped company_id). Never trust a
  client-supplied tenant id.
- **Schema is applied BY HAND in the Supabase SQL editor**, in order — not `supabase db push` (an
  early hook-policy migration was applied manually, so db push conflicts). Migrations
  `094000`–`099200` were applied to the remote as of 2026-07-21; some (`097000`) were re-run as they
  gained rows. For new migrations: add the file, then apply the SQL manually.
- **Custom Access Token hook must be enabled** in the cloud dashboard (docs/auth-setup.md §2b) and
  `public.users.read`-for-`supabase_auth_admin` policy present (`20260721093000`) — without them
  the JWT carries no `company_id` and every tenant read is empty.
- **New Customer / New Lead forms still use plain inputs** — not yet brought in line with the inline
  lookups/date-picker. Lead detail fields (source, product type, salesperson) not yet lookup-ified.
