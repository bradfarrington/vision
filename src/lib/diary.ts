// Diary date windows + navigation. Pure date maths, no data access — shared by
// the day/week/month views, the page's server loader and the availability
// engine, so all four agree on where a week starts and what "today" means.

export type DiaryView = "day" | "week" | "month";

export function isDiaryView(v: string | null | undefined): v is DiaryView {
  return v === "day" || v === "week" || v === "month";
}

/**
 * The working day the grid spans, and the size of one bookable block.
 *
 * 07:00–17:00 in half hours: a 30-minute appointment fills one block, a
 * two-hour one spans four. Everything about the grid — row height, a job's
 * position, what a click means — is derived from these, so changing them
 * changes the whole diary consistently.
 *
 * CONSTANTS for now, and they must not stay constants: working hours are
 * per-company (a firm starting at 07:30, or working Saturdays, shouldn't need a
 * code change). They live here as the single place the tenant setting will
 * replace — the slot finder reads the same numbers.
 */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 17;
export const SLOT_MINUTES = 30;

/** Bookable blocks in a working day — 07:00→17:00 at 30 min = 20. */
export const SLOTS_PER_DAY = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES;

/** Slot index → its label ("07:00", "07:30", …). */
export function slotLabel(index: number): string {
  const total = DAY_START_HOUR * 60 + index * SLOT_MINUTES;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Slot index for an instant, or null when it falls outside working hours. */
export function slotIndexFor(when: Date): number | null {
  const mins = (when.getHours() - DAY_START_HOUR) * 60 + when.getMinutes();
  if (mins < 0 || mins >= (DAY_END_HOUR - DAY_START_HOUR) * 60) return null;
  return Math.floor(mins / SLOT_MINUTES);
}

/** The instant a slot starts on a given day. */
export function slotStart(day: Date, index: number): Date {
  const out = startOfDay(day);
  out.setMinutes(DAY_START_HOUR * 60 + index * SLOT_MINUTES);
  return out;
}

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

/**
 * Split a job into the working stretches it occupies. A 2.5-day job doesn't run
 * continuously — it runs 07:00–17:00, stops, and resumes the next working day.
 * Treating it as one long interval would mark every evening and weekend as
 * "busy", which is why the slot finder would find almost nothing without this.
 *
 * It lives HERE, with the rest of the pure date maths, because two callers need
 * the same answer and they must never disagree: the availability engine uses it
 * to decide whether a window is free, and the week grid uses it to decide which
 * day cells a multi-day fit appears in. A private copy in either would let one
 * drift.
 */
export function workingSpan(
  start: Date,
  duration: number,
  includeWeekends = false,
): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let remaining = duration;
  const cursor = new Date(start);

  // Cap the walk so a bad duration can't spin forever.
  for (let guard = 0; guard < 400 && remaining > 0; guard++) {
    if (!includeWeekends && isWeekend(cursor)) {
      nextMorning(cursor);
      continue;
    }
    const dayEnd = new Date(cursor);
    dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);
    const available = Math.max(0, (+dayEnd - +cursor) / 60_000);
    if (available <= 0) {
      nextMorning(cursor);
      continue;
    }
    const used = Math.min(available, remaining);
    out.push({ start: +cursor, end: +cursor + used * 60_000 });
    remaining -= used;
    if (remaining > 0) nextMorning(cursor);
  }
  return out;
}

function nextMorning(cursor: Date) {
  cursor.setDate(cursor.getDate() + 1);
  cursor.setHours(DAY_START_HOUR, 0, 0, 0);
}

export const WORKING_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
