"use client";

import { useState } from "react";

import { isSameDay, toDateParam } from "@/lib/diary";
import { DiaryGrid, type GridColumn } from "@/components/crm/diary-grid";
import { BookingDialog, type BookingSeed } from "@/components/crm/booking-dialog";
import type { DiaryEvent } from "@/lib/data/appointments";
import type { DiaryStaff } from "@/lib/data/staff";
import type { TenantOption } from "@/lib/data/customer-record";

// What a COLUMN means, per view. The grid itself (times down the left, jobs
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
  types,
}: {
  events: DiaryEvent[];
  staff: DiaryStaff[];
  day: string;
  types: TenantOption[];
}) {
  const date = new Date(day);
  const [seed, setSeed] = useState<BookingSeed | null>(null);

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

  return (
    <>
      <DiaryGrid
        columns={columns}
        onPick={(columnKey, start) =>
          // On the day view a column IS a person, so clicking their slot books
          // it against them — no need to pick the staff member again.
          setSeed({
            startsAt: start,
            staffIds: columnKey === "unassigned" ? [] : [columnKey],
          })
        }
      />
      <BookingDialog
        open={!!seed}
        onOpenChange={(o) => !o && setSeed(null)}
        seed={seed}
        staff={staff}
        types={types}
        context={seed?.startsAt ? whenLabel(seed.startsAt) : null}
      />
    </>
  );
}

export function DiaryWeekView({
  events,
  days,
  staff,
  types,
}: {
  events: DiaryEvent[];
  days: string[];
  staff: DiaryStaff[];
  types: TenantOption[];
}) {
  const [seed, setSeed] = useState<BookingSeed | null>(null);

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

  return (
    <>
      <DiaryGrid
        columns={columns}
        // On the week view a column is a DAY, so the slot fixes the when and
        // the dialog still has to ask who.
        onPick={(_columnKey, start) => setSeed({ startsAt: start, staffIds: [] })}
      />
      <BookingDialog
        open={!!seed}
        onOpenChange={(o) => !o && setSeed(null)}
        seed={seed}
        staff={staff}
        types={types}
        context={seed?.startsAt ? whenLabel(seed.startsAt) : null}
      />
    </>
  );
}

function whenLabel(d: Date): string {
  return d.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
