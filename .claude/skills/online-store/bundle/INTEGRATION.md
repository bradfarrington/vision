# Online Store skill — Integration Playbook

Step-by-step walkthrough for adding the online store + storefront to a fresh React + Vite + Supabase project. Assumes the project already has authentication, a `supabase` client at `@/lib/supabase`, and react-router-dom mounted.

## 1. Install runtime dependencies

```bash
npm i @stripe/react-stripe-js @stripe/stripe-js html5-qrcode jspdf lucide-react react-router-dom @supabase/supabase-js
```

What each is for:

| Package | Used by |
|---|---|
| `@stripe/react-stripe-js`, `@stripe/stripe-js` | `StorefrontCheckout.tsx`, `StorefrontGiftCards.tsx` |
| `html5-qrcode` | `InventoryPage.tsx`, `StockMovementsPage.tsx`, `StockUpdateModal.tsx` — webcam barcode scanning |
| `jspdf` | `BarcodeLabelPrinter.tsx` — A4 label sheet generation |
| `lucide-react` | Every admin + storefront page (icons) |
| `react-router-dom` v6+ | All routes |
| `@supabase/supabase-js` | Should already be installed if you have a Supabase project |

## 2. Run the migrations

Open the Supabase SQL editor (Dashboard → SQL Editor → New query) and run them in order:

1. `bundle/supabase/migrations/001_store_schema.sql`
2. `bundle/supabase/migrations/002_store_rls.sql`

001 is idempotent (all `CREATE TABLE IF NOT EXISTS`, `ALTER … IF NOT EXISTS`) so re-running it on a clean DB is safe. 002 creates RLS policies — if you re-run, drop the existing policies first (`DROP POLICY IF EXISTS ...`) or you'll hit duplicate-name errors.

After running you should see ~25 new tables plus a `get_stripe_publishable_key()` function, a seeded `store_config` row, a seeded `stripe_settings` row, and seeded `store_pages` rows for `home`, `products`, `collections`, etc.

### If your host project already has some of these tables

Most likely candidate: `page_views` / `ecommerce_events` if you've installed any analytics. The migration uses `CREATE TABLE IF NOT EXISTS` so it'll skip pre-existing tables, but it won't reconcile column drift. Compare column lists before merging — most importantly the analytics tables, where shape varies.

## 3. Deploy the edge functions

From the project root:

```bash
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy stripe-refund
```

**Important:** `stripe-webhook` is invoked by Stripe (not by an authenticated user), so it must be deployed with `--no-verify-jwt`. The function verifies the Stripe signature internally using `stripe_settings.stripe_webhook_secret`.

No edge-function env vars are required — `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected, and Stripe credentials come from the `stripe_settings` table.

## 4. Configure Stripe

In the Stripe Dashboard:
1. Grab your **publishable key** (`pk_test_…` or `pk_live_…`) and **secret key** (`sk_…`).
2. Register a webhook endpoint:
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`
   - Events: `payment_intent.succeeded`, `charge.refunded`
   - (Add `checkout.session.completed`, `invoice.payment_failed`, `invoice.payment_succeeded` only if you're also using the host CRM's phone-number subscription feature — irrelevant for store-only installs.)
3. Copy the webhook signing secret (`whsec_…`).

Then in the Supabase SQL editor:

```sql
UPDATE public.stripe_settings
SET
  stripe_publishable_key = 'pk_live_xxx',
  stripe_secret_key = 'sk_live_xxx',
  stripe_webhook_secret = 'whsec_xxx',
  updated_at = now();
```

## 5. Copy the source files

```
bundle/src/features/store/        → src/features/store/
bundle/src/features/storefront/   → src/features/storefront/
bundle/src/types/database.ts      → merge into src/types/database.ts
bundle/src/lib/storeApi.ts        → src/lib/storeApi.ts (or merge into src/lib/api.ts)
```

If you're merging into an existing `src/lib/api.ts`, paste the contents of `storeApi.ts` at the bottom of your file and de-duplicate any name clashes. If you keep `storeApi.ts` separate, update every `import * as api from '@/lib/api'` inside `src/features/store/` and `src/features/storefront/` to `import * as api from '@/lib/storeApi'`.

