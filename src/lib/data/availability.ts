import { createClient } from "@/lib/supabase/server";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  SLOT_MINUTES,
  addDays,
  isWeekend,
  startOfDay,
  workingSpan,
} from "@/lib/diary";

// ---------------------------------------------------------------------------
// The availability engine behind the slot finder (design screen 09).
//
// "Find 2.5 days for any two installers near B79, earliest Wednesday" — walk
// the diary forward and return the first windows where the whole team is free
// for the whole job.
//
// This is only correct because there is ONE appointment table. With bookings
// split across two, every check here would have to union both and the day
// someone forgot, this would hand back a slot that is already taken. See
// AGENTS.md § One appointment table.
// ---------------------------------------------------------------------------

export type SlotRequest = {
  /** Named people who must all be free. */
  staffIds: string[];
  /** …or "any N of these" — used when staffIds is empty. */
  anyCount?: number;
  /** Candidates for the "any N" mode. Defaults to every active staff member. */
  poolIds?: string[];
  /** How long the job takes, in minutes (the single duration unit). */
  duration: number;
  /** Don't offer anything before this. */
  earliest?: string;
  /** How many windows to return. */
  limit?: number;
  /** Include Saturdays and Sundays. */
  includeWeekends?: boolean;
};

export type SlotSuggestion = {
  start: string;
  end: string;
  staffIds: string[];
  staffNames: string[];
  /** Plain-English why — a bare list of dates is unjudgeable. */
  reasons: string[];
  /** Straddles a Saturday or Sunday, so the calendar span is longer than the work. */
  spansWeekend: boolean;
};

/** How far ahead to look before giving up. */
const HORIZON_DAYS = 90;
const WORKING_MINUTES_PER_DAY = (DAY_END_HOUR - DAY_START_HOUR) * 60;

type Busy = { start: number; end: number };

/**
 * Find the first windows where everyone needed is free for the whole job.
 *
 * The search walks forward in SLOT-sized steps through working hours only, so
 * every suggestion is a slot the diary can actually render and the booking
 * dialog can accept.
 */
export async function findSlots(req: SlotRequest): Promise<SlotSuggestion[]> {
  const supabase = await createClient();
  const limit = req.limit ?? 5;
  const duration = Math.max(SLOT_MINUTES, req.duration);

  const from = req.earliest ? new Date(req.earliest) : new Date();
  const searchFrom = startOfDay(from);
  const searchTo = addDays(searchFrom, HORIZON_DAYS);

  // Everyone in play — named people, or the pool we're choosing N from.
  const pool = req.staffIds.length ? req.staffIds : (req.poolIds ?? []);
  if (!pool.length) return [];

  const { data: staffRows } = await supabase
    .from("staff_members")
    .select("id, first_name, last_name")
    .in("id", pool);
  const nameOf = new Map(
    (staffRows ?? []).map((s) => [
      s.id,
      [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "Staff member",
    ]),
  );

  // Every commitment in the horizon, once. Reaching back a fortnight because a
  // multi-day job overlapping the window may have started before it.
  const { data: booked } = await supabase
    .from("appointments")
    .select("starts_at, duration, staff_ids")
    .gte("starts_at", addDays(searchFrom, -14).toISOString())
    .lt("starts_at", searchTo.toISOString())
    .neq("status", "cancelled")
    .overlaps("staff_ids", pool);

  const busyBy = new Map<string, Busy[]>();
  for (const id of pool) busyBy.set(id, []);
  for (const a of booked ?? []) {
    const start = +new Date(a.starts_at);
    const end = start + (a.duration ?? 60) * 60_000;
    for (const id of a.staff_ids ?? []) busyBy.get(id)?.push({ start, end });
  }

  const need = req.staffIds.length ? req.staffIds.length : Math.max(1, req.anyCount ?? 1);
  const out: SlotSuggestion[] = [];

  // Walk candidate starts: every slot boundary of every working day.
  for (let day = 0; day < HORIZON_DAYS && out.length < limit; day++) {
    const d = addDays(searchFrom, day);
    if (!req.includeWeekends && isWeekend(d)) continue;

    for (let m = 0; m < WORKING_MINUTES_PER_DAY && out.length < limit; m += SLOT_MINUTES) {
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      start.setMinutes(DAY_START_HOUR * 60 + m);
      if (+start < +from) continue;

      const span = workingSpan(start, duration, !!req.includeWeekends);
      // Who can do the WHOLE job, every working stretch of it?
      const free = pool.filter((id) => span.every((w) => isFree(busyBy.get(id) ?? [], w)));
      if (free.length < need) continue;

      const chosen = req.staffIds.length ? req.staffIds : free.slice(0, need);
      // In "any N" mode the named check above already passed for the whole
      // pool; re-check the chosen few so a partial pool can't slip through.
      if (!chosen.every((id) => free.includes(id))) continue;

      const end = span[span.length - 1].end;
      const spansWeekend = +new Date(end) - +start > duration * 60_000 + 86_400_000;

      out.push({
        start: start.toISOString(),
        end: new Date(end).toISOString(),
        staffIds: chosen,
        staffNames: chosen.map((id) => nameOf.get(id) ?? "Staff member"),
        reasons: buildReasons(chosen, nameOf, spansWeekend, day),
        spansWeekend,
      });

      // One suggestion per day: ten start times on the same Tuesday is a list
      // of one option pretending to be ten.
      break;
    }
  }

  return out;
}

/** Nothing already booked collides with this stretch. Half-open, so
 *  back-to-back jobs don't count as a clash. */
function isFree(busy: Busy[], window: { start: number; end: number }): boolean {
  return busy.every((b) => window.start >= b.end || window.end <= b.start);
}

function buildReasons(
  chosen: string[],
  nameOf: Map<string, string>,
  spansWeekend: boolean,
  daysOut: number,
): string[] {
  const reasons: string[] = [];
  const names = chosen.map((id) => nameOf.get(id) ?? "Staff member");
  reasons.push(
    names.length === 1 ? `${names[0]} is free` : `${names.join(" + ")} are both free`,
  );
  if (daysOut === 0) reasons.push("Available today");
  else if (daysOut <= 7) reasons.push("Within the week");
  if (spansWeekend) reasons.push("Spans a weekend — the calendar span is longer than the work");
  return reasons;
}
