import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/* ============================================================================
   UnsubscribePage — public, no auth.
   Lives at /unsubscribe?t=<HMAC-signed token>. Talks to the public
   `unsubscribe` edge function: GET to look up the recipient, POST to
   process the opt-out.
   ============================================================================ */

const RED = '#dc2626';
const RED_DARK = '#b91c1c';
const RED_BG = '#fef2f2';

type Mode = 'loading' | 'confirm' | 'already' | 'success' | 'error';

function endpointUrl(token: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL || '';
  return `${base}/functions/v1/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('t') || '';
  const [mode, setMode] = useState<Mode>('loading');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setMode('error');
      setErrorMsg('This link is missing the unsubscribe code.');
      return;
    }
    (async () => {
      try {
        const res = await fetch(endpointUrl(token), { method: 'GET' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.ok) {
          setMode('error');
          setErrorMsg(friendlyError(body?.error));
          return;
        }
        setEmail(body.email || '');
        setMode(body.already_opted_out ? 'already' : 'confirm');
      } catch {
        setMode('error');
        setErrorMsg("We couldn't check this link. Please try again, or reply to one of our emails.");
      }
    })();
  }, [token]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const res = await fetch(endpointUrl(token), { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        setMode('error');
        setErrorMsg(friendlyError(body?.error));
        return;
      }
      setMode('success');
    } catch {
      setMode('error');
      setErrorMsg('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {mode === 'loading' && <Loading />}
        {mode === 'error'   && <ErrorPanel message={errorMsg} />}
        {mode === 'confirm' && <ConfirmPanel email={email} submitting={submitting} onConfirm={handleConfirm} />}
        {mode === 'already' && <AlreadyPanel email={email} />}
        {mode === 'success' && <SuccessPanel email={email} />}
      </div>
    </div>
  );
}

/* ── Panels ────────────────────────────────────────────────────────────── */

function Loading() {
  return (
    <>
      <IconCircle><Spinner /></IconCircle>
      <h1 style={titleStyle}>Just a moment…</h1>
      <p style={textStyle}>Checking your unsubscribe link.</p>
    </>
  );
}

function ConfirmPanel({ email, submitting, onConfirm }: { email: string; submitting: boolean; onConfirm: () => void }) {
  return (
    <>
      <IconCircle>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/><path d="M22 6l-10 7L2 6"/></svg>
      </IconCircle>
      <h1 style={titleStyle}>Unsubscribe from emails?</h1>
      <p style={textStyle}>We'll stop sending marketing emails to <EmailChip>{email}</EmailChip>.</p>
      <p style={textStyle}>You'll still receive transactional messages such as order confirmations and receipts.</p>
      <div style={btnRowStyle}>
        <button
          onClick={onConfirm}
          disabled={submitting}
          style={{ ...btnPrimaryStyle, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer' }}
        >
          {submitting ? 'Unsubscribing…' : 'Unsubscribe me'}
        </button>
      </div>
    </>
  );
}

function AlreadyPanel({ email }: { email: string }) {
  return (
    <>
      <IconCircle>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </IconCircle>
      <h1 style={titleStyle}>Already unsubscribed</h1>
      <p style={textStyle}>We're not sending marketing emails to <EmailChip>{email}</EmailChip>.</p>
      <p style={textStyle}>If you change your mind, just reply to one of our messages and ask us to add you back.</p>
    </>
  );
}

function SuccessPanel({ email }: { email: string }) {
  return (
    <>
      <IconCircle>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </IconCircle>
      <h1 style={titleStyle}>You've been unsubscribed</h1>
      <p style={textStyle}>We won't send marketing emails to <EmailChip>{email}</EmailChip> any more.</p>
      <p style={textStyle}>If you change your mind, just reply to one of our messages and ask us to add you back.</p>
    </>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <>
      <IconCircle>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </IconCircle>
      <h1 style={titleStyle}>Link not valid</h1>
      <p style={textStyle}>{message}</p>
      <p style={smallStyle}>If you'd like to stop receiving emails from us, please reply to one of our messages and we'll help.</p>
    </>
  );
}

/* ── Bits ──────────────────────────────────────────────────────────────── */

function IconCircle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 14, background: RED_BG,
      color: RED, display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: 20,
    }}>{children}</div>
  );
}

function EmailChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: RED_BG, color: RED, fontWeight: 600,
      padding: '4px 10px', borderRadius: 8, fontSize: 13,
      display: 'inline-block', wordBreak: 'break-all',
    }}>{children}</span>
  );
}

function Spinner() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         style={{ animation: 'isobex-spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <style>{`@keyframes isobex-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function friendlyError(code?: string): string {
  switch (code) {
    case 'invalid_token':       return 'This unsubscribe link is invalid or has been tampered with.';
    case 'recipient_not_found': return "We couldn't find the recipient for this link. They may have been removed from our records.";
    case 'no_email_on_file':    return "There's no email address on file for this recipient any more.";
    case 'method_not_allowed':  return "We couldn't process this request.";
    case 'server_error':        return 'Something went wrong on our side. Please try again.';
    default:                    return "This link can't be used.";
  }
}

/* ── Styles ────────────────────────────────────────────────────────────── */

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  padding: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fafafa',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  color: '#1a1a1a',
};
const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 460,
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: '40px 32px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};
const titleStyle: React.CSSProperties = {
  fontSize: 22, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.01em',
};
const textStyle: React.CSSProperties = {
  color: '#4b5563', lineHeight: 1.55, fontSize: 14, margin: '0 0 16px',
};
const smallStyle: React.CSSProperties = {
  fontSize: 12, color: '#9ca3af', marginTop: 24,
};
const btnRowStyle: React.CSSProperties = {
  display: 'flex', gap: 8, marginTop: 24, flexWrap: 'wrap',
};
const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  height: 40, padding: '0 18px', borderRadius: 10,
  fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
  border: 'none', background: RED, color: '#fff', cursor: 'pointer',
  transition: 'background 0.15s',
};

if (typeof document !== 'undefined' && !document.head.querySelector('style[data-isobex-unsub]')) {
  const css = document.createElement('style');
  css.setAttribute('data-isobex-unsub', 'true');
  css.textContent = `button[data-isobex-unsub-btn]:hover:not(:disabled) { background: ${RED_DARK}; }`;
  document.head.appendChild(css);
}