## 6. Wire up the routes

The admin pages mount inside your authenticated `<AppLayout>` and the storefront mounts as a separate top-level shell. Example using react-router-dom v6:

```tsx
// src/main.tsx or src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StorefrontLayout } from '@/features/storefront/StorefrontLayout';
import { StorefrontHome } from '@/features/storefront/StorefrontHome';
import { StorefrontProducts } from '@/features/storefront/StorefrontProducts';
import { StorefrontProductDetail } from '@/features/storefront/StorefrontProductDetail';
import { StorefrontCollections } from '@/features/storefront/StorefrontCollections';
import { StorefrontCollectionDetail } from '@/features/storefront/StorefrontCollectionDetail';
import { StorefrontGiftCards } from '@/features/storefront/StorefrontGiftCards';
import { StorefrontCheckout } from '@/features/storefront/StorefrontCheckout';
import { StorefrontThankYou } from '@/features/storefront/StorefrontThankYou';
import { UnsubscribePage } from '@/features/storefront/UnsubscribePage';

import { StorePage } from '@/features/store/StorePage';
import { ProductEditorPage } from '@/features/store/ProductEditorPage';
import { CollectionsPage } from '@/features/store/CollectionsPage';
import { InventoryPage } from '@/features/store/InventoryPage';
import { StockMovementsPage } from '@/features/store/StockMovementsPage';
import { GiftCardsPage } from '@/features/store/GiftCardsPage';
import { DiscountsPage } from '@/features/store/DiscountsPage';
import { ShippingPage } from '@/features/store/ShippingPage';
import { SeoPage } from '@/features/store/SeoPage';
import { DomainPage } from '@/features/store/DomainPage';
import { UnifiedBuilder } from '@/features/store/UnifiedBuilder';

<BrowserRouter>
  <Routes>
    {/* Authenticated admin store */}
    <Route path="/store" element={<AppLayout />}>
      <Route index element={<StorePage />} />
      <Route path="new" element={<ProductEditorPage />} />
      <Route path=":id" element={<ProductEditorPage />} />
      <Route path="collections" element={<CollectionsPage />} />
      <Route path="inventory" element={<InventoryPage />} />
      <Route path="stock-movements" element={<StockMovementsPage />} />
      <Route path="gift-cards" element={<GiftCardsPage />} />
      <Route path="discounts" element={<DiscountsPage />} />
      <Route path="shipping" element={<ShippingPage />} />
      <Route path="seo" element={<SeoPage />} />
      <Route path="domain" element={<DomainPage />} />
      <Route path="builder" element={<UnifiedBuilder />} />
    </Route>

    {/* Public storefront */}
    <Route path="/shop" element={<StorefrontLayout />}>
      <Route index element={<StorefrontHome />} />
      <Route path="products" element={<StorefrontProducts />} />
      <Route path="products/:slug" element={<StorefrontProductDetail />} />
      <Route path="collections" element={<StorefrontCollections />} />
      <Route path="collections/:slug" element={<StorefrontCollectionDetail />} />
      <Route path="gift-cards" element={<StorefrontGiftCards />} />
      <Route path="checkout" element={<StorefrontCheckout />} />
      <Route path="thank-you/:orderId" element={<StorefrontThankYou />} />
    </Route>

    {/* Public unsubscribe (outside StorefrontLayout) */}
    <Route path="/unsubscribe" element={<UnsubscribePage />} />
  </Routes>
</BrowserRouter>
```

If you want the storefront to mount at the **root** (`/`) when accessed via a custom domain, `StorefrontLayout` already does the host check — it'll mount under `/` automatically if `window.location.host` matches `store_config.custom_domain`.

## 7. Provide the host-project UI primitives

The bundled `.tsx` files import several primitives from the host project's design system. Either copy compatible versions across or inline-replace the imports.

