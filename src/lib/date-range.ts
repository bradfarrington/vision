// ---------------------------------------------------------------------------
// Date-range presets for the list screens' toolbar.
//
// The PRESET KEY rides in the URL (`range=90d`), not the dates it resolves to,
// so "Last 90 days" stays a rolling window — a bookmarked or shared link means
// the same thing next month as it does today. Only `range=custom` carries
// explicit `from`/`to` dates, because that's the one case where fixed endpoints
// ARE the intent.
//
// Resolution happens server-side so the query is filtered at the DB and paging
// and counts stay correct (same rule as every other list filter).
// ---------------------------------------------------------------------------

export type RangeKey =
  | "7d"
  | "30d"
  | "90d"
  | "12m"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export type RangePreset = { key: RangeKey; label: string };

/** Offered in the dropdown, in order. `custom` is handled separately below it. */
export const RANGE_PRESETS: RangePreset[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "12m", label: "Last 12 months" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_year", label: "This year" },
];

export function isRangeKey(v: string | undefined | null): v is RangeKey {
  return (
    !!v && (v === "custom" || RANGE_PRESETS.some((p) => p.key === v))
  );
}

export type ResolvedRange = {
  /** Inclusive start, as an ISO instant. Undefined = unbounded. */
  from?: string;
  /** EXCLUSIVE end, as an ISO instant — see the note on `endOfDay` below. */
  to?: string;
};

/**
 * Turn a range key (+ custom endpoints) into concrete bounds.
 *
 * `to` is EXCLUSIVE — the instant after the last day ends. Lead dates are
 * timestamptz, so a `<= 2026-07-23` comparison would drop everything logged
 * later that day; comparing `< 2026-07-24T00:00` keeps the whole day.
 *
 * `now` is injectable so this is testable and so a caller can pin one clock
 * across several calls.
 */
export function resolveRange(
  key: string | undefined | null,
  custom?: { from?: string | null; to?: string | null },
  now: Date = new Date(),
): ResolvedRange {
  if (!isRangeKey(key)) return {};

  if (key === "custom") {
    const from = parseDay(custom?.from);
    const to = parseDay(custom?.to);
    return {
      from: from ? startOfDay(from).toISOString() : undefined,
      to: to ? endOfDay(to).toISOString() : undefined,
    };
  }

  const today = startOfDay(now);
  switch (key) {
    case "7d":
      return { from: addDays(today, -6).toISOString(), to: endOfDay(now).toISOString() };
    case "30d":
      return { from: addDays(today, -29).toISOString(), to: endOfDay(now).toISOString() };
    case "90d":
      return { from: addDays(today, -89).toISOString(), to: endOfDay(now).toISOString() };
    case "12m": {
      const from = new Date(today);
      from.setMonth(from.getMonth() - 12);
      return { from: from.toISOString(), to: endOfDay(now).toISOString() };
    }
    case "this_month":
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case "last_month":
      return {
        from: new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString(),
        // Exclusive: the first instant of THIS month.
        to: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(),
      };
    case "this_year":
      return {
        from: new Date(today.getFullYear(), 0, 1).toISOString(),
        to: endOfDay(now).toISOString(),
      };
  }
}

/** The text on the toolbar button for the current selection. */
export function rangeLabel(
  key: string | undefined | null,
  custom?: { from?: string | null; to?: string | null },
): string {
  if (!isRangeKey(key)) return "All time";
  if (key === "custom") {
    const from = parseDay(custom?.from);
    const to = parseDay(custom?.to);
    if (from && to) return `${shortDay(from)} – ${shortDay(to)}`;
    if (from) return `From ${shortDay(from)}`;
    if (to) return `Until ${shortDay(to)}`;
    return "Custom";
  }
  return RANGE_PRESETS.find((p) => p.key === key)?.label ?? "All time";
}

// --- day helpers ------------------------------------------------------------
/** Accepts the DatePicker's value (an ISO date or instant). Null when unusable. */
function parseDay(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The first instant of the NEXT day — an exclusive upper bound. */
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function shortDay(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
