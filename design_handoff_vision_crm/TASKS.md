# Vision CRM — build tasks

Work top to bottom. Each phase should end with passing tests and a working demo before moving on. **Phase 1 (data + multi-tenancy) is the foundation — do it first and do it properly.**

## Phase 0 — Project foundations
- [ ] Initialise repo: TypeScript, Next.js (or preferred React framework), Drizzle ORM, PostgreSQL
- [ ] Environment config (.env): database URL, session secret; local Postgres via Docker Compose
- [ ] Copy `schema.ts` into the project and get `drizzle-kit` migrations generating cleanly
- [ ] Lint/format/test tooling + CI running on push

## Phase 1 — Multi-tenant data layer ← START HERE
**Model: single database, shared schema, `company_id` on every tenant row, enforced by Postgres RLS.**
- [ ] Audit every table in `schema.ts`: add `company_id` where missing on tenant-owned tables
- [ ] Make `company_id` `NOT NULL` + FK → `companies.id` + index on every tenant table
- [ ] Add `updated_at` (+ trigger) alongside `created_at`; soft-delete (`deleted_at`) where records must be recoverable
- [ ] Enable **Row-Level Security** on all tenant tables; policy keyed off `current_setting('app.company_id')`
- [ ] Data-access layer: every request runs in a transaction that does `SET LOCAL app.company_id = $sessionCompanyId` before queries
- [ ] Write an isolation test: tenant A can never read/write tenant B rows, even with a deliberately unscoped query
- [ ] Per-tenant reference sequences: `lead_number`, `contract_number`, quote/PO refs (`QUOTE-1042`, `CT-2049`, `VSN-PO-2107` pattern) — atomic, gap-tolerant, unique per company
- [ ] Seed script: platform demo tenant ("Vision", blue `#2f7de1`) + first real tenant ("Bradley Scott Windows", red `#e5040a`) with a handful of customers/leads each
- [ ] Migration + rollback tested from empty DB

### Phase 1b — Scale & noisy-neighbour safeguards (build in from day one)
- [ ] Background job queue (e.g. pg-boss/BullMQ) for anything heavy — CSV imports, report exports, bulk email/SMS — with per-tenant concurrency caps; web requests never do heavy work inline
- [ ] Postgres `statement_timeout` (~10s) on the app role so a runaway query is killed, not the server
- [ ] Per-tenant rate limits on API and bulk endpoints
- [ ] Connection pooling (PgBouncer or host equivalent) from the start
- [ ] Per-tenant export/restore script: dump or restore ONE tenant's rows by `company_id` (also doubles as the tenant-offboarding data export)
- [ ] Basic per-tenant usage metrics (rows, storage, job minutes) so future "whale" tenants are visible early

### Phase 1c — Keep the sharding door open (pod-ready rules)
Goal: if the platform ever outgrows one database, tenants can be moved in groups ("pods" — e.g. 100 tenants per DB) with no schema change. These rules make that a routine job instead of a rewrite:
- [ ] **Catalog concept**: tenant → database routing lives in one place. Day one it's trivial (every tenant → the single DB URL), but resolve the connection through it from the start (e.g. `getDbForCompany(companyId)`) — never a hard-coded global client in feature code
- [ ] All primary keys are UUIDs (already the case in `schema.ts`) — rows can move between databases without ID collisions
- [ ] **No cross-tenant queries in app features** — aggregate/platform analytics go through a separate reporting path, never joins across companies inside the app
- [ ] All tenant data access goes through the single data-access layer (no ad-hoc SQL scattered in routes), so re-pointing a tenant's connection touches one file
- [ ] Shared/global tables (users-at-platform-level, billing, the companies catalog itself) are explicitly marked as such in the schema — everything else must carry `company_id`
- [ ] Document the future migration recipe: provision new DB → run same migrations → copy one tenant's rows by `company_id` → flip catalog entry → verify → delete from old. Should be executable per-tenant with brief read-only mode, not a big-bang

