---
name: email-builder
description: Drop-in MJML email builder + Resend campaign send pipeline + system/transactional template flow, extracted from GamLEARN CRM. Use when adding marketing email or transactional email infrastructure to a React + Vite + Supabase app — block-based drag/drop editor, merge tags, mailing lists, one-click unsubscribe, optional system templates seeded by key.
---

# Email Builder skill

A self-contained, reusable email-marketing module ripped from the GamLEARN CRM. Drop it into any **React + Vite + Supabase** project that needs:

- A **block-based drag-and-drop email designer** (heading, text, image, button, columns, social, countdown, video, custom HTML)
- **MJML → HTML** rendering (responsive emails that render correctly across clients)
- **Merge tag substitution** (`{{person_name}}`, etc.) — configurable per project
- **Mailing-list-based campaign sends** via Resend, with per-recipient unsubscribe tokens and RFC 8058 one-click headers
- **Reusable templates** (save designs, reload them later)
- **System / transactional templates** keyed by string (e.g. `staff_invite`, `password_reset`) with seeded defaults

## When to use this skill

Invoke when the user wants to:
- Add an email-marketing / campaign feature to a Supabase app
- Add transactional emails (invites, password resets, notifications) with a customisable design
- Port the GamLEARN email builder into a new project
- Understand or modify the email builder

Do **not** invoke for:
- 1:1 user-to-user email (the GamLEARN build uses Microsoft Graph for that — not bundled here)
- HTML-template-only flows (this skill is for projects that want a visual editor)

## What's in the bundle

The full implementation lives in `bundle/` next to this file. File map:

```
bundle/
├── src/features/email-marketing/
│   ├── EmailBuilderPage.tsx       — Full-screen 3-pane editor (palette / canvas / inspector)
│   ├── CampaignSendDrawer.tsx     — Pick list, preview count, send via Resend
│   ├── ListMembersModal.tsx       — Add/remove people from a list
│   ├── EmailBuilder.css           — Self-contained styles (uses CSS-var shim)
│   └── builder/
│       ├── constants.ts           — Block defs, MERGE_TAGS registry, SAMPLE_DATA, brand colour
│       ├── mjml.ts                — blockToMjml() + generateEmailHtml() — MJML render pipeline
│       ├── panels.tsx             — BlockPreview, PreviewMode, GlobalSettingsPanel
│       ├── components.tsx         — ColorField, FontPicker, ImageUploadButton, MergeTagInsert
│       ├── BlockEditPanel.tsx     — Right-side per-block inspector
│       └── systemTemplates.ts     — Seeded defaults for system_email_templates rows
├── supabase/
│   ├── migrations/
│   │   └── 001_email_builder.sql  — Consolidated schema (campaigns, lists, templates, recipients, opt-outs, storage bucket)
│   └── functions/
│       ├── _shared/
│       │   ├── supabase.ts        — getSupabase() service-role client + corsHeaders
│       │   └── unsubscribe.ts     — HMAC token sign/verify + buildUnsubUrl
│       ├── send-campaign/
│       │   └── index.ts           — Bulk send via Resend, merge-tag resolution, background work, bell notification
│       └── unsubscribe/
│           └── index.ts           — Public GET/POST endpoint for one-click unsub
└── INTEGRATION.md                 — Step-by-step playbook (read on demand)
```

## Integration playbook (high-level)

Read [bundle/INTEGRATION.md](bundle/INTEGRATION.md) for the full walkthrough. Quick version:

