// unsubscribe — public JSON API consumed by the React UnsubscribePage at
// app.gamlearn.org.uk/unsubscribe?t=<token>. We serve plain JSON here
// (not HTML) so the recipient-facing page is fully owned by the CRM
// frontend — clean URL on the GamLEARN domain, full styling control,
// no Supabase URL leaked into emails.
//
// Flow:
//   GET  /unsubscribe?t=<token>  → verify token, return person info
//                                  { ok: true, email, already_opted_out, person_name }
//                                  or { ok: false, error: "..." }
//   POST /unsubscribe?t=<token>  → cascade opt-out + write audit row
//                                  { ok: true, email }
//                                  or { ok: false, error: "..." }
//
// The cascade: sets people.marketing_opt_out = true, removes the person
// from every comms_list_members row (so they're off ALL lists, not just
// the one they unsubscribed from), and writes an email_opt_outs audit row.
//
// Public — no JWT verification (recipients have no Supabase auth).
// Configure with `verify_jwt = false` for this function in
// supabase/config.toml or in the dashboard.
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   UNSUBSCRIBE_SECRET

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getSupabase } from '../_shared/supabase.ts';
import { verifyUnsubToken } from '../_shared/unsubscribe.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('t') || '';
    const payload = await verifyUnsubToken(token);
    if (!payload) {
      return jsonResponse({ ok: false, error: 'invalid_token' }, 400);
    }

    const supabase = getSupabase();
    const { data: person, error: pErr } = await supabase
      .from('people')
      .select('id, full_name, email, marketing_opt_out')
      .eq('id', payload.p)
      .maybeSingle();
    if (pErr || !person) {
      return jsonResponse({ ok: false, error: 'recipient_not_found' }, 404);
    }
    if (!person.email) {
      return jsonResponse({ ok: false, error: 'no_email_on_file' }, 400);
    }

    if (req.method === 'GET') {
      return jsonResponse({
        ok: true,
        email: person.email,
        person_name: person.full_name,
        already_opted_out: !!person.marketing_opt_out,
      });
    }

    if (req.method === 'POST') {
      // Idempotent: if already opted out, return success without doing anything.
      if (person.marketing_opt_out) {
        return jsonResponse({ ok: true, email: person.email, already_opted_out: true });
      }

      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
              || req.headers.get('cf-connecting-ip') || null;
      const ua = req.headers.get('user-agent') || null;

      await supabase.from('people').update({
        marketing_opt_out: true,
        marketing_opt_out_at: new Date().toISOString(),
        marketing_opt_out_source: payload.c ? `campaign:${payload.c}` : 'manual',
      }).eq('id', person.id);

      await supabase.from('comms_list_members').delete().eq('person_id', person.id);

      await supabase.from('email_opt_outs').insert({
        person_id:   person.id,
        email:       person.email,
        scope:       'all',
        campaign_id: payload.c,
        reason:      'user_clicked',
        user_agent:  ua,
        ip_address:  ip,
      });

      return jsonResponse({ ok: true, email: person.email });
    }

    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  } catch (err) {
    console.error('[unsubscribe] error', err);
    return jsonResponse({ ok: false, error: 'server_error' }, 500);
  }
});
