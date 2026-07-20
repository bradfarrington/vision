// send-campaign — bulk-sends a comms_campaigns email via Resend.
//
// Architecture:
//   * Bulk marketing goes through Resend (purpose-built for it,
//     RFC 8058 List-Unsubscribe headers, opens/clicks/bounce webhooks).
//   * Outlook (outlook-send) stays for 1:1 case comms.
//
// Flow:
//   1. Auth: any authenticated user can trigger (RLS gates the campaign row).
//   2. Load campaign + list members + sender profile.
//   3. For each list member with an email AND not marketing_opt_out:
//      - Resolve merge fields (person, case, sender, org)
//      - Generate a signed unsubscribe token + URL for THIS person
//      - Send via Resend /emails with List-Unsubscribe headers
//      - Log the result to comms_campaign_recipients
//   4. Mark the campaign sent / failed and stamp counts.
//
// Required env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY                  — set in Supabase dashboard secrets
//   UNSUBSCRIBE_BASE_URL            — public URL of the unsubscribe function
//   UNSUBSCRIBE_SECRET              — HMAC key for signing unsub tokens
//
// Optional env vars:
//   CAMPAIGN_FROM_EMAIL             — fallback if org_settings.campaign_from_email
//                                     hasn't been set in Settings → Organisation.
//                                     Format: "GamLEARN <info@gamlearn.org.uk>"
//
// Reply-to: deliberately not set — recipients reply to whatever's in
// the From: address (they never see a separate Reply-To line).
//
// Body schema:
//   { campaign_id: string, test_email?: string }
//
// When `test_email` is set, the function sends ONE preview email to that
// address using sample merge data, prefixes the subject with "[TEST]",
// and writes nothing to the DB (campaign status / recipients untouched).
// This is the "send a test before going live" path used by the send drawer.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getSupabase, corsHeaders } from '../_shared/supabase.ts';
import { signUnsubToken, buildUnsubUrl } from '../_shared/unsubscribe.ts';

const RESEND_API = 'https://api.resend.com/emails';

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/* ── Merge field helpers ─────────────────────────────────────────────── */

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

function buildPersonContext(person: any, sender: any, org: any, unsubUrl: string): Record<string, string> {
  const parts = (person.full_name || '').trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName  = parts.slice(1).join(' ') || '';
  const senderParts = (sender?.full_name || '').trim().split(/\s+/);
  const senderFirst = senderParts[0] || '';
  return {
    '{{person_name}}':           person.full_name || '',
    '{{person_first_name}}':     firstName,
    '{{person_last_name}}':      lastName,
    '{{person_preferred_name}}': person.preferred_name || firstName,
    '{{person_email}}':          person.email || '',
    '{{person_phone}}':          person.phone || '',
    '{{person_ref}}':            person.ref_code || '',
    '{{person_address}}':        person.address || '',
    '{{person_region}}':         person.region || '',

    '{{sender_name}}':           sender?.full_name || '',
    '{{sender_first_name}}':     senderFirst,
    '{{sender_email}}':          sender?.email || '',
    '{{sender_role}}':           sender?.role?.replace(/_/g, ' ') || '',

    '{{org_name}}':              org?.name || 'GamLEARN',
    '{{org_email}}':             org?.email || '',
    '{{org_phone}}':             org?.phone || '',
    '{{org_website}}':           org?.website || '',
    '{{org_address}}':           org?.address || '',

    '{{current_date}}':          new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    '{{current_year}}':          String(new Date().getFullYear()),
    '{{unsubscribe_link}}':      unsubUrl,
    '{{view_in_browser_link}}':  '#',
  };
}

function applyMergeContext(text: string, ctx: Record<string, string>, caseCtx: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, inner) => {
    const cleanInner = String(inner).replace(/<[^>]*>?/gm, '').trim().toLowerCase();
    const key = `{{${cleanInner}}}`;
    if (ctx[key] !== undefined) return ctx[key];
    if (caseCtx[key] !== undefined) return caseCtx[key];
    return match;
  });
}