## Phase 2 — Auth, users & tenant resolution
- [ ] Users, sessions, password auth (schema already has `users`/`sessions`)
- [ ] User↔company membership with roles: owner, admin, office, sales, installer
- [ ] Tenant resolution: subdomain (`bsw.visionapp.…`) or post-login company selection → sets session `company_id`
- [ ] Server-side guard: tenant ID only ever from session, never from request body/params
- [ ] Platform-level superadmin role for tenant provisioning
- [ ] Tenant provisioning flow: create company (name, slug, brand colours, logo) → owner invite

## Phase 3 — Tenant theming & app shell
- [x] Theme provider: `--accent`, `--accent-hover`, `--accent-tint` (+ logo, name) from the `companies` row; Vision blue defaults — `src/lib/theme.ts` (`tenantThemeVars`), applied on the shell root in `src/app/(app)/layout.tsx`; hover/active/tint derived from `brand_color_1` via `color-mix`
- [x] Load Vision tokens (Inter Tight / Inter / JetBrains Mono, neutral ramp, radii, shadows) as global CSS — fonts in `layout.tsx`, tokens mapped in `globals.css`
- [x] Icon-rail sidebar per `VisionSidebar.dc.html`: fixed nav order, 44px circular items, accent-filled active state — `src/components/app-shell/sidebar.tsx` + `nav.ts`
- [x] Topbar: tenant logo mark, pill search, user chip, accent action button — `src/components/app-shell/topbar.tsx` (search + `+` action are visual placeholders; wire up in later phases)
- [x] Base components: Button (primary/secondary/ghost/danger), Input, Select, status Chip, Card, Table, Dialog, Toast, Tabs, ProgressBar — shadcn set already in `src/components/ui`, mapped to Vision tokens in `globals.css`; added `chip.tsx` (semantic tints, accent tone rebrands)
- [x] Verify the whole shell rebrands correctly by switching between Vision and BSW seed tenants — accent flows from `companies.brand_color_1`; log in as a Vision user (blue `#2f7de1`) vs a BSW user (red `#e5040a`) to see the rail/CTAs/accent surfaces re-colour. Not yet visually smoke-tested in a browser.

## Phase 4 — Customers & leads (core CRM) — DONE 2026-07-23
- [x] Customers list: search, filters, configurable/resizable/sortable columns, continuous scroll; New Customer wizard with UK address fields + postcode
- [x] Leads list with stage pipeline; New Lead wizard (source, product interest, salesperson — all tenant-editable lookups)
- [x] Lead detail: tabbed record — overview, checklist items, notes, documents, activity timeline
- [x] Lead stage transitions + stage badges per design
- [x] Dashboard v1: KPI stats, pipeline by stage, lead sources, today's diary (live data)

Carried into later phases by design: the lead record's **Quotes** tab and the "Convert to Contract"
button (Phase 5), "Book survey" (Phase 6), and the dashboard's richer analytics widgets (team
performance / revenue-by-month still show representative figures until their data paths land).

## Phase 5 — Quoting & contracts
- [ ] Quote builder: line items, pricing, gross/net, VAT
- [ ] Quote send/track states (sent, awaiting decision, accepted, lost)
- [ ] Convert quote → contract (dialog per design); contract numbering
- [ ] Contract detail: payments/stage tracking

## Phase 6 — Diary & scheduling
- [ ] Week/day calendar: surveys, installations, service calls (fixed block-colour legend)
- [ ] Fitting appointments linked to contracts; team assignment
- [ ] Provisional vs confirmed states (dashed vs solid per design)

## Phase 7 — Stock, purchase orders, financials
- [ ] Suppliers, stock items (SKU pattern), purchase orders (`VSN-PO-…`), delivery lines
- [ ] Invoices & payments; overdue states (platform danger red, not tenant accent)

## Phase 8 — Comms & workflows
- [ ] Email/SMS templates + sending (tenant sender identity); message threads on lead/contract
- [ ] Workflow automation: triggers (stage change, dates) → tasks/messages
- [ ] Notifications centre

## Phase 9 — Later
- [ ] Mobile admin app (separate design file: `Vision Mobile Admin.dc.html` in the design project)
- [ ] Installer app (`Vision Installer App.dc.html`)
- [ ] Customer-facing portal
- [ ] Tenant billing/subscription