| Bundle import | What it expects |
|---|---|
| `@/components/ui/AlertDialog` → `useAlert()` | Returns `{ alert(opts) }`, an async confirm/alert dialog. Used to surface success/error/confirm prompts across the admin pages. |
| `@/components/ui/ColorPicker` | A native color input with hex preview |
| `@/components/ui/DatePicker` | ISO YYYY-MM-DD picker |
| `@/components/ui/MultiSelect` | Tag-style multi-value picker |
| `@/components/ui/SearchableSelect` | Searchable single-value dropdown |
| `@/components/layout/PageShell` | Wraps each admin page with the shared header / sub-nav |
| `@/context/DataContext` → `useData()` | Returns globally cached lookups (tags, lead sources, etc) — used by product editor for label/compatibility dropdowns. If your host project doesn't have one, replace with direct fetches. |
| `@/hooks/useTracking` → `useTracking()` | Returns `{ trackEvent }` for the storefront analytics ping-back. Stub with `() => ({ trackEvent: () => {} })` if you don't need analytics. |

If the host project doesn't have any of these, the fastest path is:
1. Create stub versions that match the call signatures and render placeholders.
2. Replace them one-by-one as you adopt each store feature.

## 8. Verify the install

After everything is wired up:

1. Hit `/store` while logged in → should see an empty products list with "Add product" CTA.
2. Add a product, mark it visible, then visit `/shop/products` (logged out, ideally in an incognito window) → product should appear.
3. Add to cart, go through checkout with a Stripe test card (`4242 4242 4242 4242`).
4. Check the Stripe dashboard: the PaymentIntent should be there, and the webhook should fire successfully (Stripe shows a green tick).
5. Back in Supabase, check `orders` → the row should be `status = 'paid'`, and the linked `order_items` should have correct quantities.
6. Check `stock_quantity` on the purchased product → should have decremented.

If the webhook fires but the order doesn't update, check the function logs in Supabase Dashboard → Edge Functions → stripe-webhook → Logs. The most common issue is the `stripe_webhook_secret` not matching.

## 9. Optional: customise

Areas you're most likely to change next:

- **Currency** — `UPDATE public.store_config SET currency_symbol = '$', currency_code = 'USD';` plus change `'gbp'` → `'usd'` in `stripe-checkout/index.ts`.
- **Seed an admin user** for shipping zones / discount codes via the admin UI (no SQL needed — just visit `/store/shipping`, `/store/discounts`).
- **Configure the page builder** at `/store/builder` — choose any storefront route in the left dropdown, drag in blocks, and save. The storefront re-renders the same blocks live.
- **Brand colours / fonts** — `/store/builder` → Global Settings tab.
- **Test mode banner** — `store_config.test_mode` defaults to `true` and shows a banner across the storefront. Flip it to `false` when you're ready to take real orders.

## Troubleshooting

**`storefront pages 404 / blank`** → check that the `store_pages` rows were seeded by migration 001 (`SELECT page_key FROM store_pages;`). If empty, re-run the INSERT block.

**`'No publishable key' error on checkout`** → check `SELECT stripe_publishable_key FROM stripe_settings;`. If NULL, set it via UPDATE.

**`'Stripe is not configured' error in edge function`** → same table, but `stripe_secret_key` is what `stripe-checkout` reads.

**`anon visitor can't insert orders`** → verify RLS migration 002 ran. The key policies are `anon_insert_orders` + `anon_insert_order_items` + `anon_insert_contacts` (if you have a contacts table — that policy isn't in this skill's RLS migration, it's in your host project's).

**`webhook fires but order doesn't update`** → check `stripe-webhook` logs. Likely `stripe_webhook_secret` mismatch. Re-copy the `whsec_…` value from Stripe.

**`adjustStock fails with auth.users / app_users error`** → the audit fields are best-effort; the `try { … } catch {}` block in `adjustStock()` should swallow it. If you're seeing a hard failure, ensure your `app_users` table exists or drop the audit lookup entirely.

**`Cart persists between users on shared machine`** → expected. Cart uses `localStorage` with a fixed key. If that's a problem, namespace the key with a session ID.