1. **Install deps**: `npm i mjml-browser react-quill-new dompurify lucide-react @supabase/supabase-js react-router-dom`
2. **Copy** `bundle/src/features/email-marketing/` into the project's `src/features/`
3. **Adjust the four import paths** inside the bundled `.tsx` files (Supabase client, `useConfirm`, `useAuth`, UI primitives — they assume GamLEARN's layout)
4. **Run the migration** `bundle/supabase/migrations/001_email_builder.sql` in the Supabase SQL editor
5. **Deploy the edge functions** `send-campaign` and `unsubscribe` (`supabase functions deploy …`)
6. **Set env vars** in the Supabase dashboard:
   - `RESEND_API_KEY` — from resend.com
   - `UNSUBSCRIBE_BASE_URL` — e.g. `https://yourapp.com/unsubscribe` (frontend page that POSTs to the edge function)
   - `UNSUBSCRIBE_SECRET` — 32+ random bytes (`openssl rand -hex 32`)
   - `CAMPAIGN_FROM_EMAIL` — fallback from address, e.g. `"Your App <hello@yourapp.com>"`
7. **Add a route** for `/communications/builder` pointing at `EmailBuilderPage`
8. **Customise** the `MERGE_TAGS` registry in `builder/constants.ts` for the target project's data model

## Required dependencies in the host project

The bundled `.tsx` files import from these relative paths — either provide compatible modules or update the imports:

| Import in bundle | What it needs to provide |
|---|---|
| `../../lib/supabase` | `export const supabase = createClient(url, anonKey)` |
| `../../contexts/AuthContext` | `useAuth()` returning `{ user, profile }` where `profile.email` exists |
| `../../components/ui/ConfirmModal` | `useConfirm()` returning `{ confirm, alert }` (see GamLEARN's for reference) |
| `../../components/ui/primitives` | `<Button>`, `<Icon>`, `<Avatar>` |
| `../../components/ui/Dropdown` | `<Dropdown value options onChange placeholder>` |
| `../../components/ui/DatePicker` | `<DatePicker value onChange placeholder>` (ISO YYYY-MM-DD) |

If the host project doesn't have these primitives, the user has two options:
- (a) **Copy** GamLEARN's primitives over too (they're under `src/components/ui/`)
- (b) **Inline-replace** the imports with native equivalents — call out exactly which files need touching: `EmailBuilderPage.tsx`, `CampaignSendDrawer.tsx`, `BlockEditPanel.tsx`, `ListMembersModal.tsx`, `panels.tsx`, `components.tsx`

## Database schema the edge functions expect

The `send-campaign` function references several tables. The consolidated migration creates the **email-builder-specific** ones, but you also need (or need to stub):

**Required (created by migration):**
- `comms_campaigns`, `comms_lists`, `comms_list_members`, `comms_email_templates`, `comms_campaign_recipients`, `system_email_templates`, `email_opt_outs`, `org_settings`
- Storage bucket: `email-images`

**Required (must already exist in host project):**
- `people` (id, full_name, email, phone, ref_code, address, region, preferred_name, marketing_opt_out)
- `profiles` (id, full_name, email, role)
- `notifications` (user_id, type, title, body, link) — for the post-send bell ping

**Optional (gracefully degrades to empty merge values if absent):**
- `cases`, `support_actions`, `case_check_ins`, `communications` — the send function tries to enrich emails with case context per recipient. If these tables don't exist, the merge tags resolve to empty strings.

To make the send function project-agnostic, **strip the `buildCaseContext()` function** in `bundle/supabase/functions/send-campaign/index.ts` (search for `buildCaseContext`) and remove its call sites. That removes the dependency on cases/support tables.

## Customisation hot-spots

When integrating into a different app, expect to touch:

1. **Merge tag registry** — `builder/constants.ts`, `MERGE_TAGS` array. Add/remove groups to match the target app's data model.
2. **Sample data** — `builder/constants.ts`, `SAMPLE_DATA`. Make the preview look realistic for the new domain.
3. **Server-side merge resolution** — `send-campaign/index.ts`, `buildPersonContext()` and `buildCaseContext()`. These must mirror the client-side `MERGE_TAGS`.
4. **System template keys** — `builder/systemTemplates.ts` plus the seed rows in the migration. The GamLEARN keys (`staff_invite`, `notif_*`, etc.) are domain-specific — replace with the target app's.
5. **Brand colour** — `BRAND` constant in `builder/constants.ts` (defaults to GamLEARN purple `#4B0082`).
6. **`org_settings` columns** — the send function reads `campaign_from_name`, `campaign_from_email`. If the host project uses different column names, adjust the query.

## Architectural notes worth knowing

- **MJML lives in the browser.** `mjml-browser` is bundled client-side, so the render pipeline doesn't require any server runtime. The generated HTML is cached on the row (`body_html`) at save time so send paths don't re-render.
- **Background sends.** The Resend send loop runs inside `EdgeRuntime.waitUntil(...)` — the function returns 202 immediately, the actual sends happen in the background, and a `notifications` row pings the triggering user when it finishes.
- **Unsubscribe is cascade-global.** Clicking unsubscribe sets `people.marketing_opt_out = true` AND removes the person from every `comms_list_members` row. There's no per-list opt-out granularity.
- **Test sends bypass the DB.** When `test_email` is set on `send-campaign`, no `comms_campaign_recipients` rows are written and the campaign status is unchanged.
- **System templates are seeded empty** in the migration. The builder fills in defaults from `systemTemplates.ts` on first open and persists them.
- **Block reordering is vanilla React DnD** (no library). Drop indicators show insertion point.
- **No tests** — the GamLEARN source had none. If adding, start with `blockToMjml()` per block type and merge-tag substitution edge cases.

## Things this skill deliberately does NOT include

- **Outlook / Microsoft Graph 1:1 send path** — GamLEARN's `outlook-send` function is for per-user mailbox sends; out of scope for a marketing builder.
- **Resend webhook handler** (`resend-webhook`) for processing opens/clicks/bounces — included in GamLEARN but not bundled here because it's optional. Add later if you want engagement tracking.
- **Public unsubscribe React page** — the edge function is here, but the recipient-facing UI page that hits it is project-specific. Skeleton: GET to `/unsubscribe?t=<token>` shows email + Confirm button; Confirm POSTs to the same edge function URL.
- **Storage RLS for non-Supabase backends** — assumes you're using Supabase Storage for image uploads.
