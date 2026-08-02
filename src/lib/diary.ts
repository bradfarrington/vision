// Diary date windows + navigation. Pure date maths, no data access — shared by
// the day/week/month views, the page's server loader and the availability
// engine, so all four agree on where a week starts and what "today" means.

export type DiaryView = "day" | "week" | "month";

export function isDiaryView(v: string | null | undefined): v is DiaryView {
  return v === "day" || v === "week" || v === "month";
}

/**
 * The working day the timeline spans. UK trade default 08:00–17:00, matching
 * the design's column headers (screen 07).
 *
 * A CONSTANT for now, and it must not stay one: a firm starting at 07:30 should
 * change a setting, not the source. Tenant-configurable working hours land with
 * the slot finder, which needs the same numbers — see AGENTS.md § Diary.
 */
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 17;

/** Monday. UK trade weeks start Monday, and the design's week runs Mon–Sun. */
const WEEK_STARTS_ON = 1;

/**
 * The window a view covers, as [from, to) — `to` EXCLUSIVE, the first instant
 * after the window. The same half-open convention as the lists' date range, and
 * for the same reason: an inclusive upper bound silently drops the last day's
 * bookings (see AGENTS.md § Date-range picker).
 */
export type DiaryWindow = { from: Date; to: Date };

/** Midnight at the start of `d`, in local time. */
export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function startOfWeek(d: Date): Date {
  const out = startOfDay(d);
  const shift = (out.getDay() - WEEK_STARTS_ON + 7) % 7;
  return addDays(out, -shift);
}

export function startOfMonth(d: Date): Date {
  const out = startOfDay(d);
  out.setDate(1);
  return out;
}

/** The [from, to) window a view covers around an anchor date. */
export function windowFor(view: DiaryView, anchor: Date): DiaryWindow {
  if (view === "day") {
    const from = startOfDay(anchor);
    return { from, to: addDays(from, 1) };
  }
  if (view === "week") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  // Month view shows whole weeks, so its grid spills into the neighbouring
  // months — the window has to cover what's DRAWN, not just the month, or the
  // leading and trailing days render empty.
  const first = startOfMonth(anchor);
  const from = startOfWeek(first);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const to = addDays(startOfWeek(lastDay), 7);
  return { from, to };
}

/** Step one view-length forward or back. */
export function shift(view: DiaryView, anchor: Date, by: -1 | 1): Date {
  if (view === "day") return addDays(anchor, by);
  if (view === "week") return addDays(anchor, by * 7);
  const out = startOfMonth(anchor);
  out.setMonth(out.getMonth() + by);
  return out;
}

/** The heading above the grid — "Tue 21 Jul 2026" / "Mon 20 – Sun 26 Jul 2026". */
export function windowLabel(view: DiaryView, anchor: Date): string {
  if (view === "day") {
    return anchor.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  if (view === "week") {
    const from = startOfWeek(anchor);
    const to = addDays(from, 6);
    const sameMonth = from.getMonth() === to.getMonth();
    const left = from.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      ...(sameMonth ? {} : { month: "short" }),
    });
    const right = to.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${left} – ${right}`;
  }
  return anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** `YYYY-MM-DD`, the form the `d` URL param carries. */
export function toDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse the `d` param, falling back to today on anything malformed. */
export function fromDateParam(v: string | undefined): Date {
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    const out = new Date(y, m - 1, d);
    if (!Number.isNaN(out.getTime())) return startOfDay(out);
  }
  return startOfDay(new Date());
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Is this a Saturday or Sunday? Weekends are shaded and skipped when booking. */
export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Minutes from the top of the working day — the timeline's x/y offset. */
export function minutesFromDayStart(when: Date): number {
  return (when.getHours() - DAY_START_HOUR) * 60 + when.getMinutes();
}

export const WORKING_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
