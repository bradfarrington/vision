// deno-lint-ignore-file
// Send an SMS via Twilio.
// Adapted from Isobex / Blue Horizon for GamLEARN — uses the single-row
// `org_settings` table for sender name + credit balance, and logs each send
// to `sms_log` (optionally linking to a case/person).
//
// Required env vars (set in Supabase Edge Function secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM_NUMBER          fallback "from" if sender name isn't valid alpha
//
// Actions:
//   { action: 'test', phone }
//   { action: 'send', phone, body, person_id?, case_id? }
//   { action: 'send_template', phone, system_key, vars?, person_id?, case_id? }
//
// Returns: { ok: true, creditsRemaining, sid } on success.

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

function processTemplate(template: string, data: Record<string, unknown>) {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const v = data[String(key).trim()];
    return v == null ? '' : String(v);
  });
}

// Normalise a UK phone number into Twilio-compatible E.164 format.
// Handles common written variants like "07700 900123", "+44 (0) 7700 900123",
// "0044 7700 900123", "(0) 7700 900123" etc.
function normalizePhone(raw: string): string {
  // 1. strip everything except digits and a leading +
  let p = raw.trim().replace(/[\s\-().]/g, '');

  // 2. "0044…" → "+44…"
  if (p.startsWith('0044')) p = '+44' + p.slice(4);

  // 3. "+44(0)…" / "+440…" / "+44 0…" → "+44…"  (drop redundant trunk-zero)
  if (p.startsWith('+440')) p = '+44' + p.slice(4);

  // 4. plain "07…" → "+447…"
  if (p.startsWith('0')) p = '+44' + p.slice(1);

  // 5. anything else with no "+" gets one (e.g. "447700900123" → "+447700900123")
  else if (!p.startsWith('+')) p = '+' + p;

  return p;
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

    // Caller must be an active staff member. Supabase's verify_jwt accepts
    // the public anon key (which is bundled in the frontend), so without
    // this check anyone with the anon key could trigger SMS sends and burn
    // through credits. Members signing in with their portal account get a
    // valid JWT too — we reject them here, only profiles rows count.
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return jsonResponse({ error: 'Missing Authorization header' }, 401);
    const { data: userRes, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userRes?.user) return jsonResponse({ error: 'Invalid auth token' }, 401);
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, is_active')
      .eq('id', userRes.user.id)
      .maybeSingle();
    if (!callerProfile || callerProfile.is_active === false) {
      return jsonResponse({ error: 'Staff account required to send SMS.' }, 403);
    }

    const body = await req.json();
    const { action } = body;

    // 1. Load org settings
    const { data: settings } = await supabase
      .from('org_settings')
      .select('id, org_name, sms_enabled, sms_sender_name, sms_credits_balance, sms_low_credit_notified')
      .limit(1)
      .maybeSingle();

    if (!settings) {
      return jsonResponse({ error: 'Org settings not configured. Save SMS settings first.' }, 400);
    }
    if (!settings.sms_enabled) {
      return jsonResponse({ error: 'SMS is disabled in settings.' }, 400);
    }
    if ((settings.sms_credits_balance ?? 0) <= 0) {
      return jsonResponse({ error: 'Out of SMS credits.' }, 400);
    }

    // 2. Twilio config
    const twilioSid       = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const defaultFrom     = Deno.env.get('TWILIO_FROM_NUMBER');
    const senderName      = settings.sms_sender_name || 'GamLEARN';

    if (!twilioSid || !twilioAuthToken || !defaultFrom) {
      return jsonResponse({ error: 'SMS provider not configured. Missing Twilio env vars.' }, 500);
    }

    // 3. Resolve recipient + body
    let recipientPhone: string | null = null;
    let messageBody = '';
    const personId: string | null = body.person_id || null;
    const caseId:   string | null = body.case_id   || null;

    if (action === 'test') {
      if (!body.phone) return jsonResponse({ error: 'Phone required for test' }, 400);
      recipientPhone = body.phone;
      messageBody = `This is a test message from ${senderName}. Your SMS is working correctly!`;
    }
    else if (action === 'send') {
      if (!body.phone) return jsonResponse({ error: 'Phone required' }, 400);
      if (!body.body)  return jsonResponse({ error: 'Message body required' }, 400);
      recipientPhone = body.phone;
      messageBody = String(body.body);
    }
    else if (action === 'send_template') {
      if (!body.phone)      return jsonResponse({ error: 'Phone required' }, 400);
      if (!body.system_key) return jsonResponse({ error: 'system_key required' }, 400);

      const { data: template } = await supabase
        .from('sms_templates')
        .select('body, active')
        .eq('system_key', body.system_key)
        .maybeSingle();

      if (!template)         return jsonResponse({ error: `Template "${body.system_key}" not found` }, 400);
      if (!template.active)  return jsonResponse({ error: `Template "${body.system_key}" is inactive` }, 400);

      recipientPhone = body.phone;
      messageBody = processTemplate(template.body, {
        org_name: settings.org_name || senderName,
        ...(body.vars || {}),
      });
    }
    else {
      return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }

    if (!recipientPhone) return jsonResponse({ error: 'Missing recipient phone' }, 400);

    const normalizedPhone = normalizePhone(recipientPhone);

    // 4. Send via Twilio
    const fromValue = (senderName && /^[a-zA-Z0-9 ]{1,11}$/.test(senderName))
      ? senderName.replace(/ /g, '')
      : defaultFrom;

    const formData = new URLSearchParams();
    formData.append('To',   normalizedPhone);
    formData.append('From', fromValue);
    formData.append('Body', messageBody);

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioAuthToken}`),
        },
        body: formData.toString(),
      },
    );
    const twilioData = await twilioRes.json();
    const success = twilioRes.ok || twilioRes.status === 201;

    if (!success) {
      await supabase.from('sms_log').insert({
        case_id: caseId,
        person_id: personId,
        recipient_phone: normalizedPhone,
        message_body: messageBody,
        status: `failed: ${twilioData.message || 'unknown'}`,
        credits_used: 0,
      });
      console.error('Twilio error:', twilioData);
      return jsonResponse({ error: twilioData.message || 'Failed to send SMS' }, 500);
    }

    // 5. Deduct credit + log
    const newBalance = (settings.sms_credits_balance || 0) - 1;
    await supabase.from('org_settings').update({
      sms_credits_balance: newBalance,
      updated_at: new Date().toISOString(),
    }).eq('id', settings.id);

    await supabase.from('sms_log').insert({
      case_id: caseId,
      person_id: personId,
      recipient_phone: normalizedPhone,
      message_body: messageBody,
      twilio_sid: twilioData.sid || null,
      status: 'sent',
      credits_used: 1,
    });

    return jsonResponse({
      ok: true,
      creditsRemaining: newBalance,
      sid: twilioData.sid,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('send-sms error:', errMsg, err);
    return jsonResponse({ error: errMsg || 'Internal server error' }, 500);
  }
});
