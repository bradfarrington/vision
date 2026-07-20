---
name: online-store
description: Drop-in online store + storefront for React + Vite + Supabase apps — admin product/variant/inventory/orders/discounts/gift-cards/shipping/SEO management, a block-based page builder, and a public storefront with cart, checkout, and Stripe payments. Bundles the full source, consolidated schema migration, RLS policies, and the three Stripe edge functions extracted from the Isobex Lasers CRM.
---

# Online Store skill

A complete ecommerce module ripped from the Isobex Lasers CRM. Drop it into any **React + Vite + Supabase** project that needs both a back-office store admin AND a customer-facing shop.

What you get:
- **Admin store** (`/store`) — 20 pages: products list, product editor (variants/media/options/labels/collections/compatibility/reviews), collections, inventory + barcode scanning, stock movements log, discount codes, gift cards (with design templates), shipping zones/rates, SEO per page, custom-domain settings, and a unified **page builder** that themes every storefront route.
- **Storefront** (`/shop` or your custom domain root) — home, products grid, product detail, collections, collection detail, gift cards, cart sidebar, checkout (Stripe Payment Element), thank-you page. Renders blocks edited in the page builder via `BlockRenderer`.
- **Stripe payment pipeline** — three edge functions: create payment intent (`stripe-checkout`), webhook handler that marks paid, deducts inventory, triggers confirmation emails/SMS, and handles refunds (`stripe-webhook`), and a server-initiated refund (`stripe-refund`).
- **Consolidated schema** — one SQL migration that creates every table the bundle touches (products, variants, options, media, collections, orders, order_items, discounts, gift_cards, shipping_zones/rates, store_config, store_pages, page_seo, stock_movements, analytics, stripe_settings, plus lookups), with RLS policies for both authenticated CRM staff and anonymous storefront visitors.
- **Block-based page builder** — 23 block types (hero, half_hero, product_grid, collection_showcase, ticker, FAQ, etc.) — admins compose `/shop/*` route layouts in `UnifiedBuilder`, and the storefront renders them with the same `BlockRenderer` for perfect WYSIWYG.

What you DON'T get:
- A **payment provider other than Stripe** — Stripe is hardcoded. To swap to Adyen/Square/etc., fork the three edge functions.
- An **inbound order-fulfilment/shipping label workflow** — orders surface in your existing orders module (this skill assumes you wire that up separately).
- **Subscription/recurring billing** — one-shot purchases only. Subscription support would need new tables and a different Stripe flow.
- **Multi-currency / multi-language storefront** — `store_config.currency_code` is set per install; the bundle is currency-aware but not locale-aware.
- The **transactional email templates** that `stripe-webhook` triggers — those live in the host project's email layer (the `send-email` edge function and templates). Pair with the `email-builder` skill if your project doesn't already have one.
- The **send-email / send-sms edge functions** that `stripe-webhook` invokes — those belong to the host project's email/SMS infrastructure. If your project uses the `email-builder` or `sms-credits` skills, they're already there.

## When to use this skill

Invoke when the user wants to:
- Add an online store + storefront + payments to a Supabase app.
- Port the Isobex Lasers / GamLEARN ecommerce stack into a new project.
- Understand or modify the existing store/storefront features.

Do **not** invoke for:
- Pure ordering-without-payments flows — the bundle assumes Stripe is in the loop.
- 1:1 invoice generation outside the cart/checkout flow.
- Anything purely CRM-related (contacts, pipelines, etc).

## What's in the bundle

