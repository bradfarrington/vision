"use client";

import { isSameDay, toDateParam } from "@/lib/diary";
import { DiaryGrid, type GridColumn } from "@/components/crm/diary-grid";
import type { DiaryEvent } from "@/lib/data/appointments";
import type { DiaryStaff } from "@/lib/data/staff";

// What a COLUMN means, per view. The grid itself (lib times down the left, jobs
// positioned by start and duration) is identical either way — only the columns
// change, which is why the two views can't drift apart.
//
//   Day  → one column per staff member, all on the same date
//   Week → one column per day, everyone's jobs together
//
// Time is always the y-axis, so switching period never reorients the screen.

/** Match an event to staff by id, falling back to the free-text names. */
function staffFor(e: DiaryEvent, staff: DiaryStaff[]): string[] {
  const ids = e.staffIds.filter((id) => staff.some((s) => s.id === id));
  if (ids.length) return ids;
  // Bookings made before multi-staff existed carry only names; without this
  // fallback a legacy job silently disappears from the diary.
  return staff
    .filter(
      (s) =>
        e.staffNames.some((n) => n.toLowerCase() === s.name.toLowerCase()) ||
        (e.assignedTo ?? "").toLowerCase() === s.name.toLowerCase(),
    )
    .map((s) => s.id);
}

export function DiaryDayView({
  events,
  staff,
  day,
}: {
  events: DiaryEvent[];
  staff: DiaryStaff[];
  day: string;
}) {
  const date = new Date(day);
  const byStaff = new Map<string, DiaryEvent[]>();
  for (const s of staff) byStaff.set(s.id, []);
  const unassigned: DiaryEvent[] = [];

  for (const e of events) {
    const ids = staffFor(e, staff);
    if (!ids.length) unassigned.push(e);
    else for (const id of ids) byStaff.get(id)!.push(e);
  }

  const columns: GridColumn[] = staff.map((s) => ({
    key: s.id,
    label: s.name,
    hint: s.role,
    initials: s.initials,
    day: date,
    events: byStaff.get(s.id) ?? [],
  }));

  // A job with nobody on it is exactly what needs chasing, so it gets its own
  // column rather than being dropped off the grid.
  if (unassigned.length) {
    columns.push({
      key: "unassigned",
      label: "Unassigned",
      hint: "Needs an owner",
      initials: "—",
      day: date,
      events: unassigned,
      muted: true,
    });
  }

  return <DiaryGrid columns={columns} />;
}

export function DiaryWeekView({ events, days }: { events: DiaryEvent[]; days: string[] }) {
  const columns: GridColumn[] = days.map((iso) => {
    const d = new Date(iso);
    const today = isSameDay(d, new Date());
    return {
      key: toDateParam(d),
      label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }),
      hint: today ? "Today" : d.toLocaleDateString("en-GB", { month: "short" }),
      day: d,
      // The day header links into that day, where the same jobs are split out
      // per staff member — the natural next move from "Thursday looks heavy".
      href: `/diary?view=day&d=${toDateParam(d)}`,
      events: events.filter((e) => isSameDay(new Date(e.startsAt), d)),
    };
  });

  return <DiaryGrid columns={columns} />;
}
