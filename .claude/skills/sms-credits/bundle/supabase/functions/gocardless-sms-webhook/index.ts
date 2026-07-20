// deno-lint-ignore-file
// GoCardless webhook for SMS credit purchases.
// Listens for `payments.confirmed` events on payments tagged with
// metadata.product = 'sms_credits', tops up `org_settings.sms_credits_balance`,
// records the purchase in `sms_credit_purchases`, and (optionally) creates
// a paid invoice in Xero.
//
// XERO IS OPTIONAL: if XERO_CLIENT_ID is not set, the webhook skips the
// invoice step cleanly and just tops up credits. The Xero contact name,
// email, and Sales account code are hardcoded — search this file for
// 'Tony Parente' / AccountCode: '200' and edit if you keep Xero on.
// To remove Xero entirely, delete the `createXeroInvoiceAndMarkPaid`
// function and its call site in the event loop.
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   GOCARDLESS_ACCESS_TOKEN         used to fetch the payment for metadata + amount
//   GOCARDLESS_WEBHOOK_SECRET       the webhook endpoint secret from the GC dashboard
//   GOCARDLESS_ENVIRONMENT          'live' | 'sandbox' (defaults to 'live')
//   GOCARDLESS_API_VERSION          optional API version pin (default '2015-07-06')
//
// Optional env vars (Xero invoicing — skipped if XERO_CLIENT_ID is unset):
//   XERO_CLIENT_ID                  Xero custom connection client ID
//   XERO_CLIENT_SECRET              Xero custom connection client secret

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── GoCardless ───────────────────────────────────────────────────────────────

async function verifyGoCardlessSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  if (!sigHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  if (expected.length !== sigHeader.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ sigHeader.charCodeAt(i);
  }
  return mismatch === 0;
}

function gcApiBase(): string {
  const env = (Deno.env.get('GOCARDLESS_ENVIRONMENT') || 'live').toLowerCase();
  return env === 'sandbox'
    ? 'https://api-sandbox.gocardless.com'
    : 'https://api.gocardless.com';
}