```
bundle/
├── src/
│   ├── features/
│   │   ├── store/                  — Admin (20 files, ~11k LOC)
│   │   │   ├── StorePage.tsx                   — Products list
│   │   │   ├── ProductEditorPage.tsx           — Single product editor (1.4k LOC)
│   │   │   ├── CollectionsPage.tsx
│   │   │   ├── InventoryPage.tsx               — Stock + barcode scan + barcode label printer
│   │   │   ├── StockMovementsPage.tsx          — Audit log
│   │   │   ├── StockUpdateModal.tsx + .css
│   │   │   ├── BarcodeLabelPrinter.tsx + .css  — jspdf-based label sheet output
│   │   │   ├── DiscountsPage.tsx + .css
│   │   │   ├── GiftCardsPage.tsx + design renderer (GiftCardDesign.tsx + .css)
│   │   │   ├── ShippingPage.tsx
│   │   │   ├── SeoPage.tsx
│   │   │   ├── DomainPage.tsx
│   │   │   ├── PageBuilderPage.tsx             — Per-page builder (per-route customisation)
│   │   │   ├── UnifiedBuilder.tsx + .css       — Full-screen 3-pane builder (1.5k LOC)
│   │   │   ├── BlockEditor.tsx                 — Per-block inspector (2.5k LOC — biggest file)
│   │   │   ├── BlockLibrary.tsx                — Draggable block palette
│   │   │   ├── GlobalSettingsEditor.tsx        — Header / footer / theme tokens
│   │   │   ├── LinkPicker.tsx                  — Block-config helper (page/product/collection links)
│   │   │   ├── PageBuilder.css
│   │   │   └── StoreTabBar.tsx                 — Sub-nav for the /store/* admin section
│   │   └── storefront/             — Public-facing storefront (16 files, ~4k LOC)
│   │       ├── StorefrontLayout.tsx + .css     — Wraps every /shop route, provides CartProvider + StoreConfigProvider
│   │       ├── StorefrontHome.tsx              — Renders store_pages.home blocks
│   │       ├── StorefrontProducts.tsx
│   │       ├── StorefrontProductDetail.tsx
│   │       ├── StorefrontCollections.tsx
│   │       ├── StorefrontCollectionDetail.tsx
│   │       ├── StorefrontGiftCards.tsx         — Custom one-off gift-card purchase flow
│   │       ├── StorefrontCheckout.tsx          — Stripe Payment Element + discount/gift-card application
│   │       ├── StorefrontThankYou.tsx
│   │       ├── CartSidebar.tsx
│   │       ├── BlockRenderer.tsx               — Renders every PageBlock type (1.25k LOC)
│   │       ├── SocialIcons.tsx
│   │       ├── UnsubscribePage.tsx             — Public unsubscribe handler (lives outside StorefrontLayout)
│   │       ├── useCart.tsx                     — CartProvider + useCart() hook, localStorage-persisted
│   │       ├── useStoreConfig.tsx              — StoreConfigProvider + formatPrice() helper
│   │       └── storefrontPaths.ts              — Centralised /shop/* path strings
│   ├── lib/
│   │   └── storeApi.ts                         — All store-related Supabase calls extracted from the host CRM's api.ts
│   └── types/
│       └── database.ts                         — TypeScript types for every store entity
└── supabase/
    ├── migrations/
    │   ├── 001_store_schema.sql                — Tables, indexes, sequences, RPC for publishable key
    │   └── 002_store_rls.sql                   — RLS policies (auth full CRUD + anon scoped)
    └── functions/
        ├── stripe-checkout/index.ts            — Create Stripe PaymentIntent for an order
        ├── stripe-webhook/index.ts             — payment_intent.succeeded / charge.refunded handler (deduct inventory, trigger emails/SMS)
        └── stripe-refund/index.ts              — Admin-initiated refund (restores inventory, triggers refund email)
```

Plus [bundle/INTEGRATION.md](bundle/INTEGRATION.md) — step-by-step playbook to wire it into a new host project.

## Integration playbook (high-level)

Read [bundle/INTEGRATION.md](bundle/INTEGRATION.md) for the full walkthrough. Quick version:

1. **Install deps** (in the host project):
   ```bash
   npm i @stripe/react-stripe-js @stripe/stripe-js html5-qrcode jspdf lucide-react react-router-dom @supabase/supabase-js
   ```
2. **Run the migrations** (in this order, in the Supabase SQL editor):
   - `bundle/supabase/migrations/001_store_schema.sql`
   - `bundle/supabase/migrations/002_store_rls.sql`
3. **Deploy the three edge functions**:
   ```bash
   supabase functions deploy stripe-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase functions deploy stripe-refund
   ```
   `stripe-webhook` is called by Stripe (not by your authenticated users) — JWT must be off.
