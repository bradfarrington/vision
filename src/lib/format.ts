// Shared formatting helpers — British English, sterling, JetBrains Mono for
// reference codes/currency/postcodes (per the Vision design system). Keep all
// user-facing number/date formatting here so tenants read consistently.

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const GBP_PENCE = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** £486,320 — whole pounds, no pence. Nullish → em dash. */
export function gbp(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return GBP.format(n);
}

/** £486,320.50 — with pence. Nullish → em dash. */
export function gbpPence(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return GBP_PENCE.format(n);
}

/** Compact money for tight cards: £214k, £1.2m. Nullish → em dash. */
export function gbpCompact(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return "—";
  if (Math.abs(n) >= 1_000_000) return `£${trim(n / 1_000_000)}m`;
  if (Math.abs(n) >= 1_000) return `£${trim(n / 1_000)}k`;
  return GBP.format(n);
}

/** 16 Jul 2026. Nullish/invalid → em dash. */
export function shortDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Thu 16 Jul — for diary headers. */
export function weekdayDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Relative "last activity" phrasing: Today, Yesterday, 3 days ago, 16 Jul. */
export function relativeDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  const now = new Date();
  const days = Math.floor(
    (startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  return shortDate(d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * True when a customer_type counts as commercial. Case-insensitive so a
 * tenant-added type value (e.g. "Commercial") still drives the commercial
 * behaviour, while any other custom type behaves as residential.
 */
export function isCommercial(type: string | null | undefined): boolean {
  return (type ?? "").toLowerCase() === "commercial";
}

/**
 * Turn a raw DB enum value into something a person reads: `survey_booked` →
 * "Survey booked", `won` → "Won".
 *
 * **Snake case must never reach the UI.** Values like `leads.status`,
 * `leads.result` and `customers.customer_type` are stored lowercase/underscored
 * and were leaking straight into filter dropdowns and list cells. Run any raw
 * enum through this at the point of DISPLAY — never rewrite what's stored, or
 * every query that compares against it breaks.
 *
 * SENTENCE case, not Title Case, so it matches the canonical stage labels
 * ("Survey booked", not "Survey Booked"). Where a canonical label already
 * exists — `leadStage(v).label` — prefer that; this is the fallback for values
 * that have no registry behind them.
 *
 * Does NOT apply to tenant-entered text (lookup options, custom-field values):
 * those are already written the way the tenant wants them.
 */
export function humanLabel(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  // Leave anything already containing a capital or a space alone — it's
  // tenant-entered text, not a DB enum.
  if (/[A-Z]/.test(v) || v.includes(" ")) return v;
  const words = v.replace(/[_-]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function trim(n: number): string {
  // 1.0 → "1", 1.2 → "1.2"
  return Number(n.toFixed(1)).toString();
}