async function buildCaseContext(supabase: ReturnType<typeof getSupabase>, personId: string): Promise<Record<string, string>> {
  const { data: cases } = await supabase
    .from('cases')
    .select(`
      id, case_type, stage, overall_label, next_key_date, next_key_date_label, created_at, close_date,
      assigned_worker:profiles!cases_assigned_worker_id_fkey ( full_name, email, role )
    `)
    .eq('person_id', personId)
    .is('close_date', null)
    .order('updated_at', { ascending: false })
    .limit(1);
  const c: any = cases?.[0];
  if (!c) {
    return {
      '{{case_ref}}': '', '{{case_type}}': '', '{{case_stage}}': '',
      '{{case_overall_label}}': '', '{{case_next_key_date}}': '',
      '{{case_next_key_label}}': '', '{{case_opened_date}}': '',
      '{{worker_name}}': '', '{{worker_first_name}}': '',
      '{{worker_email}}': '', '{{worker_role}}': '',
      '{{support_plan_title}}': '', '{{next_action_due}}': '',
      '{{next_check_in_due}}': '', '{{last_contact_date}}': '',
    };
  }
  const w = c.assigned_worker || {};
  const wParts = (w.full_name || '').trim().split(/\s+/);

  let nextActionDue = '';
  let nextCheckInDue = '';
  try {
    const { data: act } = await supabase
      .from('support_actions')
      .select('due_date')
      .eq('case_id', c.id)
      .eq('is_done', false)
      .order('due_date', { ascending: true })
      .limit(1);
    nextActionDue = fmtDate(act?.[0]?.due_date);
  } catch { /* ignore */ }
  try {
    const { data: ci } = await supabase
      .from('case_check_ins')
      .select('next_due_date')
      .eq('case_id', c.id)
      .order('next_due_date', { ascending: true })
      .limit(1);
    nextCheckInDue = fmtDate(ci?.[0]?.next_due_date);
  } catch { /* ignore */ }

  return {
    '{{case_ref}}':              c.id ? c.id.slice(0, 8).toUpperCase() : '',
    '{{case_type}}':             c.case_type || '',
    '{{case_stage}}':            (c.stage || '').replace(/_/g, ' '),
    '{{case_overall_label}}':    c.overall_label || '',
    '{{case_next_key_date}}':    fmtDate(c.next_key_date),
    '{{case_next_key_label}}':   c.next_key_date_label || '',
    '{{case_opened_date}}':      fmtDate(c.created_at),
    '{{worker_name}}':           w.full_name || '',
    '{{worker_first_name}}':     wParts[0] || '',
    '{{worker_email}}':          w.email || '',
    '{{worker_role}}':           (w.role || '').replace(/_/g, ' '),
    '{{support_plan_title}}':    '',
    '{{next_action_due}}':       nextActionDue,
    '{{next_check_in_due}}':     nextCheckInDue,
    '{{last_contact_date}}':     '',
  };
}

/* ── Sample merge data for test sends ────────────────────────────────────
   Mirrors src/features/email-marketing/builder/constants.ts SAMPLE_DATA so
   a test email previews exactly the same content as the in-builder preview.
   Recomputed per request so date-relative values stay current. */
