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
  for all tenants (`20260721099200`), not per-tenant demo SQL. **Tenants define their own from
  the record** — "Add field" on the Additional info tab (`AddCustomFieldButton`) takes a question
  + free-text/dropdown choice, and a dropdown field gets its own option list keyed
  `cf_<slug>_<definition_id>` so it behaves like every other pick-list. No settings trip needed;
  everything is `company_id`-scoped so a tenant's own questions stay invisible to other tenants.
- **Financials** panel (Billing tab) computes contract balance from `finance_lines`.

## Dialogs, confirms & warnings — decided 2026-07-22

**Never call the browser's `confirm()`, `alert()` or `prompt()`.** They can't be styled, ignore the
tenant accent, and render as a "localhost says…" system box. Every destructive action, warning or
acknowledgement uses the app's own dialogs:

```tsx
const { confirm } = useDialogs();            // components/crm/dialogs.tsx
const ok = await confirm({
  title: "Remove this note?",
  message: "Its version history goes with it. Attachments stay on the record.",
  confirmLabel: "Remove note",
  tone: "danger",                            // "accent" | "warning" | "danger"
});
if (!ok) return;
```

- **Global by construction.** `DialogsProvider` is mounted once in `src/app/(app)/layout.tsx`,
  INSIDE the themed root, so one dialog element serves the whole CRM and inherits the tenant's
  accent CSS variables. New screens get it for free — never add a second provider, and never
  hand-roll a bespoke confirm.
- **Promise-based, so call sites read like the native API they replace.** `confirm()` resolves
  false on Cancel, Escape and backdrop click; `alert()` resolves when acknowledged. `useDialogs()`
  throws outside the provider — that's a mounting bug, not a reason to fall back to `window.confirm`.
- **Tones carry meaning, not decoration:** `danger` = irreversible (red, and Cancel takes focus so
  a reflex Enter never deletes), `warning` = proceed with care (amber), `accent` = an ordinary
  decision (tenant accent). Buttons say what happens ("Delete file"), not "OK".
