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

### Every lookup does all three things — decided 2026-07-22

A pick-list is only tenant-editable if all three are reachable from the dropdown itself. Wiring one
without the others is the bug, not a smaller feature:

1. **Add** — the inline "Add new" (`onAddNew`).
2. **Remove from the list** — the trash control on each option row (`onDelete`). **Every `Combo`
   with editable options must pass it**; `EditableField type="lookup"` fills it in from `listKey`
   automatically, so a lookup only lacks it when it uses a bespoke source. The Sales manager picker
   was exactly that gap — it had `onAddNew` and no delete until `deleteSalesStaff` landed.
3. **Clear the field** — **clicking the already-selected option deselects it** and empties the
   field. There was previously no way back to blank once a value was set, only sideways to another
   one. The selected row carries a tick that turns into an ✕ on hover to advertise it. `clearable`
   turns this off, and only two cases justify it: the list carries its own "none" entry (the notes
   `LinkPicker`'s "Not linked") or the field is genuinely required.

- **"Remove from the list" and "clear this field" are different actions and must not look alike.**
  Removing is a per-row **trash** control on the right, always visible (a hover-only affordance for
  the only way to curate a list is undiscoverable), greys up on row hover and reddens on its own.
  Clearing is the ✕ that replaces the tick on the selected row. Never use a bare ✕ for both.
- **Removing an option is confirmed** through `useDialogs().confirm` (never `window.confirm` — see
  § Dialogs), and the message states what survives: the option leaves the dropdown for the whole
  company, **records already set to it keep their value** (the stored value is label text, not an
  FK), and it can be added back.
- **A "delete" that would orphan a person retires them instead.** `deleteSalesStaff` sets
  `staff_members.active = false` — `getSalesStaff()` filters on active, so they leave the picker
  while every record they worked stays intact. Do the same for any lookup backed by a real entity.
- **`""` from a combo means "cleared", and the consumer converts it to `null`** before saving
  (`EditableField`, `CustomFieldValue`, `setDocumentCategory`). Storing an empty string instead of
  null leaves a field that reads blank but isn't. The trigger also falls back to its placeholder on
  `""` as well as null (`||`, not `??`) — an empty trigger renders as nothing at all and the field
  becomes unclickable, which is how it first went wrong.
- **The tick sits only on the selected row**, not as a reserved slot on every row: an empty leading
  column indents the whole list waiting for a mark that never comes.

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

## Popover menus — positioned against the viewport — decided 2026-07-22

**A dropdown menu is `position: fixed`, measured from its trigger's bounding rect — never
`absolute`.** The shared hook is **`useFloatingMenu`** (`components/crm/floating-menu.ts`) and every
popover uses it: `Combo`, `RelationshipTypeSelect`, `DatePicker`. The document-category picker was
the bug that forced it (the menu was clipped in half by the documents list's `overflow-hidden` card
and its scroller). Every dropdown in the CRM sits inside a clipping ancestor — tab scrollers,
bordered list cards, the two-pane panels — so an absolutely-positioned menu is cut off somewhere
sooner or later. **Don't hand-roll another one**; a bespoke menu is how the relationship picker
inherited the same bug.

- **`fixed`, not a portal.** Same reasoning as the map overlay: the menu is themed with
  `var(--accent-blue)`/`--accent-tint`/`--accent-active`, and portalling it to `document.body`
  drops it out of the shell root where `tenantThemeVars` are set, so every tenant with a brand
  colour silently gets platform blue. `fixed` escapes ancestor clipping on its own, and keeping the
  menu in the tree also keeps the existing click-outside check (`ref.contains`) working unchanged.
  A `transform`/`filter`/`perspective`/`contain` on an ancestor makes IT the containing block for
  `fixed` children, so the hook walks up, finds that ancestor and rebases the coordinates onto it.
  That case is real, not theoretical: the shadcn `DialogContent` is translate-centred, and the
  relationship-type picker opens inside it.
- **Position is recomputed while open** on `resize` and on `scroll` **in the capture phase** (so
  scrolling any ancestor, not just the window, moves the menu with its trigger). A `fixed` menu that
  is placed once detaches the moment the list behind it scrolls.
- **It flips and clamps rather than spilling off-screen**: `left` is clamped into the viewport,
  and the menu opens upward when there isn't ~200px below and there's more room above. `maxHeight`
  comes from the space actually available, with the option list as the flex scroller — the old
  fixed `max-h-56` didn't know how close to the bottom of the window it was.
- **`align` picks the trigger edge to line up with**: `end` (right) is the default for
  `variant="text"`, because field rows justify `label … value` and the value sits on the right.
  **Left-aligned triggers must pass `align="start"`** or the menu opens leftwards across the
  sidebar — that's what the documents category picker does.

## Screen size — decided 2026-07-22

**The CRM is desktop-only for now, and that is a deliberate holding position.** Below **1280px** the
app is replaced by `ScreenTooSmall` (`components/app-shell/screen-too-small.tsx`) — phones and
tablets both. The gate is pure CSS (`xl:hidden` on the message, `hidden xl:flex` on the shell) so it
is correct server-side with no flash and no viewport JS.

- **Why blunt rather than responsive:** every screen is built to the desktop layout (the customer
  overview is a four-column bento). A tablet tier is real per-screen layout work, and doing it
  half-heartedly is exactly what went wrong — dropping to a 2-column stack put four cards in one
  column and clipped them, which was worse than not supporting the size at all.
- **When we do support smaller screens**, use the `responsive-breakpoints` skill: phone ≤767 ·
  tablet 768–1366 · desktop ≥1367, never more than 3 columns on tablet, and test at 820 / 1366 /
  ≥1367. `--breakpoint-desktop: 1367px` is already defined in `globals.css` (the `desktop:` variant)
  because Tailwind's `xl` (1280) and `2xl` (1536) straddle the tablet ceiling — a 1366-wide iPad Pro
  in landscape would otherwise pick up desktop-only layouts. Pick the threshold from what the
  LAYOUTS need, then move the gate.
- **Tenant websites from the AI builder are mobile-first.** Different product, different rules —
  never apply this decision to them.

## App frame & scrolling — decided 2026-07-22

**The document never scrolls — in either axis.** `html` and `body` are `h-full overflow-hidden`
(`src/app/layout.tsx`), the app shell root is `h-full overflow-hidden`, and the sidebar/main row adds
`min-w-0 overflow-hidden`. The topbar and icon rail are therefore always in place and there is no
page-level scrollbar to chase.

- **No scrollbar is ever painted, anywhere in the CRM.** A global base rule in `globals.css`
  (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`) hides the track on every
  scroller — tab panels, lists, dropdown menus, the document and notes panes. **This is an app, not
  a web page:** a gutter appearing the moment a list overflows reflows the layout and reads as
  chrome. Scrolling itself is untouched (wheel, trackpad, keyboard, touch). The consequence to
  design around: **a scroller must look scrollable from its content** — that is why digests are
  capped with a "View all →", `FitRows` clips to whole rows, and menus size to the space available.
  Don't add a bespoke styled scrollbar back for one component.
- **Every screen owns its own scroll.** A page's root is `flex flex-1 flex-col` plus either
  `overflow-y-auto` (it may be taller than the panel) or `overflow-hidden` with an inner
  `min-h-0 flex-1` scroller (lists, two-pane panels). Adding a page without one of those clips its
  content instead of scrolling it — the document can't bail you out any more.
- **The `(auth)` layout scrolls itself**, and its centring sits on an inner `min-h-full` wrapper, not
  on the scroll container — `items-center` on a scroller clips the top of anything taller than the
  window.
- **Screens that aren't lists should FIT.** Scrolling is for data (lists, document/note panels, long
  forms), not for a record's summary. The customer overview is the worked example: it runs denser
  than the editing tabs (`[&_[data-row]]:py-[5px]` on the tab root, `OV_CARD` padding, `gap-3`) and
  every digest caps at `DIGEST_ROWS` with "View all →" carrying the rest. Make new summary cards
  earn their height the same way.

## Customer overview — summary cards — built 2026-07-22

The Overview tab is the **at-a-glance answer to "who do I ring, where do they live, what do they
owe, what's the latest"**. It pulls digests from the other tabs rather than making staff hunt:

- **Summary cards are READ-ONLY and deep-link to the tab that owns the data.** A field is edited in
  exactly one place — its own tab — so there is never a second `EditableField` for the same column
  to keep in sync. Every card carries an "Edit →" / "View all →" jump.
- **Jumping between tabs goes through `TabNavContext`** (`src/components/crm/tabs.tsx`). Panels are
  server-rendered `content`, so they can't touch the `active` state; `TabLink` (a text link) and
  `TabJump` (a clickable row/region) are the two small client buttons that call `goTo("Notes")`.
  Targets are matched by tab label, **case-insensitively** — every target is hand-written at its
  call site, so a case slip would otherwise be a silently dead button. Renaming a tab still means
  updating its jump targets. **Tab labels are Title Case** ("Leads & Contracts").
  Tab state is deliberately NOT in the URL — no navigation, no scroll reset on jump.
- **The overview is a BENTO of four independent column stacks**, not a row-aligned grid, capped at
  `max-w-[1320px]` (`md:grid-cols-2 xl:grid-cols-4`, each column a `flex flex-col gap-4`):
  - strip — lifetime value · outstanding · live leads · contracts
  - col 1 — Identity · Flags
  - col 2 — Contact · Address
  - col 3 — Marketing consent · Recent documents · Recent notes
  - col 4 — Contracts · Leads
  **Cards must never be laid out in aligned rows here.** Identity is ten rows and Contact is two;
  a row grid stretches every card to the tallest in its row, which left half the screen empty.
  A new card is appended to whichever column is shortest — the columns don't have to match.
- **Leads and contracts live in column 4 as compact stacks**, not the full-width `LeadCard` /
  `ContractCard`. A column is ~310px, so a row is ONE line — reference, what it is, how much — and
  links to the lead for everything else. Stage badges and dates were tried there and dropped: they
  doubled every row's height for information the lead itself states plainly. Digest cards carry a
  "View all →" and no count; the count lives on the tab.
- **The overview FILLS its panel and stops — it never scrolls and never spills.** The root is
  `h-full min-h-0 overflow-hidden`, the grid takes the leftover height, and each column is a flex
  stack. What gives way when the window is short is decided by which card it is:
  - **Field cards are `shrink-0` (`OV_CARD`)** — Identity and Flags are editable ONLY on the
    overview, so losing a row would make that field unreachable. They always render in full.
  - **List cards shrink (`OV_LIST_CARD` + `FitRows`)** — Contact, Address, Recent documents, Recent
    notes, Contracts, Leads. `FitRows` (`components/crm/fit-rows.tsx`) measures its box and renders
    only the rows whose bottom clears it; the rest are hidden with `visibility` (NOT `display`, so
    the measurement can't oscillate) and the parent clips, so no half-row ever shows. Every one of
    them carries a total count + a jump, so nothing dropped is unreachable.
  This is why the row caps alone weren't enough: three notes fit a 27" monitor and not a laptop, so
  the count has to be decided at runtime. **If you add a card, decide which kind it is** — a card of
  fields that live nowhere else must be `shrink-0`; anything mirroring a tab should shrink.
- **The overview's height is BOUNDED BY DESIGN — every card has a fixed budget.** The rule that
  keeps it that way: *no card may grow with the data*. Lists cap at a row count; free text is
  clamped (access notes 2 lines); **every digest row is exactly one line** — Recent notes carries
  `NOTE-…` + author + date and NO note text (the snippet was the only thing on the overview whose
  height moved with the data; the words live on the Notes tab); **every field row is exactly one line**
  (`[&_[data-row]>:last-child]:truncate` on the tab root — before that, one long Alert Note or
  contact Role wrapped a card to any height it liked). A capped card says so in its header
  ("2 of 7"), which costs no height, rather than spending a row on "+N more".
  Worst case is roughly 590px of cards + 62px strip; below about an 800px viewport the tab region
  scrolls rather than clipping — that is the deliberate escape hatch, not a bug. If a new card
  pushes the worst case up, rebalance the columns (Flags moved to column 4 for exactly this reason,
  because Identity + Other contact + Flags was the tallest stack).
- **Every digest is capped and every cap has a destination.** Notes / documents / contracts / leads
  show the latest `DIGEST_ROWS` (3), linked customers `LINKED_ROWS` (2) — a card must not grow with
  the data or the tab starts scrolling. Anything capped MUST offer the jump to the tab holding the
  full list, which is why the **Leads & Contracts tab** exists: it is where the full
  lists live now that the overview only summarises them. See § Lists & columns for its shape. Loaders sort newest
  first (leads by `lead_date`, contracts by `contract_date`, documents/notes by `created_at`) so
  "the latest three" is true at the source, not re-sorted per card.
- **ONE contact card, not two.** The main contact and the customer's own numbers live on different
  tables (`customer_contacts` vs `customers`) but that is our problem, not the user's — as two cards
  they printed the same mobile twice and needed dedupe logic to hide it. `ContactCard` shows the
  contact's name/role/email/phone then any *other* number the customer has, skipping duplicates.
- **Marketing consent chips carry the answer in COLOUR** (green consented / red refused / grey never
  asked) with no "· yes" text, so all four channels fit one line. Colour alone isn't accessible, so
  the state is also in the `title` and an `sr-only` span.
- **Bottom breathing room belongs INSIDE the tab scroller** (`pb-2` in `tabs.tsx`). Padding on the
  page wrapper sits outside the scroll box, so a card reaching the end of the panel would run flush
  into its edge.
- **Consent chips show three states, not two** — blank = never asked, which is materially different
  from a recorded "No". Same rule as the `tristate` editor.
- **The Flags card is tristate too** (Do Not Contact · Payment Risk · Moved Away) — blank / Yes / No,
  `EditableField type="tristate"` with `danger` so Yes is a red pill. Their columns shipped
  `default false`, which made every customer read as an explicit "No" from birth; `20260722094000`
  drops the defaults and nulls the untouched `false` rows. **Any new customer flag defaults to null,
  never false** — "nobody has assessed this" is a real state and must stay distinguishable.
- **Colour carries meaning, and it lives in the figures and chips — never in card headers.** Stat
  tiles get a 3px coloured rule down the leading edge plus a coloured figure (**lifetime value green
  `#1a7f3e`, outstanding red `#d64545`**, live leads = tenant accent, contracts neutral) from the
  `STAT_TONE` map, and are `min-w-[164px]` in a `flex-wrap` row so they size to the figure rather
  than stretching. **No icons on any card header** — every card is a plain title plus its jump link;
  icon chips were tried there and rejected.
- **No new queries.** Everything renders from what `getCustomerRecord()` already loads; a summary
  card must never add a round-trip. If a future card needs data the record doesn't carry, add it to
  that loader (behind `selectWithFallback`), not to the component.

## Lists & columns — decided 2026-07-22

- **The customer record's tabs are short labels in Title Case**: Overview · Leads & Contracts ·
  Contacts · Relationships · Address · Account · Marketing · Additional Info · Documents · Notes.
  Jump targets (`TabLink`/`TabJump` `to=`) are matched case-insensitively but still by label, so a
  rename means updating them — grep `to="` before renaming a tab.
- **The Leads & Contracts tab is two COLUMNS of cards** — leads left, contracts right, using the
  designed `LeadCard`/`ContractCard` (`components/crm/lead-card.tsx`), each card one line:
  reference · title · value · stage. Contracts follow their leads' order and carry `fromLead`
  ("from L-2431"), since they no longer sit under their lead behind a connector elbow.
- **The customer record is a SUMMARY of the work, not a workbench for it.** Two alternatives were
  built and rejected on 2026-07-22: **sub-tabs** (Leads | Contracts) — the record is already ten tabs
  deep and nesting would land overview jumps on whichever sub-tab was last active; and **full tables
  with per-column detail** — too much detail for a record you open to remind yourself who this is.
  Anyone who wants the full picture with dates, sources and salespeople goes to `/leads`. Keep this
  tab at a glance; push depth to the list screens.
- **Customisable columns belong to the LIST SCREENS ONLY** (`/leads`, `/customers`) — do NOT bring a
  column picker into the customer record. **Built for `/customers` on 2026-07-22**
  (`src/components/crm/customers-list.tsx`); `/leads` still hardcodes its `GRID` and is the next to
  get the same treatment.
  - **A `COLUMNS` registry per entity is the source of truth** — `{ key, label, group, width (grid
    track), kind|cell }`. It spans the WHOLE customer field set (~55 fields, grouped Identity ·
    Contact · Address · Marketing · Flags · Account · Activity); generic fields render from
    `record[field]` by `kind` (text/bool/number/date), composite/computed ones (address, lead &
    contract counts, last activity) use a `cell`. To carry every field, the list query selects `*`
    and `toCustomerRow` stashes the raw row on `CustomerRow.record`. The primary name column and the
    row controls (select box, chevron) are FIXED edges, not in the registry; only these fields
    toggle/reorder. New columns default hidden (a release must not force a column into everyone's
    view). The "Columns" popover is **searchable + grouped** (Shown drag-list when not searching;
    otherwise flat matches). With many columns on, the **table scrolls horizontally** (one x/y
    scroller, sticky header) — legitimate for a data table even though chrome scrollbars are hidden
    app-wide.
  - **There is NO hardcoded name/customer column** (removed 2026-07-22 — it glued name + email
    together and couldn't be moved/hidden/sorted). "Name" (avatar + display name) is just the first
    DEFAULT column now; email is its own column. Only the select box (left) and a trailing chevron
    are fixed edges.
  - **The saved layout is PER USER, per list, reusing `user_ui_layouts`** (§ Rearrangeable cards) —
    `layout_key='customers_columns'`, shape `{ order: string[], widths: Record<key,px> }`
    (`getUserPref`/`saveUserPref`). A salesperson and a fitter keep different columns AND widths; one
    admin's choice never becomes everyone's. (Tenant-default-with-override can layer on later.)
  - **Columns are RESIZABLE by dragging the header's right edge**, widths persisted per user. Widths
    are px (the grid switched from `fr` tracks to fixed px + a trailing `minmax(16px,1fr)` spacer so
    rows fill the width and borders span). `commitWidth` merges the final px explicitly, so a
    mid-drag stale closure can't corrupt the saved object; only the dragged column changes.
  - **Sorting is SERVER-SIDE, single-column, via `sort`/`dir` URL params** (so it orders across every
    page, not just the 9 on screen, and is shareable). Click a header → asc, click again → desc,
    click another → that column. `getCustomers` orders by an ALLOWLISTED column (`SORTABLE_COLUMNS`,
    never interpolated) with `id` as a stable tiebreaker; computed/composite columns (counts, last
    activity, address) aren't sortable, Name maps to `last_name`. Resize handle stops its click
    reaching the sort button.
  - **The table is a CLIENT component fed serialisable rows** — the server page computes each row's
    view (incl. `latestLeadActivity`, whose helper stays in the server data layer) and hands
    `CustomerRowView[]` to `CustomerTable`. A `CustomerColumnsProvider` shares the column state
    between the toolbar's "Columns" popover and the table; the grid template is built from the
    visible columns' widths at render.
  - **The "Columns" popover is toggle + drag-reorder** (dnd-kit, "Shown" sortable list + "Hidden"
    section, Airtable-style), persisting on every change with a "Reset". The `DndContext` carries a
    stable `id` (`cols-customers`) for the SSR/hydration reason in § Rearrangeable cards.
- **Filters live in a "Filters" POPOVER, not inline pills.** The Town + Has-Live-Lead pills next to
  the search were removed on 2026-07-22 and folded into the `FiltersButton` popover; the button shows
  an active-filter count badge (pills gone means the applied state needs to read from somewhere) and a
  "Clear all". Filters stay URL-param-driven (`useSetParams`) so the server re-queries and the state
  is shareable/back-button-friendly — only the column layout is a saved preference. Both popovers use
  `useFloatingMenu` (fixed, in-tree), NOT the base-ui `Popover` (it portals to `document.body`, which
  drops the tenant accent — see § Popover menus).
- **The filter set spans the customer fields, applied server-side against an ALLOWLIST.** A `FILTERS`
  registry drives the popover (grouped; selects = pick a value, bools = Any/Yes/No); each writes an
  `f_<column>` URL param. `getCustomers` reads them into `columnFilters` and applies only columns in
  `SELECT_FILTER_COLUMNS` (`.eq` value) / `BOOL_FILTER_COLUMNS` (`.eq` true/false) — never an
  interpolated column name, and the value is PostgREST-bound. Select options are the DISTINCT values
  actually in use (`getFilterOptions`, one capped read). Applying filters at the DB keeps paging +
  the exact count correct — the ONE exception is `Has live lead` (`live`), which is lead-derived and
  can't be a `customers` predicate without an inner join, so it stays a post-filter with the known
  caveat that the count reflects the pre-filter set. Add new filters by extending both the client
  `FILTERS` registry and the server allowlist.

## Bento layout is the house style — decided 2026-07-22

The overview's bento (independent column stacks, cards sized to their own content) is **the layout
pattern for the whole app**, not an overview-only trick. Applied to the record's editing tabs on
2026-07-22 and to be used for new screens:

- **Card grids get `items-start`, or columns get their own `flex flex-col gap-4` stack.** A plain
  CSS grid stretches every card to the tallest in its row, so a 9-row Address card left a 6-row
  Phones card with three rows of dead white.
- **Prefer MORE, NARROWER columns over fewer wide ones** (Address is `md:grid-cols-2 xl:grid-cols-3`,
  capped `max-w-[1320px]`). A field row is `label … value` justified apart, so a card stretched over
  half a 1900px screen puts a metre of nothing between the two — the label stops belonging to its
  value. Narrow cards keep the pair readable.
- **A field appears ONCE per card.** Access notes used to print the note twice — an accent-blue
  editable in the card header and a read-only echo below it — which reads as two separate fields.
  If a value needs to be editable, make the displayed value the editor (`EditableField` with
  `type="textarea"` and a left-aligned `className`), don't add a second copy.

## Rearrangeable cards & per-user layouts — built 2026-07-22

The customer-overview bento **and the record's tab bar** are both **drag-to-rearrange and saved PER
USER**. First uses of a pattern meant to spread: any customisable surface (these, the future
`/leads` & `/customers` column pickers) stores its arrangement the same way.
`src/components/crm/bento-board.tsx` is the overview board; `OverviewTab` renders the cards and hands
them in. The tab bar is `Tabs` (`src/components/crm/tabs.tsx`) with a `layoutKey`.

- **Layout is per user, never per tenant.** Company A's five users each get their own row and never
  see each other's — a salesperson and a fitter want different things on screen. Same rule already
  recorded for the list-screen column picker in § Lists & columns; this is where it lands.
- **Storage is a GENERIC `user_ui_layouts` table** (`20260722096000`, **apply BY HAND** + reload
  PostgREST) — `user_id` + `company_id` + `layout_key` + `layout jsonb`, unique on
  `(user_id, layout_key)`, RLS locked to `auth.uid()` within the tenant. `layout_key` names the
  surface; the jsonb is opaque to the DB and each surface owns its own shape:
  `{ columns: string[][] }` for the overview (`customer_overview` — ordered card ids per column),
  `{ order: string[] }` for the tabs (`customer_tabs` — tab labels in order). The future column
  pickers reuse the same table, not fork one. Loaders `getUserLayout` / `getUserOrder`
  (`src/lib/data/user-layouts.ts`); actions `saveUserLayout` / `saveUserOrder` / `resetUserLayout`
  (`src/app/(app)/preferences/actions.ts`) — `user_id`/`company_id` come from the verified session +
  `current_company_id()`, NEVER client input.
- **A CARD REGISTRY is the single source of truth for what cards exist.** `reconcile()` drops
  unknown/duplicate ids from a stored layout and appends any card MISSING from it to the shortest
  column — so a card added in a later release auto-appears for users who already have a saved layout.
  Nothing silently vanishes; this is also the hook the future add/toggle-cards phase plugs into.
- **Cards stay SERVER-RENDERED and are handed to the client board as `Record<id, ReactNode>`** — the
  board only arranges them, so the inline editors/live data inside keep working (standard RSC
  "pass server nodes as props to a client component" pattern). The board's own state must never add a
  server round-trip on render.
- **Drag from a HANDLE, not the card.** Cards are full of clickable things (`EditableField`, jumps,
  note/document rows); a grip surfaces on hover at the card's top edge and carries the dnd listeners,
  leaving the card interactive.
- **Fit-to-panel (§ App frame, FitRows) is preserved by mirroring the cards' flex semantics onto the
  sortable wrapper.** FIELD cards (Identity/Flags — editable ONLY on the overview) stay `shrink-0` so
  a row is never lost; digest cards may shrink and their FitRows trims. The wrapper targets the card
  with `[&>div]` (the card is a `<div>`, the handle a `<button>`) to fill the non-growing wrapper.
- **`DndContext` MUST carry a stable `id`** (`bento-${layoutKey}`, `tabs-${layoutKey}`). Without it
  dnd-kit builds `aria-describedby` from a global counter that differs between SSR and hydration → a
  React hydration mismatch. (The live-region id is mount-guarded and doesn't SSR, so it isn't a second
  source.) The overview page runs two DndContexts at once — the bento and the tab bar — so each needs
  its own stable id.
- **A module-level `layoutCache` keyed by `layoutKey` survives remounts.** `Tabs` renders only the
  active panel, so leaving Overview and returning REMOUNTS the board — without the cache it re-reads
  the page-load `savedLayout` prop and drops any change made since. The cache is written ONLY from
  browser event handlers, so the server render stays empty (no cross-request leak) and the first
  hydrating render always matches the server by reading `savedLayout`. (The tab bar itself doesn't
  need this — `Tabs` never unmounts, so its order state lives across tab switches.)

### Reorderable tabs — built 2026-07-22

`Tabs` gains drag-to-reorder ONLY when a `layoutKey` is passed (opt-in — every other screen using
`Tabs` is unchanged). The customer record passes `layoutKey="customer_tabs"` + the user's
`savedOrder`. Default order = the authored `tabs` array; "Reset order" (shown only once customised)
reverts and deletes the row.

- **A tab is BOTH the switch AND the drag source — no separate grip.** A tab is one word, so a
  whole-tab drag with a click threshold (PointerSensor `distance: 6`) is the least cluttered
  affordance — a click switches, a real drag reorders (the browser-tab-bar model). Cards needed a
  grip because they're full of clickable content; tabs don't.
- **Active tab is tracked by LABEL, not index.** Reordering must never change which tab is open, and
  jumps (`goTo`) already target a label. An index would point at a different tab the moment the order
  changes. `orderTabs()` reconciles a saved order like the bento's `reconcile()`: keep known labels,
  drop gone ones, append NEW tabs at the end so a later-added tab is never hidden.

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
- **An attachment is a LINK, never a copy.** `note_attachments` (note_id ↔ document_id) joins a
  note to an ordinary `documents` row — same bucket, same tenant RLS, same viewer, one row on the
  Documents tab. One file is stored, named and numbered ONCE, so renaming it from a note renames
  it everywhere, because it is the same file. A document can be referenced by several notes.
  (This replaced a `documents.note_id` design where attaching an existing file copied the row —
  that produced visible duplicates on the Documents tab and two names for one file. Don't go back.)
  Removing an attachment from a note deletes the JOIN row (`detachDocumentFromNote`) — the file
  stays on the customer; deleting files is the Documents tab's job. Deleting a note cascades its
  join rows only.
- **Every note and document carries a per-CUSTOMER reference** — `NOTE-0018` / `DOC-0104`
  (zero-padded to 4, then grows), so the first file on a customer is DOC-0001. Allocated by the
  shared `next_reference` counter under a name that encodes the owner (`document:<customer_id>`,
  `note:<customer_id|lead_id>`) (`documents.document_number`, `lead_notes.note_number`; helpers
  `noteRef`/`documentRef` in `src/lib/leads.ts`). Shown on note meta lines, document rows, and in
  the viewer header beside the file name — where a note attachment also shows its `NOTE-…` chip, so
  a previewed file always says where it came from. Anything else that creates notes/documents MUST
  allocate its number the same way.
- **References are allocated forward and never reused within their customer.** Deleting a note or
  document does NOT free its number and the counter never rewinds — a reference is an identity, not a count, and recycling
  one silently repoints every email/job sheet/history entry that quotes it. Gaps are expected and
  fine (`next_reference` is gap-tolerant by design). If a screen wants "3rd note on this customer",
  that is a positional label computed at render time, NOT the reference.
- **Attaching to a note offers "Choose file" (already on the record) or "Upload".** Choosing an
  existing document is the duplicate-free path — `attachExistingDocument` shares the storage object
  and the name/category/reference carry across. Prefer offering the picker anywhere files can be
  attached.
- **Never store the same bytes twice.** Files are hashed (SHA-256 → `documents.content_hash`),
  computed in the browser before upload so a duplicate costs one small query, not a wasted upload.
  If the identical file is already on the customer, the user picks: link the existing one
  (`attachDocumentToNote`) or upload another copy. Escape/backdrop takes the non-duplicating
  option. `deleteDocument` still only removes the stored object when no other row references that
  `file_url` — keep that refcount check, since legacy rows may still share objects. (The Documents
  tab's own drag-drop upload does not dedupe yet — same treatment is still to do there.)
- **UI:** `src/components/crm/notes-panel.tsx` — a **two-pane panel like the Documents tab**:
  left (45%) = composer (text + link picker + attach) over the note thread, each note carrying its
  author/date-time stamp, an "Edited by …" button that expands the full version list, inline edit,
  per-note attach and attachment chips; right (55%) = the shared `InlineViewer`, so clicking an
  attachment previews it in place (zoom, download, full screen) instead of opening a tab. Reuses
  `document-viewer.tsx` unchanged — including the cross-origin PDF `reclaimFocus` guard, which
  MUST stay wherever that viewer is embedded.

## Maps & geocoding — built 2026-07-22

One component draws every map in the CRM: **`AddressMap`** (`src/components/crm/address-map.tsx`).
It takes the address as loose fields (`houseNumber`/`street`/`town`/`postcode`…), geocodes them and
renders the result. First use is the customer **Address** tab; leads, contracts and fitting diary
reuse it unchanged. `IllustrativeMap` is the old decorative placeholder — **it is dead weight now,
delete it as each screen moves over** (the lead detail is the last holdout).

- **The pin goes on the BUILDING, not the postcode.** A UK postcode covers ~15 houses, so a centroid
  puts a fitter on the wrong side of the street — and worse, the ONS ward attached to it is often a
  different-sounding place than the address (B77 2RL centroid reports "Bolehall" for an address in
  Glascote). Geocoding is therefore **full-address**, and `lib/geo.ts` reports how well it did:
  `address` · `street` · `postcode` · `outcode`.
- **The map never narrates its own confidence.** An earlier build printed an amber "the exact
  building could not be identified" under a street-level hit and it was rejected on sight — a pin
  that is on the right street reads as broken the moment the UI hedges about it, and staff stop
  trusting every map including the exact ones. **No captions, no confidence badges, no "approximate".**
  Precision still does its work silently: it is recorded in `address_locations`, and it sets the
  zoom (`ZOOM_FOR`) so an outcode match never zooms to rooftop level. If precision genuinely is not
  good enough, the fix is a better geocoder (below), not a disclaimer.
- **Provider chain, best first** (`geocodeAddress` in `src/lib/geo.ts` — the ONLY place any provider
  is named):
  1. **Google Geocoding**, if `GOOGLE_MAPS_API_KEY` is set. Server-only var, never `NEXT_PUBLIC_`.
     ROOFTOP coordinates for UK premises; this is the switch to flip when street-level results are
     not good enough.
  2. **Nominatim** structured search, then free-text. Free, no key. OSM UK street data is excellent,
     house-number coverage is good but **not complete** — that is the source of every `street`-precision
     result, and no code change fixes it.
  3. **postcodes.io** postcode (then outcode) centroid — the safety net.
  A provider that is *unreachable* returns `undefined`, distinct from a clean *not found* (`null`).
  They must never be collapsed: a network blip cached as "this address doesn't exist" is permanent.
- **Every result is cached in `address_locations`** (migration `20260722095000`, **apply BY HAND**),
  keyed by the tenant + the **normalised full address** (`addressKey()`), not by postcode — 3 and 5
  Cathedral Close share a postcode and are not the same place. So an address is geocoded **once per
  tenant, ever**. That is what keeps Nominatim's fair-use policy satisfied (and a Google key cheap):
  the provider sees one request per distinct address in the book, not one per page view. Negative
  results are cached too, with a 30-day TTL so OSM's growing coverage gets another chance.
  **Coordinates are NOT columns on `customers`** — keyed by the address, a corrected street simply
  stops reading the old row, so stale coordinates are impossible by construction.
- **Geocoding runs server-side only** (`src/app/(app)/geo/actions.ts` → `resolveAddress`), so tenant
  addresses are never broadcast from staff browsers to a third party and the cache is shared rather
  than per-session.
- **TWO renderers, split by SURFACE — not by deployment, and not by preference.**
  - **The CARD is always MapLibre GL + OpenStreetMap.** (OpenFreeMap `positron`, the grey style that
    sits inside the zinc palette rather than fighting it; `NEXT_PUBLIC_MAP_STYLE_URL` overrides.)
    This is the surface staff look at all day, so it is the one that stays quiet: **tenant-accent
    pin** and a 10px grey credit, free at any volume however many records get opened. ~200KB gzipped
    and **imported dynamically inside the effect**, so a screen with no map never downloads it.
  - **FULLSCREEN is Google's Maps Embed API**, when `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` is set —
    a **Map / Satellite / Street view** toggle, every mode free and unmetered. A Google logo on a
    full-screen view barely registers, and street view is the whole reason anyone opens it. No key →
    fullscreen falls back to MapLibre and street view becomes a link out.
- **All-Google was tried and reverted on 2026-07-22 — do not re-propose it.** The reasons are
  structural, not aesthetic:
  - **Google's logo and Terms links are contractually unremovable at every tier**, including the JS
    API. OSM's licence explicitly permits the credit *adjacent to* the map; Google's terms prohibit
    obscuring theirs. Going all-Google does not settle the branding question, it makes it worse.
  - **An Embed iframe cannot be styled at all** — it supports no Map IDs, so cloud-based map styling
    does not reach it, and **the marker can never be the tenant's colour**. `PIN_SVG` and the
    `var(--accent-blue)` inheritance story are MapLibre-only.
  - **Nothing in the iframe is programmable**, so a future drag-to-pin cannot be built on it.
  - **Never swap the iframes for the Maps JavaScript API without pricing it first.** The Embed API
    is free; the JS API bills **per map load**, and a map load happens on every record view forever.
    Geocoding is affordable because it caches — a map render cannot be.
- **NO map chrome on the canvas — the credit lives in the card's fine print.** `attributionControl`
  is `false` and `<MapCredit>` renders a 10px grey "© OpenStreetMap" in the footer beside the links.
  Two on-canvas attempts were rejected first: MapLibre's `compact: true` renders **expanded** until
  the user's first drag (it adds `maplibregl-compact-show` alongside `maplibregl-compact` — a real
  trap, not a config mistake), and even collapsed to the ⓘ it is map-tool chrome one click from a
  wall of provider branding. The credit itself **stays**: OSM data is ODbL and attribution is a
  licence condition. The OSM Foundation's guidelines permit it *adjacent to* the map, which is what
  the footer line is. Do not delete it, and note that Google and Mapbox both mandate an on-canvas
  logo — this adjacent-credit approach does not carry over to them.
- **Scroll-wheel zoom is off in a card, on in fullscreen.** A card map sits inside a scrolling tab
  panel and a wheel over the canvas would swallow the page scroll; the overlay has no page behind
  it, so the wheel does the obvious thing. Rotation and pitch are off everywhere — a tilted map
  helps nobody find a house.
- **Fullscreen overlay mirrors the document viewer** — expand button top-LEFT of the canvas (the
  zoom control owns top-right), `fixed inset-0 z-50`, Escape to close, dark chrome header carrying
  the address, the **Map / Satellite / Street view** toggle, and the Directions / what3words links.
  Satellite opens one zoom step tighter than the road map — it is the "what does the plot look like"
  view.
- **The overlay OPENS ON a view, it does not always land on the map.** `fullscreen` state is the
  `GoogleView` to open on (or `null` for closed), so the card's "Street view →" goes straight to the
  pano instead of dumping the user on the map to hunt for the toggle. **Street view must never be a
  link to a new Google Maps tab when the embed key is present** — leaving the app loses the record
  the user was reading. `streetViewUrl()` (Google's keyless Maps URLs scheme) only survives as the
  no-key fallback.
- **The overlay is NOT a portal to `document.body`**, and that is load-bearing: the pin is filled
  with `var(--accent-blue)` from `tenantThemeVars` on the app shell root, so a portalled marker
  silently falls back to platform blue for every tenant with a brand colour. `fixed` covers the
  viewport perfectly well from inside the tree.
- **Street view can only come from Google.** OpenStreetMap has no street-level imagery of its own,
  and the open alternatives (Mapillary, KartaView, Panoramax) are contributor-driven — UK
  residential coverage is patchy, so they fail on exactly the estates a surveyor needs. The **Maps
  Embed API** gives a navigable pano for free; the Street View **Static** API is the metered one —
  **do not** reach for it for thumbnails on a list screen.
  **`heading` is deliberately unset** on the embed: given a bare location Google aims the camera
  from the nearest panorama *towards* that point, i.e. at the front of the building. Supplying our
  own heading needs the bearing from road to house, which we do not know, and would face a hedge as
  often as the property. Coverage is not pre-checked (that needs the keyed metadata endpoint).
- **The embed key is PUBLIC by necessity** (the browser fetches the iframe), so it must be locked in
  Google Cloud to the Maps Embed API and to this app's domains by HTTP referrer. It is the only
  Google key with a `NEXT_PUBLIC_` prefix — `GOOGLE_MAPS_API_KEY` (geocoding) stays server-only.
  Note that Google Cloud requires a **billing account on the project** before it will issue a Maps
  key at all, even for the free-and-unmetered Embed API.
- **Inline and fullscreen each own a MapLibre instance** (`MapCanvas`). Sharing one and re-parenting
  the GL canvas was the alternative and it is worse: the inline map comes back showing wherever the
  user panned to in fullscreen. `MapCanvas` keeps the tile-error callback in a latest-ref so a
  parent re-render never tears the map down and rebuilds it.
- **A map has a FIXED height and never grows with the data**, like every other card (see § Bento
  layout). On the customer record it is its own **Location** card, above Access notes — "where is
  this?" and "how do I get in?" are different questions, and a map wedged under a free-text note
  reads as decoration.
- **Every state says what is wrong and what to do** — locating / not a recognisable address / not
  found / service unreachable (with a Try again). A blank grey rectangle is the worst possible answer
  to "where is this?". Async state is **stamped with the address it belongs to** and the render
  derives from that stamp, so a new address is never drawn at the previous one's coordinates.

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
- **A preview opens at FIT, never at actual size.** Zoom is `number | "fit"` and starts at `"fit"`
  in both the inline and fullscreen viewers — images get `max-width/height:100%`, PDFs get the
  viewer's own page-fit (`view=Fit` for Chromium + `zoom=page-fit` for pdf.js). `zoom=100` means
  actual paper size, so an A4 scan used to open cropped to its top-left corner and every user's
  first move was to zoom out. The percentage button resets to Fit; stepping off Fit lands on
  100% (in) or 75% (out).
- **Viewer** (`document-viewer.tsx`): exports `InlineViewer` (right pane) and `FullscreenViewer`
  (overlay, opened from the pane's maximize button); both share a `Stage` that renders images
  `<img>` (CSS zoom), PDFs via **our own `PdfView`**, text `<iframe>`, else a download card. Zoom
  (− / % / +, 25–400%) shows for images + PDFs only.
  - **Cross-origin focus-steal.** A file `<iframe>` is served from the Supabase storage domain, so
    once focused it eats the first click on the surrounding UI. `DocumentsPanel` blurs the focused
    iframe on `onMouseDownCapture`, and list rows select on `onMouseDown` (not click) — so
    switching files is reliably single-click. Keep both if you touch this. (PDFs no longer use an
    iframe, but text files still do.)
  - Print: images open a print window; PDFs open in a new tab (the browser prints from there).
- **The viewer is LIGHT — canvas grey behind the page, white chrome — inline and full screen alike**
  (changed 2026-07-22; the overlay was previously dark like the map's). A document is a white page,
  so the app canvas frames it the way the rest of the CRM frames a card; the dark treatment made the
  Documents tab look like a different product. `ZoomBar`/`Stage`/`Centered` no longer take a `dark`
  prop — there is one appearance. **Note the map overlay stays dark and that is not an
  inconsistency**: map tiles are imagery, a scan is paper.

### PDFs are rendered by us, with pdf.js — built 2026-07-22

`src/components/crm/pdf-view.tsx` renders each page to a `<canvas>` and frames it ourselves: white
sheet, soft shadow, app canvas behind, pages stacked with a gap. **The browser's built-in viewer was
tried first and could not be made to fit** — it paints its own near-black `#525659` surround inside a
cross-origin `<iframe>`, which no CSS of ours can reach, at any tier of `#toolbar=0` chrome-hiding.
That is the whole reason for the dependency; don't undo it to save 350KB.

- **The worker is a static asset, copied at install time.** `scripts/copy-pdf-worker.mjs`
  (a `postinstall`) copies `pdf.worker.min.mjs` out of `node_modules` into `public/`, and the viewer
  points `GlobalWorkerOptions.workerSrc` at `/pdf.worker.min.mjs`. It is **gitignored** — node_modules
  is the source of truth, so the copy can never drift from the `pdfjs-dist` we actually run. Resolving
  it via `new URL(…, import.meta.url)` was rejected: it puts a runtime asset at the mercy of whichever
  bundler is in play, and this way dev, `next build` and Vercel behave identically.
- **`src/proxy.ts` must keep excluding `pdf.worker.min.mjs`** from the session matcher. A redirect
  hands pdf.js an HTML page where it expects a script, and PDFs fail with nothing useful on screen.
- **pdfjs-dist is imported dynamically, inside the effect**, and memoised in a module-level promise —
  a record with no PDF never downloads it, and it can never run during SSR.
- **Zoom means the same as it always did**: `fit` fits the WHOLE page to the pane (measured from
  page 1 via a `ResizeObserver`), a percentage is paper size — hence `96/72`, since pdf.js scale 1 is
  72dpi. Canvases are rasterised at `devicePixelRatio` (capped at 2) and presented at CSS size, or
  small print is soft on a retina screen.
- **Pages render lazily** (`IntersectionObserver`, 400px margin) and each holds its footprint from
  page 1's aspect ratio before it rasterises, so a long document neither renders up front nor makes
  the scroller jump as pages arrive. Render tasks are cancelled on zoom change and unmount.
- **Teardown is on the LOADING TASK, not the document.** `PDFDocumentProxy.destroy()` does not
  exist in pdf.js 6 — keep the `getDocument()` task and call `task.destroy()` on cleanup (closing
  the full-screen viewer crashed on exactly this). Everything in flight — `getPage`, `render` —
  rejects when the document is torn down, so those awaits are guarded: the rejection IS the
  teardown, not an error to surface.
- **Known trade-off: there is NO text layer**, so a digital PDF can't be selected or searched in
  place. Accepted because most files here are scans; Download opens the real file and Print still
  hands off to the browser. Adding `TextLayer` is the follow-up if anyone asks for search.

- **Loaders** select the shared `DOCUMENT_SELECT` (incl. `uploader:uploaded_by(...)`) and map
  with `mapDocumentRow` → `DocumentItem`. `getCustomerRecord` already does this;
  `CustomerDoc` is now an alias of `DocumentItem`. A standalone `getDocuments(ownerType, ownerId)`
  exists for owners that don't batch-load.

### Gotchas for future work
- **A loader must never let a pending migration blank a record.** Schema here is applied by hand,
  so a select that names a not-yet-existing column has its WHOLE query rejected by PostgREST and
  the screen renders as if the customer had no notes/documents (this happened with
  `note_number`/`document_number`). Loaders now go through `selectWithFallback` with a
  `*_SELECT_BASE` subset — keep that pattern when adding columns to a shared select.
- **Generated types are stale.** Migrations `20260721094000`–`099200` add columns/tables not yet
  in `src/lib/supabase/types.ts`, so data code uses a loose `const db = supabase as any` pattern and
  actions cast insert/update payloads. **Run
  `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`** to restore real typing
  and remove the casts.
- **Inserts set `company_id` via `getCompanyId()`**, which reads `current_company_id()` (the verified
  JWT claim) — NOT `getUser().app_metadata` (that lacks the hook-stamped company_id). Never trust a
  client-supplied tenant id.
- **Schema is applied BY HAND in the Supabase SQL editor**, in order — not `supabase db push` (an
  early hook-policy migration was applied manually, so db push conflicts). For new migrations: add
  the file, then apply the SQL manually, then **reload the PostgREST schema cache**
  (`notify pgrst, 'reload schema';`, or Supabase dashboard → restart) so new columns and embeds
  resolve. **Every migration through `20260722093000` was applied to the remote as of 2026-07-22.**
  Some (`097000`) were re-run as they gained rows.
- **Custom Access Token hook must be enabled** in the cloud dashboard (docs/auth-setup.md §2b) and
  `public.users.read`-for-`supabase_auth_admin` policy present (`20260721093000`) — without them
  the JWT carries no `company_id` and every tenant read is empty.
- **New Customer / New Lead forms still use plain inputs** — not yet brought in line with the inline
  lookups/date-picker. Lead detail fields (source, product type, salesperson) not yet lookup-ified.