function buildSampleMergeData(): Record<string, string> {
  const fmt = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * 86400000)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return {
    '{{person_name}}': 'Jamie Carter',
    '{{person_first_name}}': 'Jamie',
    '{{person_last_name}}': 'Carter',
    '{{person_preferred_name}}': 'Jamie',
    '{{person_email}}': 'jamie@example.com',
    '{{person_phone}}': '07700 900000',
    '{{person_ref}}': 'P-0421',
    '{{person_address}}': '12 High Street, Sheffield',
    '{{person_region}}': 'South Yorkshire',
    '{{case_ref}}': 'C-0118',
    '{{case_type}}': 'Criminal Justice Support',
    '{{case_stage}}': 'Active Support',
    '{{case_overall_label}}': 'On Track',
    '{{case_next_key_date}}': fmt(14),
    '{{case_next_key_label}}': 'Sentencing hearing',
    '{{case_opened_date}}': fmt(-60),
    '{{worker_name}}': 'Sam Patel',
    '{{worker_first_name}}': 'Sam',
    '{{worker_email}}': 'sam.patel@gamlearn.org.uk',
    '{{worker_role}}': 'Peer Support Worker',
    '{{sender_name}}': 'Sam Patel',
    '{{sender_first_name}}': 'Sam',
    '{{sender_email}}': 'sam.patel@gamlearn.org.uk',
    '{{sender_role}}': 'Peer Support Worker',
    '{{org_name}}': 'GamLEARN',
    '{{org_email}}': 'info@gamlearn.org.uk',
    '{{org_phone}}': '0114 000 0000',
    '{{org_website}}': 'https://gamlearn.org.uk',
    '{{org_address}}': 'GamLEARN, Sheffield',
    '{{support_plan_title}}': 'Recovery Plan — Spring 2026',
    '{{next_action_due}}': fmt(3),
    '{{next_check_in_due}}': fmt(7),
    '{{last_contact_date}}': fmt(-5),
    '{{current_date}}': fmt(0),
    '{{current_year}}': String(new Date().getFullYear()),
    '{{unsubscribe_link}}': '#test-unsubscribe',
    '{{view_in_browser_link}}': '#test-view-in-browser',
  };
}

function applySampleMerge(text: string, sample: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, inner) => {
    const cleanInner = String(inner).replace(/<[^>]*>?/gm, '').trim().toLowerCase();
    const key = `{{${cleanInner}}}`;
    return sample[key] !== undefined ? sample[key] : match;
  });
}

/* ── Resend send wrapper ─────────────────────────────────────────────── */

async function resendSend(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  unsubUrl: string;
  campaignId: string;
}): Promise<{ id: string }> {
  // List-Unsubscribe enables Gmail/Outlook one-click. List-Unsubscribe-Post
  // signals that the URL accepts a one-click POST per RFC 8058.
  // No reply_to is set — recipients reply to whatever's in From: directly,
  // so they never see a separate Reply-To line in their inbox.
  const headers = {
    'List-Unsubscribe': `<${args.unsubUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    // Custom tag so we can correlate Resend webhook events back to a campaign.
    'X-Campaign-Id': args.campaignId,
  };
  const body: Record<string, unknown> = {
    from: args.from,
    to: args.to,
    subject: args.subject,
    html: args.html,
    headers,
  };

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${args.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend ${res.status}: ${errText}`);
  }
  const data = await res.json();
  if (!data?.id) throw new Error('Resend response missing message id');
  return { id: data.id };
}