- **Write the message like a receipt:** what is destroyed AND what survives ("Attachments stay on
  the record"). Users judge the risk from that sentence.
- Multi-field/interactive dialogs (e.g. "New additional-info field") stay bespoke `Dialog`
  compositions from `components/ui/dialog` — `useDialogs` is for confirm/acknowledge only.

## Notes — stamped, versioned, linkable — built 2026-07-22

One table backs every note in the CRM (`public.lead_notes`): customer-level when `lead_id` is
null, lead-level otherwise, split into threads by `category` ('general' | 'marketing'). Built on
the customer record; reuse it for leads/contracts rather than forking.

- **Never overwrite a note.** History is append-only in `note_revisions` (`note_id`, `version`,
  `content`, `edited_by`, `edited_at`, unique on `(note_id, version)`). v1 is written with the
  note, every edit appends the next version, and the live row keeps the current text so lists stay
  one read. Nothing in the app updates or deletes a revision. `lead_notes.updated_at/updated_by`
  are the "last edited by X at Y" stamp; history loads on demand (`loadNoteHistory`), not with the
  record. **Deletes are still hard** — a removed note takes its revisions with it. If a full audit
  trail is wanted, that's a `deleted_at` soft-delete, decided separately.
- **Every write goes through `src/app/(app)/notes/actions.ts`** (`addNote`/`updateNote`/
  `deleteNote`) so author, tenant and v1 are always stamped. `addMarketingNote` and `addLeadNote`
  are thin wrappers over `addNote` — do NOT insert into `lead_notes` directly, or the note starts
  life with no history.
- **Links:** a note may point at a lead OR a contract (`lead_id` / `contract_id`) while keeping
  `customer_id` set, so it reads from the customer record and from the thing it's about. The
  customer Notes tab shows every non-marketing note on the customer, lead-linked ones included.
  (Notes written on the lead screen don't set `customer_id`, so they stay lead-only for now.)
- **Attachments are ordinary documents** carrying `documents.note_id` — same bucket, same tenant
  RLS, same viewer, and they still appear on the Documents tab. `ON DELETE SET NULL`: deleting a
  note never destroys a file. Upload via the shared `uploadDocument` with a `noteId` field.
- **UI:** `src/components/crm/notes-panel.tsx` — composer (text + link picker + attach), then
  per-note author/date-time stamp, an "Edited by … " button that expands the full version list,
  inline edit, per-note attach, and attachment chips that open signed URLs.

## Documents — reusable file store — built 2026-07-21

Document upload/view is a **single entity-agnostic module**, built on the customer
record but designed to drop into leads, contracts and anything else unchanged. Do NOT
fork per-entity copies.

- **One polymorphic table** — `public.documents` already carries a nullable FK per owner
  kind (`customer_id`/`lead_id`/`contract_id`) + a `context` label. `src/lib/data/documents.ts`
  is the single mapping layer: `OWNER_FK` maps `DocumentOwnerType` (`customer|lead|contract`)
  → column, and every action/loader defers to it. To support a new owner kind: add the FK
  column, extend `OWNER_FK`/`isDocumentOwnerType`, done.
- **Storage = a private `documents` bucket, customer-centric per tenant.** Path is built by
  `buildDocumentPath()`: `{company_id}/{customer_id}/{uuid}.{ext}` for a customer's own docs,
  and lead/contract docs nest **under the owning customer** —
  `{company_id}/{customer_id}/leads/{lead_id}/…` and `…/contracts/{contract_id}/…`. The path
  (not a URL) is stored in `documents.file_url`; every doc row also stamps `customer_id` so it's
  reachable from the customer record. Bucket + tenant-isolation RLS on `storage.objects` (first
  path segment must equal `current_company_id()`) live in `20260721101000_documents_storage.sql`
  — **apply BY HAND**. Deeper segments are organisational only.
- **Signed URLs, never public.** View/download go through `getDocumentSignedUrl` (10-min
  signed URL); nothing persists a public URL.
- **Actions** (`src/app/(app)/documents/actions.ts`, `"use server"`): `uploadDocument(FormData)`
  (multipart — the panel loops one file per call; `uploaded_by = auth.getUser().id`,
  `company_id = getCompanyId()`; a lead/contract owner passes `customerId` for path nesting,
  a customer owner uses its own id), `renameDocument`, `setDocumentCategory`, `deleteDocument`
  (removes the object then the row), `getDocumentSignedUrl`, `addDocumentCategory` /
  `deleteDocumentCategory`. Mutations `revalidatePath('/{ownerType}s/{ownerId}')`.
- **Upload transport:** `serverActions.bodySizeLimit` is bumped to `27mb` in `next.config.ts`
  (file cap is 25 MB; the extra headroom absorbs multipart overhead so a max-size file hits
  our friendly check, not Next's cryptic one).
- **Categories** are tenant-editable `tenant_options` under list_key `document_category`,
  seeded for all tenants in `20260721101100_document_categories.sql` (**apply BY HAND**). The
  list row edits category inline via the reusable `Combo`; the consumer passes `categoryOptions`
  (fetched with `getTenantOptionLists([... , "document_category"])`).
- **UI is a two-pane panel.** `DocumentsPanel` (`src/components/crm/documents-panel.tsx`):
  **left (40%)** = a toolbar (Add document · View · Email _(not wired)_ · Print · Delete) over a
  selectable list (inline rename, per-row category); **right (60%)** = an inline viewer of the
  selected doc. Drag-drop works anywhere over the panel (overlay on drag). The panel **fills the
  tab region's height** via the flex chain (`main` → page → `Tabs` content are all
  `flex-1`/`min-h-0`), with the list scrolling internally — no fixed height, no magic offsets.
  Added icon glyphs: `upload`, `download`, `trash`, `x`, `printer`, `maximize`, `minimize`,
  `minus`.
- **Viewer** (`document-viewer.tsx`): exports `InlineViewer` (right pane) and `FullscreenViewer`
  (overlay, opened from the pane's maximize button); both share a `Stage` that renders images
  `<img>` (CSS zoom), PDFs via `<iframe>`, text `<iframe>`, else a download card. Zoom (− / % / +,
  25–400%) shows for images + PDFs only. Two PDF-specific gotchas baked in:
  - **Native chrome hidden + real zoom.** The PDF `<iframe>` src uses `#toolbar=0&navpanes=0&zoom=N`
    so only the page shows and zoom drives the **viewer's own** vector zoom (crisp small text) —
    resizing the iframe box just re-fits the same page and doesn't magnify. Applying a new `#zoom`
    needs a reload, so the iframe is **keyed by zoom pct** to remount. Chromium/Edge only (Firefox
    pdf.js ignores these params).
  - **Cross-origin focus-steal.** The PDF iframe is served from the Supabase storage domain, so
    once focused it eats the first click on the surrounding UI. `DocumentsPanel` blurs the focused
    iframe on `onMouseDownCapture`, and list rows select on `onMouseDown` (not click) — so
    switching files is reliably single-click. Keep both if you touch this.
  - Print: images open a print window; PDFs open in a new tab (the browser prints from there).
- **Loaders** select the shared `DOCUMENT_SELECT` (incl. `uploader:uploaded_by(...)`) and map
  with `mapDocumentRow` → `DocumentItem`. `getCustomerRecord` already does this;
  `CustomerDoc` is now an alias of `DocumentItem`. A standalone `getDocuments(ownerType, ownerId)`
  exists for owners that don't batch-load.

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
  **`20260721101000_documents_storage.sql` (documents bucket + storage RLS),
  `20260721101100_document_categories.sql` (category defaults) and
  `20260722090000_note_links_versions_attachments.sql` (note links/versions/attachments) still
  need applying** — document upload/view won't work until the storage one is run in the SQL
  editor, and the Notes tab will error until the note one is. After applying the note migration,
  **reload the PostgREST schema cache** (Supabase dashboard → API → restart, or
  `notify pgrst, 'reload schema';`) or the new `updated_by`/`note_id` embeds fail to resolve.
- **Custom Access Token hook must be enabled** in the cloud dashboard (docs/auth-setup.md §2b) and
  `public.users.read`-for-`supabase_auth_admin` policy present (`20260721093000`) — without them
  the JWT carries no `company_id` and every tenant read is empty.
- **New Customer / New Lead forms still use plain inputs** — not yet brought in line with the inline
  lookups/date-picker. Lead detail fields (source, product type, salesperson) not yet lookup-ified.