4. **Configure Stripe**:
   - Add your `pk_…`, `sk_…`, and `whsec_…` to the seeded row in `public.stripe_settings` via SQL UPDATE.
   - In Stripe Dashboard, register a webhook → `https://<project>.supabase.co/functions/v1/stripe-webhook` listening to `payment_intent.succeeded`, `charge.refunded`, `checkout.session.completed` (the last is only used by the phone-numbers feature — safe to omit).
5. **Copy** `bundle/src/features/store/` and `bundle/src/features/storefront/` into the host project's `src/features/`, then either:
   - Drop `bundle/src/lib/storeApi.ts` next to your existing `api.ts` and update the bundle's imports from `import * as api from '@/lib/api'` to `import * as api from '@/lib/storeApi'`, **or**
   - Merge the contents of `storeApi.ts` into the host project's existing `api.ts` and leave the bundle imports alone.
6. **Copy** `bundle/src/types/database.ts` into `src/types/` (merging with any existing types file there).
7. **Wire routes**: import `StorePage`, `ProductEditorPage`, `UnifiedBuilder`, `InventoryPage` etc. into the host's router and mount the storefront via `<Route path="/shop/*" element={<StorefrontLayout />}>`. Full route table is in `INTEGRATION.md`.
8. **Provide the UI primitives** the bundled `.tsx` files import — see the dependency table in `INTEGRATION.md`.

## Required host-project dependencies

The bundled `.tsx` files import from these relative paths — your host project must provide compatible modules or you must update the imports:

| Import in bundle | What it needs to provide |
|---|---|
| `@/lib/supabase` | `export const supabase = createClient(url, anonKey)` |
| `@/lib/api` | The store-relevant CRUD wrappers — merge `bundle/src/lib/storeApi.ts` in, or re-point bundle imports at it |
| `@/types/database` | The TypeScript types from `bundle/src/types/database.ts` |
| `@/components/ui/AlertDialog` | `useAlert()` returning a confirm/alert function (drop in any modal hook) |
| `@/components/ui/ColorPicker`, `DatePicker`, `MultiSelect`, `SearchableSelect` | Form primitives used by the admin pages |
| `@/components/layout/PageShell` | Page wrapper with the shared admin chrome (header, sub-nav) |
| `@/context/DataContext` | `useData()` returning whatever the host CRM caches globally — used by the admin pages to read tags/lookups |
| `@/hooks/useTracking` | `useTracking()` for analytics ping-back from the storefront (writes to `page_views` + `ecommerce_events`) — stub if your project doesn't track |
| `react-router-dom` | v6+ for `Link`, `useNavigate`, `useParams`, `useLocation`, `useSearchParams` |

If the host project doesn't have these UI primitives, the user has two options:
- (a) **Copy** the matching primitives across from a sibling project.
- (b) **Inline-replace** the imports with the host project's equivalents — the files that need touching are mostly the admin pages (every file in `src/features/store/` except `BlockEditor.tsx`, plus `StorefrontCheckout.tsx`).

## Required Supabase Edge Function secrets