/* ── Main handler ─────────────────────────────────────────────────────── */

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return jsonResponse({ error: 'Missing Authorization header' }, 401);

    const supabase = getSupabase();
    const { data: userRes, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userRes?.user) return jsonResponse({ error: 'Invalid auth token' }, 401);

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500);

    // From address: prefer org_settings (admin-editable in the UI), fall
    // back to the env var. The settings UI captures display name and email
    // separately; we combine them into RFC 5322 "Name <email>" format here.
    // No reply-to header is set — recipients reply to whatever's in From:.
    const { data: orgRow } = await supabase
      .from('org_settings').select('campaign_from_name, campaign_from_email').limit(1).maybeSingle();

    let fromAddress: string | undefined;
    if (orgRow?.campaign_from_email) {
      const email = orgRow.campaign_from_email.trim();
      const name = (orgRow.campaign_from_name || '').trim();
      if (email.includes('<') && email.includes('>')) {
        // Already a combined "Name <email>" value — use as-is.
        fromAddress = email;
      } else if (name) {
        fromAddress = `${name} <${email}>`;
      } else {
        fromAddress = email;
      }
    } else {
      fromAddress = Deno.env.get('CAMPAIGN_FROM_EMAIL');
    }
    if (!fromAddress) {
      return jsonResponse({
        error: 'No campaign From address. Set it in Settings → Organisation → Email marketing.',
      }, 500);
    }

    const body = await req.json();
    const { campaign_id, test_email } = body || {};
    if (!campaign_id) return jsonResponse({ error: 'campaign_id required' }, 400);

    // Load campaign
    const { data: campaign, error: cErr } = await supabase
      .from('comms_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();
    if (cErr || !campaign) return jsonResponse({ error: 'Campaign not found' }, 404);
    if (!campaign.body_html) return jsonResponse({ error: 'Campaign has no rendered body — open the builder and click Save' }, 400);

    /* ── Test-send branch ─────────────────────────────────────────────────
       One-off preview to a single address. Uses sample merge data, prefixes
       the subject with [TEST], and writes nothing to the DB. The campaign
       itself stays in whatever status it was in. */
    if (test_email && typeof test_email === 'string') {
      const to = test_email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return jsonResponse({ error: 'Invalid test email address' }, 400);
      }
      const sample = buildSampleMergeData();
      const subject = `[TEST] ${applySampleMerge(campaign.subject || campaign.name, sample)}`;
      const html = applySampleMerge(campaign.body_html, sample);
      try {
        const result = await resendSend({
          apiKey,
          from: fromAddress,
          to,
          subject,
          html,
          unsubUrl: sample['{{unsubscribe_link}}'],
          campaignId: campaign.id,
        });
        return jsonResponse({ ok: true, test: true, message_id: result.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return jsonResponse({ error: msg }, 500);
      }
    }

    if (!campaign.list_id) return jsonResponse({ error: 'No mailing list selected' }, 400);

    // Optional: campaign records who it's "from" so we can fill {{sender_*}} merge fields.
    let senderProfile: any = null;
    if (campaign.send_from_user_id) {
      const { data } = await supabase.from('profiles')
        .select('id, full_name, email, role').eq('id', campaign.send_from_user_id).maybeSingle();
      senderProfile = data;
    }

    // Load list members + people, with marketing_opt_out flag for skip logic.
    const { data: listRows, error: lErr } = await supabase
      .from('comms_list_members')
      .select('person_id, person:people(id, full_name, preferred_name, email, phone, ref_code, address, region, marketing_opt_out)')
      .eq('list_id', campaign.list_id);
    if (lErr) return jsonResponse({ error: 'Failed to load list members' }, 500);

    const candidates = (listRows || [])
      .map((r: any) => r.person)
      .filter((p: any) => p);

    if (candidates.length === 0) return jsonResponse({ error: 'List has no members' }, 400);

    // Best-effort org settings
    let org: any = { name: 'GamLEARN', email: '', phone: '', website: '', address: '' };
    try {
      const { data: settings } = await supabase.from('org_settings').select('*').limit(1).maybeSingle();
      if (settings) org = { ...org, ...settings };
    } catch { /* ignore */ }

    // Mark the campaign as sending and stamp who triggered it BEFORE we
    // return — the UI will see this status as soon as the drawer closes.
    await supabase.from('comms_campaigns').update({
      status: 'sending',
      sent_by: userRes.user.id,
    }).eq('id', campaign.id);

    // The actual sends run in a background task so the client can close the
    // drawer immediately. EdgeRuntime.waitUntil keeps the function alive for
    // the work to finish (up to the runtime's per-invocation budget) and
    // a row in `notifications` is inserted for the triggering user when the
    // loop completes (or fails) so the bell pings them.
    const triggerUserId = userRes.user.id;
    const backgroundWork = (async () => {
      let sent = 0;
      let failed = 0;
      let skipped = 0;

      for (const person of candidates) {
        if (!person.email) {
          await supabase.from('comms_campaign_recipients').insert({
            campaign_id: campaign.id,
            person_id:   person.id,
            email:       '',
            status:      'skipped',
            error:       'no email on file',
          });
          skipped++;
          continue;
        }
        if (person.marketing_opt_out) {
          await supabase.from('comms_campaign_recipients').insert({
            campaign_id: campaign.id,
            person_id:   person.id,
            email:       person.email,
            status:      'skipped',
            error:       'marketing opt-out',
          });
          skipped++;
          continue;
        }

        try {
          const token = await signUnsubToken(person.id, campaign.id);
          const unsubUrl = buildUnsubUrl(token);
          const personCtx = buildPersonContext(
            person,
            { full_name: senderProfile?.full_name, email: senderProfile?.email, role: senderProfile?.role },
            org,
            unsubUrl,
          );
          const caseCtx = await buildCaseContext(supabase, person.id);
          const subject = applyMergeContext(campaign.subject || campaign.name, personCtx, caseCtx);
          const html = applyMergeContext(campaign.body_html, personCtx, caseCtx);

          const result = await resendSend({
            apiKey,
            from: fromAddress,
            to: person.email,
            subject,
            html,
            unsubUrl,
            campaignId: campaign.id,
          });

          await supabase.from('comms_campaign_recipients').insert({
            campaign_id: campaign.id,
            person_id:   person.id,
            email:       person.email,
            status:      'sent',
            sent_at:     new Date().toISOString(),
            provider_message_id: result.id,
          });

          // Mirror onto the person's communications timeline so workers see what marketing reached them.
          // campaign_id lets the timeline join back to comms_campaigns / comms_campaign_recipients
          // for the campaign name + opened/clicked engagement chips.
          await supabase.from('communications').insert({
            person_id:     person.id,
            channel:       'email',
            direction:     'out',
            recipient:     person.email,
            subject,
            is_automated:  true,
            sent_at:       new Date().toISOString(),
            sender_address: fromAddress,
            body_html:     html,
            status:        'sent',
            campaign_id:   campaign.id,
          });

          sent++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[send-campaign] send failed', person.email, msg);
          await supabase.from('comms_campaign_recipients').insert({
            campaign_id: campaign.id,
            person_id:   person.id,
            email:       person.email,
            status:      'failed',
            error:       msg.slice(0, 1000),
          });
          failed++;
        }
      }

      // Final status + counts on the campaign row
      const finalStatus = sent === 0 && failed > 0 ? 'failed' : 'sent';
      await supabase.from('comms_campaigns').update({
        status: finalStatus,
        recipient_count: sent + failed + skipped,
        sent_at: new Date().toISOString(),
      }).eq('id', campaign.id);

      // Bell notification for whoever clicked Send
      const partsList: string[] = [`${sent} sent`];
      if (failed)  partsList.push(`${failed} failed`);
      if (skipped) partsList.push(`${skipped} skipped`);
      const notifTitle = finalStatus === 'failed'
        ? `Campaign failed: ${campaign.name}`
        : `Campaign sent: ${campaign.name}`;
      const notifBody = partsList.join(', ') + '.';
      const notifLink = `/communications?tab=campaigns`;
      await supabase.from('notifications').insert({
        user_id: triggerUserId,
        type:    'system',
        title:   notifTitle,
        body:    notifBody,
        link:    notifLink,
      });

      // Email channel parked — `notif_system` template was removed in
      // migration 037 while we focus on the staff-invite flow. The bell
      // notification above is the source of truth in the meantime.
    })();

    // Hand the work off to the runtime. If EdgeRuntime is unavailable
    // (e.g. running locally with a different runner), fall back to awaiting
    // it so behaviour is still correct — just slower.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — EdgeRuntime is a Supabase Edge Runtime global
    if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundWork);
    } else {
      backgroundWork.catch(err => console.error('[send-campaign] background error', err));
    }

    return jsonResponse({
      ok: true,
      queued: candidates.length,
      message: 'Campaign queued — sending in background. You\'ll get a bell notification when it\'s finished.',
    }, 202);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[send-campaign] error', msg);
    return jsonResponse({ error: msg }, 500);
  }
});
