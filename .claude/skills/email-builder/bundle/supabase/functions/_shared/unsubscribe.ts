// Shared HMAC token helpers for the unsubscribe flow.
//
// Token format: <base64url(payload)>.<base64url(hmac-sha256(payload, secret))>
//
// Payload is JSON: { p: <person_id>, c: <campaign_id|null>, t: <issued_at_unix> }
//
// Tokens never expire by default — recipients should always be able to
// click an old unsubscribe link. If you want to set a TTL, check `t`
// against now() at verify time. We deliberately don't, so an email from
// six months ago can still unsub the user.
//
// Required env var:
//   UNSUBSCRIBE_SECRET — at least 32 random bytes (hex). Rotate by
//   setting UNSUBSCRIBE_SECRET_PREVIOUS to the old value during the
//   rotation window so existing links keep working.

interface UnsubPayload {
  p: string;          // person_id
  c: string | null;   // campaign_id (optional — opt-out can come from manual link)
  t: number;          // issued-at, unix seconds
}

function getSecret(envVar = 'UNSUBSCRIBE_SECRET'): string {
  const secret = Deno.env.get(envVar);
  if (!secret) throw new Error(`${envVar} not set`);
  return secret;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function hmac(payload: Uint8Array, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    strToBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, payload);
  return new Uint8Array(sig);
}

/* ── timing-safe compare ─────────────────────────────────────────────── */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ── public API ──────────────────────────────────────────────────────── */

export async function signUnsubToken(personId: string, campaignId: string | null): Promise<string> {
  const payload: UnsubPayload = { p: personId, c: campaignId, t: Math.floor(Date.now() / 1000) };
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = strToBytes(payloadJson);
  const sig = await hmac(payloadBytes, getSecret());
  return `${b64urlEncode(payloadBytes)}.${b64urlEncode(sig)}`;
}

export async function verifyUnsubToken(token: string): Promise<UnsubPayload | null> {
  if (!token || !token.includes('.')) return null;
  const [payloadPart, sigPart] = token.split('.', 2);
  let payloadBytes: Uint8Array;
  let signature: Uint8Array;
  try {
    payloadBytes = b64urlDecode(payloadPart);
    signature = b64urlDecode(sigPart);
  } catch { return null; }

  // Try current secret, then rotation-window secret if set
  const secrets = [getSecret(), Deno.env.get('UNSUBSCRIBE_SECRET_PREVIOUS')].filter((s): s is string => !!s);
  for (const s of secrets) {
    const expected = await hmac(payloadBytes, s);
    if (timingSafeEqual(expected, signature)) {
      try {
        const decoded = JSON.parse(new TextDecoder().decode(payloadBytes)) as UnsubPayload;
        if (typeof decoded.p !== 'string' || typeof decoded.t !== 'number') return null;
        return decoded;
      } catch { return null; }
    }
  }
  return null;
}

/* Build the public-facing URL for an unsubscribe link. */
export function buildUnsubUrl(token: string): string {
  const base = Deno.env.get('UNSUBSCRIBE_BASE_URL');
  if (!base) throw new Error('UNSUBSCRIBE_BASE_URL not set');
  return `${base.replace(/\/$/, '')}?t=${encodeURIComponent(token)}`;
}
