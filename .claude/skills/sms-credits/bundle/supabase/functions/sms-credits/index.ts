// deno-lint-ignore-file
// SMS credits — checkout sessions + balance lookups.
// Uses GoCardless Billing Request Flow (Instant Bank Pay) for top-ups so
// credits land within seconds of payment confirmation via the
// `gocardless-sms-webhook` function.
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   GOCARDLESS_ACCESS_TOKEN             access token for the GoCardless org
//   GOCARDLESS_ENVIRONMENT              'live' | 'sandbox' (defaults to 'live')
//   GOCARDLESS_API_VERSION              optional — pin a specific GC API version
//                                       (e.g. '2015-07-06'). If unset, the
//                                       access token's default version is used.
//   GOCARDLESS_WEBHOOK_SECRET           (used by gocardless-sms-webhook, not here)
//
// Actions:
//   { action: 'getPackages' }
//   { action: 'getBalance' }
//   { action: 'createCheckout', credits, successUrl, cancelUrl }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const CREDIT_PACKAGES = [
  { credits: 50,  pricePence: 500,  label: '50 credits — £5.00'  },
  { credits: 100, pricePence: 1000, label: '100 credits — £10.00' },
  { credits: 250, pricePence: 2500, label: '250 credits — £25.00' },
  { credits: 500, pricePence: 5000, label: '500 credits — £50.00' },
];

function gcApiBase(): string {
  const env = (Deno.env.get('GOCARDLESS_ENVIRONMENT') || 'live').toLowerCase();
  return env === 'sandbox'
    ? 'https://api-sandbox.gocardless.com'
    : 'https://api.gocardless.com';
}

// GoCardless error responses look like:
//   { error: { type, code, message: 'Validation failed',
//              errors: [{ field, message, request_pointer, reason }, ...] } }
// The top-level message is a useless summary — the real reasons are in errors[].
function formatGcError(data: unknown, fallback: string): string {
  const err = (data as { error?: { message?: string; errors?: Array<{ field?: string; message?: string; request_pointer?: string; reason?: string }> } } | undefined)?.error;
  const details = err?.errors;
  if (Array.isArray(details) && details.length) {
    return details
      .map(d => {
        const field = d.field || d.request_pointer || d.reason || '';
        const msg = d.message || '';
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean)
      .join('; ');
  }
  return err?.message || fallback;
}

function gcHeaders(token: string): HeadersInit {
  // GoCardless requires GoCardless-Version on every request and rejects any
  // date that isn't a published version. Default to '2015-07-06' (their
  // longest-published version, cited in getting-started docs); override via
  // GOCARDLESS_API_VERSION if a newer version is needed.
  return {
    'Authorization':      `Bearer ${token}`,
    'GoCardless-Version': Deno.env.get('GOCARDLESS_API_VERSION') || '2015-07-06',
    'Content-Type':       'application/json',
    'Accept':             'application/json',
    'Idempotency-Key':    crypto.randomUUID(),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const { action } = body;

    if (action === 'getPackages') {
      const { data: settings } = await supabase
        .from('org_settings')
        .select('sms_credits_balance')
        .limit(1)
        .maybeSingle();

      const { data: purchases } = await supabase
        .from('sms_credit_purchases')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);

      return jsonResponse({
        packages: CREDIT_PACKAGES,
        balance: settings?.sms_credits_balance || 0,
        purchases: purchases || [],
      });
    }

    if (action === 'getBalance') {
      const { data: settings } = await supabase
        .from('org_settings')
        .select('sms_credits_balance, sms_enabled, sms_sender_name')
        .limit(1)
        .maybeSingle();

      return jsonResponse({
        balance:    settings?.sms_credits_balance || 0,
        enabled:    settings?.sms_enabled || false,
        senderName: settings?.sms_sender_name || '',
      });
    }

    if (action === 'createCheckout') {
      const GC_ACCESS_TOKEN = Deno.env.get('GOCARDLESS_ACCESS_TOKEN');
      if (!GC_ACCESS_TOKEN) {
        return jsonResponse({ error: 'GoCardless is not configured. Missing GOCARDLESS_ACCESS_TOKEN.' }, 400);
      }

      const { credits, successUrl, cancelUrl } = body;
      const pkg = CREDIT_PACKAGES.find(p => p.credits === credits);
      if (!pkg) return jsonResponse({ error: 'Invalid credit package' }, 400);
      if (!successUrl || !cancelUrl) return jsonResponse({ error: 'successUrl and cancelUrl required' }, 400);

      // Step 1 — create a Billing Request configured for Instant Bank Pay
      // (Faster Payments) so the payment lands immediately.
      const brRes = await fetch(`${gcApiBase()}/billing_requests`, {
        method: 'POST',
        headers: gcHeaders(GC_ACCESS_TOKEN),
        body: JSON.stringify({
          billing_requests: {
            payment_request: {
              amount:      pkg.pricePence,
              currency:    'GBP',
              description: `${pkg.credits} SMS Credits`,
              scheme:      'faster_payments',
              metadata: {
                credits: String(pkg.credits),
                product: 'sms_credits',
              },
            },
          },
        }),
      });
      const brData = await brRes.json();
      if (!brRes.ok) {
        console.error('GoCardless billing_requests error:', JSON.stringify(brData));
        const msg = formatGcError(brData, 'Failed to create billing request');
        return jsonResponse({ error: msg }, 400);
      }
      const billingRequestId = brData.billing_requests?.id;
      if (!billingRequestId) {
        return jsonResponse({ error: 'GoCardless did not return a billing request id' }, 500);
      }

      // Step 2 — create a hosted Billing Request Flow. The returned
      // `authorisation_url` is the page we redirect the user to.
      const flowRes = await fetch(`${gcApiBase()}/billing_request_flows`, {
        method: 'POST',
        headers: gcHeaders(GC_ACCESS_TOKEN),
        body: JSON.stringify({
          billing_request_flows: {
            redirect_uri: successUrl,
            exit_uri:     cancelUrl,
            links: {
              billing_request: billingRequestId,
            },
          },
        }),
      });
      const flowData = await flowRes.json();
      if (!flowRes.ok) {
        console.error('GoCardless billing_request_flows error:', JSON.stringify(flowData));
        const msg = formatGcError(flowData, 'Failed to create checkout flow');
        return jsonResponse({ error: msg }, 400);
      }

      return jsonResponse({
        ok: true,
        checkoutUrl:      flowData.billing_request_flows?.authorisation_url,
        billingRequestId,
        flowId:           flowData.billing_request_flows?.id,
      });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('sms-credits error:', errMsg, err);
    return jsonResponse({ error: errMsg || 'Internal server error' }, 500);
  }
});
