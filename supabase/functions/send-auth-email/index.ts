// Supabase Send Email Hook — sends all auth emails via the Resend API from
// support@getvision.uk. Supabase POSTs here for every auth email; we verify the
// signature, render a Vision-branded template, and send through Resend.
//
// Links point at the app's /auth/confirm route (token_hash + type), so the
// existing reset/confirm flow handles verification. See docs/auth-setup.md.
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string).replace(
  "v1,whsec_",
  "",
);
// Base URL of the CRM app (where /auth/confirm lives). Set as a function secret:
//   local  -> http://localhost:3000
//   prod   -> your deployed Vercel URL
// We use this rather than the hook's site_url, which points at the Supabase API.
const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

const FROM = "Vision <support@getvision.uk>";
const ACCENT = "#2f7de1";
const INK = "#101418";
const MUTED = "#7a8696";
const HAIRLINE = "#e2e7ee";
const CANVAS = "#f7f9fb";

type EmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new: string;
  token_hash_new: string;
};

function appBase(d: EmailData) {
  if (APP_URL) return APP_URL;
  // Fallbacks if APP_URL isn't set: the origin of redirect_to (which the app
  // supplies), then the hook's site_url as a last resort.
  try {
    return new URL(d.redirect_to).origin;
  } catch {
    return (d.site_url ?? "").replace(/\/$/, "");
  }
}

function confirmUrl(d: EmailData, next: string) {
  const params = new URLSearchParams({
    token_hash: d.token_hash,
    type: d.email_action_type,
    next,
  });
  return `${appBase(d)}/auth/confirm?${params.toString()}`;
}

function content(d: EmailData) {
  switch (d.email_action_type) {
    case "recovery":
      return {
        subject: "Reset your Vision password",
        heading: "Reset your password",
        body: "We received a request to reset your Vision password. Use the button below to choose a new one. This link expires shortly — if you didn't ask for this, you can ignore this email.",
        cta: "Set a new password",
        url: confirmUrl(d, "/reset/update"),
      };
    case "invite":
      return {
        subject: "You've been invited to Vision",
        heading: "You've been invited",
        body: "You've been invited to join Vision. Set your password to get started.",
        cta: "Accept invite",
        url: confirmUrl(d, "/reset/update"),
      };
    case "signup":
      return {
        subject: "Confirm your Vision account",
        heading: "Confirm your account",
        body: "Confirm your email address to activate your Vision account.",
        cta: "Confirm account",
        url: confirmUrl(d, "/"),
      };
    case "magiclink":
      return {
        subject: "Your Vision sign-in link",
        heading: "Sign in to Vision",
        body: "Use the button below to sign in. If you didn't request this, you can ignore this email.",
        cta: "Sign in",
        url: confirmUrl(d, "/"),
      };
    case "email_change":
    case "email_change_new":
      return {
        subject: "Confirm your new email",
        heading: "Confirm your new email",
        body: "Confirm this address to finish updating the email on your Vision account.",
        cta: "Confirm email",
        url: confirmUrl(d, "/"),
      };
    default:
      return {
        subject: "Vision",
        heading: "Vision",
        body: "Complete your request using the button below.",
        cta: "Continue",
        url: confirmUrl(d, "/"),
      };
  }
}

function renderHtml(c: ReturnType<typeof content>) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${CANVAS};font-family:'Inter',-apple-system,'Segoe UI',sans-serif;color:${INK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:12px;">
          <tr><td style="padding:32px;">
            <div style="font-weight:800;font-size:18px;letter-spacing:-0.02em;color:${INK};margin-bottom:24px;">vision<span style="color:${ACCENT};">.</span></div>
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:${INK};">${c.heading}</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#3a4453;">${c.body}</p>
            <a href="${c.url}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:11px 20px;border-radius:8px;">${c.cta}</a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:${MUTED};">If the button doesn't work, copy and paste this link into your browser:<br><a href="${c.url}" style="color:${ACCENT};word-break:break-all;">${c.url}</a></p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:${MUTED};">Vision by Digital Craft</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 405 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  try {
    const wh = new Webhook(hookSecret);
    const { user, email_data } = wh.verify(payload, headers) as {
      user: { email: string };
      email_data: EmailData;
    };

    const c = content(email_data);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [user.email],
      subject: c.subject,
      html: renderHtml(c),
      text: `${c.heading}\n\n${c.body}\n\n${c.cta}: ${c.url}`,
    });
    if (error) throw error;
  } catch (error) {
    const e = error as { code?: number; message?: string };
    return new Response(
      JSON.stringify({ error: { http_code: e.code, message: e.message } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