async function fetchPayment(paymentId: string, token: string) {
  const res = await fetch(`${gcApiBase()}/payments/${paymentId}`, {
    headers: {
      'Authorization':      `Bearer ${token}`,
      'GoCardless-Version': Deno.env.get('GOCARDLESS_API_VERSION') || '2015-07-06',
      'Accept':             'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch payment ${paymentId}: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data.payments;
}

// ─── Xero ─────────────────────────────────────────────────────────────────────

async function getXeroToken(): Promise<string> {
  const clientId     = Deno.env.get('XERO_CLIENT_ID');
  const clientSecret = Deno.env.get('XERO_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('XERO_CLIENT_ID / XERO_CLIENT_SECRET not configured');

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=accounting.invoices%20accounting.contacts%20accounting.payments',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Xero token error: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function getXeroTenantId(token: string): Promise<string> {
  const res = await fetch('https://api.xero.com/connections', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Xero connections error: ${res.status}`);
  const connections = await res.json();
  if (!Array.isArray(connections) || !connections.length) throw new Error('No Xero organisations connected');
  return connections[0].tenantId;
}

function xeroHeaders(token: string, tenantId: string): HeadersInit {
  return {
    'Authorization':  `Bearer ${token}`,
    'Xero-tenant-id': tenantId,
    'Content-Type':   'application/json',
    'Accept':         'application/json',
  };
}

async function createXeroInvoiceAndMarkPaid(
  amountPence: number,
  credits: number,
  paymentDate: string,
): Promise<void> {
  const token    = await getXeroToken();
  const tenantId = await getXeroTenantId(token);
  const headers  = xeroHeaders(token, tenantId);
  const amountGBP = amountPence / 100;

  // 1. Create AUTHORISED invoice against Tony Parente
  const invoiceRes = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      Invoices: [{
        Type:            'ACCREC',
        Contact:         { Name: 'Tony Parente', EmailAddress: 'tony@gamlearn.org.uk' },
        Date:            paymentDate,
        DueDate:         paymentDate,
        Status:          'AUTHORISED',
        LineAmountTypes: 'Exclusive',
        CurrencyCode:    'GBP',
        Reference:       `SMS Credits — ${credits} credits`,
        LineItems: [{
          Description: `${credits} SMS Credits`,
          Quantity:    1,
          UnitAmount:  amountGBP,
          AccountCode: '200', // Sales — standard Xero UK chart of accounts
        }],
      }],
    }),
  });

  if (!invoiceRes.ok) {
    const body = await invoiceRes.text();
    throw new Error(`Xero create invoice error: ${invoiceRes.status} ${body}`);
  }

  const invoiceData = await invoiceRes.json();
  const invoice = invoiceData.Invoices?.[0];
  if (!invoice?.InvoiceID) throw new Error('Xero did not return an invoice ID');

  // 2. Find the first bank account to reconcile against
  const accountsRes = await fetch(
    'https://api.xero.com/api.xro/2.0/Accounts?where=Type%3D%3D%22BANK%22%26%26Status%3D%3D%22ACTIVE%22',
    { headers },
  );
  if (!accountsRes.ok) {
    const body = await accountsRes.text();
    throw new Error(`Xero fetch accounts error: ${accountsRes.status} ${body}`);
  }
  const accountsData = await accountsRes.json();
  const bankAccount = accountsData.Accounts?.[0];
  if (!bankAccount?.Code) throw new Error('No active bank account found in Xero');

  // 3. Mark invoice as paid
  const paymentRes = await fetch('https://api.xero.com/api.xro/2.0/Payments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      Payments: [{
        Invoice: { InvoiceID: invoice.InvoiceID },
        Account: { Code: bankAccount.Code },
        Amount:  amountGBP,
        Date:    paymentDate,
      }],
    }),
  });

  if (!paymentRes.ok) {
    const body = await paymentRes.text();
    throw new Error(`Xero mark paid error: ${paymentRes.status} ${body}`);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== 'POST') return jsonRes({ error: 'Method not allowed' }, 405);

  try {
    const WEBHOOK_SECRET = Deno.env.get('GOCARDLESS_WEBHOOK_SECRET');
    const ACCESS_TOKEN   = Deno.env.get('GOCARDLESS_ACCESS_TOKEN');
    if (!WEBHOOK_SECRET) return jsonRes({ error: 'Webhook secret not configured' }, 500);
    if (!ACCESS_TOKEN)   return jsonRes({ error: 'GoCardless access token not configured' }, 500);

    const sig     = req.headers.get('webhook-signature') || '';
    const rawBody = await req.text();

    const ok = await verifyGoCardlessSignature(rawBody, sig, WEBHOOK_SECRET);
    if (!ok) return jsonRes({ error: 'Invalid signature' }, 498);

    const parsed = JSON.parse(rawBody);
    const events: Array<{
      id: string;
      resource_type: string;
      action: string;
      links?: { payment?: string };
    }> = parsed.events || [];

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const results: Array<Record<string, unknown>> = [];

    for (const event of events) {
      if (event.resource_type !== 'payments' || event.action !== 'confirmed') {
        results.push({ eventId: event.id, ignored: `${event.resource_type}.${event.action}` });
        continue;
      }

      const paymentId = event.links?.payment;
      if (!paymentId) {
        results.push({ eventId: event.id, ignored: 'no payment link' });
        continue;
      }

      // Idempotency — skip if already recorded
      const { data: existing } = await supabase
        .from('sms_credit_purchases')
        .select('id')
        .eq('gocardless_payment_id', paymentId)
        .maybeSingle();
      if (existing) {
        results.push({ eventId: event.id, paymentId, deduped: true });
        continue;
      }

      const payment = await fetchPayment(paymentId, ACCESS_TOKEN);
      const meta = payment.metadata || {};
      if (meta.product !== 'sms_credits') {
        results.push({ eventId: event.id, paymentId, ignored: 'not an SMS credits payment' });
        continue;
      }
      const credits = Number(meta.credits || 0);
      if (credits <= 0) {
        results.push({ eventId: event.id, paymentId, ignored: 'no credits in metadata' });
        continue;
      }

      const amountPence = payment.amount || 0;

      // 1. Top up balance
      const { data: settings } = await supabase
        .from('org_settings')
        .select('id, sms_credits_balance')
        .limit(1)
        .maybeSingle();

      if (settings) {
        await supabase.from('org_settings').update({
          sms_credits_balance:     (settings.sms_credits_balance || 0) + credits,
          sms_low_credit_notified: false,
          updated_at:              new Date().toISOString(),
        }).eq('id', settings.id);
      } else {
        await supabase.from('org_settings').insert({ sms_credits_balance: credits });
      }

      // 2. Record the purchase
      await supabase.from('sms_credit_purchases').insert({
        credits_purchased:     credits,
        amount_paid_pence:     amountPence,
        gocardless_payment_id: paymentId,
        status:                'completed',
      });

      // 3. Create paid Xero invoice — optional, gated on XERO_CLIENT_ID.
      //    Non-critical: errors are logged but never fail the webhook (a
      //    Xero outage must not break credit top-ups).
      if (!Deno.env.get('XERO_CLIENT_ID')) {
        results.push({ eventId: event.id, paymentId, credits, topped_up: true, xero: 'skipped (not configured)' });
      } else {
        const paymentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        try {
          await createXeroInvoiceAndMarkPaid(amountPence, credits, paymentDate);
          results.push({ eventId: event.id, paymentId, credits, topped_up: true, xero: 'invoiced' });
        } catch (xeroErr) {
          const msg = xeroErr instanceof Error ? xeroErr.message : String(xeroErr);
          console.error('Xero invoice error (non-fatal):', msg);
          results.push({ eventId: event.id, paymentId, credits, topped_up: true, xero: `error: ${msg}` });
        }
      }
    }

    return jsonRes({ received: true, results });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('gocardless-sms-webhook error:', errMsg, err);
    return jsonRes({ error: errMsg || 'Internal server error' }, 500);
  }
});
