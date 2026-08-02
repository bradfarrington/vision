// Appointment model — ONE table backs every booking in the CRM (a sales call, a
// survey, a fit, a service visit). See AGENTS.md § One appointment table.
//
// Colours are transcribed from the diary's legend (design screen 07) and are
// PLATFORM-FIXED, never the tenant accent: the legend is read the same way the
// stage badges are, so a tenant branded red must not have "Installation" render
// in the same red as a cancelled job.

export type WorkCategory = "installation" | "survey" | "service" | "other";

export type WorkCategoryDef = {
  key: WorkCategory;
  label: string;
  /** Block fill on the diary timeline. */
  bg: string;
  /** Text + the 3px leading rule. */
  fg: string;
};

export const WORK_CATEGORIES: WorkCategoryDef[] = [
  { key: "installation", label: "Installation", bg: "#eaf2fd", fg: "#1f56a3" },
  { key: "survey", label: "Survey", bg: "#fdf2dc", fg: "#b86e00" },
  { key: "service", label: "Service", bg: "#e7f4ec", fg: "#1a7f3e" },
  { key: "other", label: "Other", bg: "#f4f4f5", fg: "#3f3f46" },
];

const CATEGORY_BY_KEY = new Map(WORK_CATEGORIES.map((c) => [c.key, c]));

/**
 * Which colour band an appointment falls in.
 *
 * The tenant's `appointment_type` list is EDITABLE (Sales call · Survey ·
 * Measure up · Remedial visit · whatever they add), so the category can't be a
 * fixed enum on the type — it is matched from the words. Anything unrecognised
 * lands in `other` and renders neutral, which is the right failure: a tenant's
 * own new type shows up on the diary in grey rather than not at all.
 */
export function workCategory(
  type: string | null | undefined,
  workType?: string | null,
): WorkCategoryDef {
  const s = `${workType ?? ""} ${type ?? ""}`.toLowerCase();
  if (/fit|install/.test(s)) return CATEGORY_BY_KEY.get("installation")!;
  if (/survey|measure|site visit|design/.test(s)) return CATEGORY_BY_KEY.get("survey")!;
  if (/service|remedial|repair|callback|call back/.test(s)) return CATEGORY_BY_KEY.get("service")!;
  return CATEGORY_BY_KEY.get("other")!;
}

// ---------------------------------------------------------------------------
// Status

export type AppointmentStatus = "provisional" | "confirmed" | "done" | "cancelled";

export const APPOINTMENT_STATUSES: { key: AppointmentStatus; label: string }[] = [
  { key: "provisional", label: "Provisional" },
  { key: "confirmed", label: "Confirmed" },
  { key: "done", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
];

/**
 * A provisional booking is drawn DASHED rather than in its own colour — the
 * design's legend treats it as a modifier, not a fifth category, because a
 * provisional survey is still a survey. Colour says what the job is; the
 * outline says whether it's pinned down.
 */
export const PROVISIONAL_CLASS = "border-dashed border-[#a1a1aa] bg-white";

/** The diary's travel block — striped, no colour of its own. */
export const TRAVEL_CLASS =
  "bg-[repeating-linear-gradient(45deg,#f4f4f5_0_3px,#e4e4e7_3px_6px)] text-[#71717a]";

// ---------------------------------------------------------------------------
// Duration — ONE unit
//
// Everything is stored in MINUTES. The old fitting table carried duration_days
// AND duration_hours, which could disagree with each other; a single unit can't.
// A working day is 8 hours, so "1.5 days" is 720 minutes.

export const MINUTES_PER_WORKING_DAY = 8 * 60;

/** 720 → "1.5 days" · 90 → "1h 30m" · 60 → "1 hour". */
export function durationLabel(minutes: number | null | undefined): string {
  const m = minutes ?? 0;
  if (m <= 0) return "—";
  if (m >= MINUTES_PER_WORKING_DAY) {
    const days = m / MINUTES_PER_WORKING_DAY;
    const rounded = Math.round(days * 2) / 2; // nearest half day
    return `${rounded} ${rounded === 1 ? "day" : "days"}`;
  }
  if (m === 60) return "1 hour";
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (!h) return `${mins}m`;
  return mins ? `${h}h ${mins}m` : `${h} hour${h === 1 ? "" : "s"}`;
}

/** The instant an appointment ends. */
export function appointmentEnd(startsAt: string, minutes: number | null | undefined): Date {
  return new Date(new Date(startsAt).getTime() + (minutes ?? 60) * 60_000);
}

/**
 * Do two bookings collide? Half-open [start, end) — a job ending at 10:00 and
 * one starting at 10:00 do NOT overlap, which is what makes back-to-back
 * bookings possible at all.
 */
export function overlaps(
  a: { startsAt: string; duration: number | null },
  b: { startsAt: string; duration: number | null },
): boolean {
  const aStart = +new Date(a.startsAt);
  const bStart = +new Date(b.startsAt);
  return aStart < +appointmentEnd(b.startsAt, b.duration) && bStart < +appointmentEnd(a.startsAt, a.duration);
}
