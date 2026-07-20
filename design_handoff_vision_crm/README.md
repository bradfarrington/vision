# Handoff: Vision CRM — multi-tenant platform build

## Overview
**Vision** (by Digital Craft) is a multi-tenant SaaS operating system for home-improvement installers (windows, doors, conservatories, roofing). It runs the whole business: leads → quotes → contracts → diary/scheduling → stock & purchase orders → financials → customer comms → workflows, plus mobile apps for office admins and on-site fitters.

This bundle is the handoff for the **web CRM** — the desktop app an installer's office staff use all day. The first real tenant will be **Bradley Scott Windows (BSW)**; the designs here are the **tenant-neutral Vision base** (Vision blue accent, Vision logo). BSW's branding (Bradley Red `#e5040a`, BSW logo) is applied later purely through tenant theming — never hard-coded.

## About the design files
The `.dc.html` files are **design references built in HTML** — high-fidelity prototypes showing intended look and behaviour, **not production code to ship**. The task is to recreate these screens in a real codebase. No production frontend exists yet; a sensible default stack is **React (Next.js or Vite) + TypeScript + Drizzle ORM + PostgreSQL**, which matches the included `schema.ts` (Drizzle/pg). If you choose differently, keep the schema semantics.

Open `Vision CRM Screens.dc.html` in a browser to view every screen (it's a large scrollable canvas; sections are labelled 00, 00b, then category by category: Core CRM, Diary & Scheduling, etc.).

## Fidelity
**High-fidelity.** Colours, type, spacing, radii, shadows and copy are final. Recreate pixel-perfectly, but implement with proper components and design tokens — not by copying the inline-styled HTML.

## Architecture — multi-tenancy (decided)
**Single PostgreSQL database, single shared schema, `company_id` column on every tenant-owned row** — this is already how `schema.ts` is written (`companies` table + `companyId` on `customers`, `leads`, etc.).

Why this model (and not schema-per-tenant or DB-per-tenant):
- Target tenants are small firms (5–100 staff); row counts per tenant are modest. One DB scales to hundreds of such tenants comfortably.
- One migration path — schema-per-tenant multiplies every migration, backup and connection-pool problem by tenant count.
- Cross-tenant platform features (billing, admin, aggregate analytics) stay trivial.
- Every row already carries `company_id`, so a heavyweight tenant can be extracted to its own DB later if ever needed.

**Non-negotiable safeguards:**
1. `company_id` must be `NOT NULL` + FK to `companies` + indexed on every tenant table (currently nullable in `schema.ts` — fix this).
2. **Postgres Row-Level Security (RLS)** on every tenant table, keyed off a per-request setting (e.g. `SET LOCAL app.company_id = ...`), so isolation holds even if application code forgets a `WHERE` clause.
3. All queries additionally scoped by `company_id` in the data-access layer (defence in depth).
4. Tenant resolution from the session/subdomain — never from client-supplied IDs.
5. Per-tenant sequences for human reference numbers (`lead_number`, `contract_number`, quote refs like `QUOTE-1042`, `CT-2049`, `VSN-PO-2107`).

## Tenant theming
Two layers:
1. **Platform chrome (Vision)** — fixed for all tenants: fonts (Inter Tight for display/headings, Inter for body/UI, JetBrains Mono for reference codes/currency/postcodes/tabular figures), neutral grey ramp, white surfaces, 1px `#e7e7ea` hairlines, 12px card radius / 8px control radius, soft shadows, 120–200ms motion, quiet semantic colours (success `#1f9d63`, warning `#c77d1a`, danger `#d64545`).
2. **Tenant brand** — exactly three things from the `companies` row: accent colour (`brand_color_1`, + hover/tint derived or `brand_color_2`), logo (`logo_url`), and company name. Implement as CSS variables set at the app root per tenant, e.g. `--accent`, `--accent-hover`, `--accent-tint`. The Vision base uses `--accent: #2f7de1`, hover `#2568c2`, active `#1f56a3`, tint `#eaf2fd`. BSW will set `#e5040a` / `#b8030a` / `#fde6e7`.

Everywhere the designs show Vision blue (primary buttons, active nav, focus rings, selected rows, chart highlight bars, progress fills) is the **accent slot** → use `var(--accent)`. Semantic colours (success/warning/danger) are platform-fixed and identical for every tenant.

## Screens / views (in `Vision CRM Screens.dc.html`)
- **Section 00 — Design system reference:** colour, type, buttons, status chips, inputs, and the fixed app-shell nav order (1 Dashboard, 2 Customers, 3 Leads, 4 Contracts, 5 Diary, 6 Quoting, 7 Stock, 8 Financials, 9 Communications, 10 Marketing, 11 Workflows, + Notifications/Settings at bottom).
- **Section 00b — Platform chrome components:** toasts, alerts, dialogs (e.g. "Convert quote"), stage badges (dot + tint pill), progress bars, diary block colour legend.
- **App shell:** 76px icon-rail sidebar (circular 44px buttons, accent-filled when active — see `VisionSidebar.dc.html`), 62px topbar with logo mark, pill search bar, user chip, accent circular action button. Content sits on a soft grey canvas (`#f4f4f5`) inside a white rounded panel; screens are designed at 1440×1010.
- **Dashboard:** KPI stat cards (with delta pills), pipeline stage bar, lead sources list with proportion bars, revenue/lead bar charts (accent highlight on current period), team performance table, today's diary list, top-source accent card.
- **Core CRM screens:** Customers, Leads (list + detail with checklist/tasks/notes), Contracts, quoting flows, email/SMS comms threads (sender ID "Vision"), customer-facing portal pages, stock & purchase orders (`VSN-PO-…`), and more — every field name maps to `schema.ts` (`leads.gross_value`, `delivery_lines`, `fitting_appointments`, `lead_checklist_items`…). Amber "PROPOSED" chips mark fields not yet in the schema.
- **Diary & Scheduling:** week/day calendar, fixed block-colour legend (Installation = accent tint, Survey = amber, Service = green…), provisional bookings dashed until confirmed, fitting-team assignment.

## Design tokens
Load from `_ds/vision-design-system-7d86eb4e-98d4-48b5-899a-963640d95f74/` (`tokens/*.css`, `styles.css`) — colours, type scale, spacing (4px grid), radii (8/12/16/999px), shadows, motion. Key values: ink `#101418`, deep panel `#0f1620`, accent `#2f7de1`, canvas `neutral-50 #f7f9fb`, hairline `#e2e7ee` (screens also use `#e7e7ea`/`#f4f4f5` from the prototype's neutral ramp — reconcile to one ramp when tokenising).

## Data
`schema.ts` (Drizzle, PostgreSQL) is the source of truth for entities and field names: `companies`, `users`/`sessions`, `customers`, `leads` (doubles as quotes/contracts via status + `contract_number`), plus line items, deliveries, fitting appointments, checklist items, etc. Treat it as the starting point, not finished: tighten nullability, add FKs/indexes/RLS as per TASKS.md Phase 1.

## Interactions & behaviour (high level)
- Hover: surfaces darken one neutral step; cards lift shadow; primary button → accent-hover. Press: one step darker. No scale effects.
- Focus: 3px soft accent ring + accent border, always keyboard-visible.
- Motion: 120–200ms, `cubic-bezier(0.2,0,0,1)`, fades/short slides only.
- Status chips: pill, tint background + strong text colour (fixed set — see Section 00).
- British English, sterling (£), sentence case; reference codes always JetBrains Mono.

## Assets
- `assets/vision-mark.png` — graphite "v." mark, transparent, for light surfaces.
- `assets/vision-mark-white.png` — white "v." mark, transparent, for dark/accent surfaces.
- `assets/vision-lockup.png` — "vision. by digital craft" lockup.
Tenant logos are uploaded per tenant (`companies.logo_url`) and replace these in tenant-scoped chrome.

## Files
- `Vision CRM Screens.dc.html` — full CRM screen set (open in browser; needs `support.js`, `VisionSidebar.dc.html`, `image-slot.js`, `assets/`, `_ds/` alongside).
- `VisionSidebar.dc.html` — icon-rail sidebar component reference (nav order + icon set).
- `_ds/vision-design-system-…/` — token CSS + design-system bundle.
- `schema.ts` — Drizzle schema (data model source of truth).
- `TASKS.md` — staged build plan; work through it phase by phase.