The Stripe credentials are stored in the `stripe_settings` table (NOT as edge-function env vars) so they can be rotated per-org via the admin UI. The only env vars the functions need are the auto-injected `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

If the host project's `stripe-webhook` should also trigger emails/SMS on order completion, those depend on the host project also having `send-email` and `send-sms` edge functions deployed (see `email-builder` and `sms-credits` skills). The webhook **soft-fails** if those endpoints are missing — the order still marks paid and inventory still deducts, you just don't get a confirmation email.

## Required host-project tables (NOT created by this skill)

`storeApi.ts` and `stripe-webhook` reference a few tables from outside the store layer:

- **`contacts`** — `findOrCreateContact()` reads + writes this when an anonymous checkout happens, to attach a `contact_id` to each new order. Must have `first_name`, `last_name`, `email`, `phone`, `contact_type`, `source`, `unsubscribed` columns at minimum. If your project has a different customer layer, fork `findOrCreateContact()`.
- **`companies`** — optional; the bundle does a `companies(*)` join when looking up an existing contact. Drop the join if you don't have it.
- **`app_users`** — optional; `adjustStock()` looks up the actor's display name from this table for the `stock_movements` audit log. Falls back to the JWT email if absent.

The migrations do NOT touch these — they're host-project concerns.

## Customisation hot-spots

When integrating, expect to touch:

1. **Brand colour + visual style** — the admin pages use the host CRM's design tokens via the UI primitives. The storefront uses `store_config.color_*` columns set per-install.
2. **Currency** — `store_config.currency_symbol` and `store_config.currency_code` default to `£` / `GBP`. `formatPrice()` in `useStoreConfig.tsx` reads them. Stripe is hardcoded to `gbp` in `stripe-checkout/index.ts` — change to match.
3. **Country / shipping defaults** — `bundle/supabase/migrations/001_store_schema.sql` seeds nothing for `shipping_zones` / `shipping_rates`. Admins configure those in `/store/shipping`.
4. **`findOrCreateContact()` shape** — the most likely place to need surgery if the host project's customer model differs from the GamLEARN/Isobex one.
5. **`stripe-webhook` actions** — currently handles `payment_intent.succeeded`, `charge.refunded`, `invoice.payment_failed/succeeded`. The last two are for the host CRM's phone-number subscriptions (unrelated to the store) — strip them if you only want the e-commerce flow.
6. **Page-builder block set** — the 23 block types are defined in `BlockEditor.tsx` and rendered in `BlockRenderer.tsx`. Adding a new block requires touching both files plus the type union in `bundle/src/types/database.ts`.

## Architectural notes worth knowing

- **CartProvider scope** — the cart and `StoreConfig` are provided in `StorefrontLayout`, not at the app root. CartItems persist via `localStorage` under the key `isobex_cart` (rename per host project to avoid collisions).
- **Stripe keys in DB, not env** — by design. Lets non-engineers rotate keys through Settings → Payments. The trade-off is that the keys are queryable by any authenticated user — fine for a small-team CRM, not OK for a multi-tenant SaaS. If you go multi-tenant, lock the table per-org and gate by user role.
- **Inventory deduction is webhook-driven** — the storefront does NOT deduct inventory on `createOrder()`. It happens in `stripe-webhook` after Stripe confirms the payment. That means oversells are possible if two customers race on the last unit. For high-traffic stores, add a DB-level reservation step or move to optimistic UI + Stripe Checkout sessions.
- **Page builder + storefront render with the same `BlockRenderer`** — exact WYSIWYG. The admin's `UnifiedBuilder.tsx` previews via the same component the public storefront uses, parameterised by `previewMode = true`.
- **Storefront analytics are first-party** — `useTracking()` writes to `page_views` + `ecommerce_events`. No Google Analytics. The `excluded_ips` table is the staff-IP allowlist that filters those rows out of CRM-side reporting.
- **Multi-tenant gotcha** — `store_config` and `stripe_settings` are single-row tables. The bundle assumes one storefront per Supabase project. To go multi-tenant, add `org_id` columns and switch the `.limit(1).single()` calls to `.eq('org_id', …)`.
- **Custom domain handling** — `store_config.custom_domain` triggers a check in `StorefrontLayout.tsx`: if the current host matches, the storefront mounts at `/` instead of `/shop`. Means a single Vercel deploy can serve both the CRM and the public shop on different domains.

## Things this skill deliberately does NOT include

- **Stripe Checkout (hosted page)** — uses Stripe **Payment Element** (in-page React component) only. The `checkout.session.completed` branch in `stripe-webhook` is for the host CRM's phone-number subscription flow, NOT the storefront.
- **Apple/Google Pay buttons** — the Payment Element supports them automatically once enabled in Stripe Dashboard, but no wallet-specific UI is bundled.
- **Multi-currency** — single currency per install.
- **Internationalisation** — UI strings are English-only.
- **Headless commerce / API** — the storefront is a React app, not a JSON API. To go headless, expose `fetchVisibleProducts()` etc via Supabase RPCs or edge functions.
- **Cart abandonment emails / win-back flows** — order data is there, the timer/email job is not.
- **Tax engine integration** (TaxJar/Avalara/Stripe Tax) — `order.tax_amount` is computed client-side if you want it. Hardcoded to 0 in the bundled checkout — wire up before going live in tax-collecting jurisdictions.
- **Returns / RMA workflow** — refunds work end-to-end, but no return-merchandise tracking.
- **Order picking/packing UI** — the admin lists orders and prints labels, but no pick-list / packing-slip flow.
