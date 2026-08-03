"use client";

import { useState } from "react";

import { DiaryGrid, type GridColumn } from "@/components/crm/diary-grid";
import {
  DiaryWeekGrid,
  cellStart,
  spanDays,
  type WeekCell,
  type WeekColumn,
} from "@/components/crm/diary-week-grid";
import { BookingDialog, type BookingSeed } from "@/components/crm/booking-dialog";
import type { DiaryEvent } from "@/lib/data/appointments";
import type { DiaryStaff } from "@/lib/data/staff";
import type { TenantOption } from "@/lib/data/customer-record";

// The two working views, and what each axis means:
//
//   Day  → a TIME grid: half-hour slots down the left, one column per staff
//          member. The surface for working the clock.
//   Week → a MATRIX: staff across the top, days down the left. The surface for
//          seeing who is on what, and where the team has a gap.
//
// STAFF are the columns in BOTH, which is the point of the week's shape: the
// same person sits in the same place whichever period you're looking at. The
// week used to put DAYS in the columns with everybody's jobs piled into them,
// which never told you whose a job was without opening it.

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
  const dates = days.map((iso) => new Date(iso));

  // (day, person) → that person's jobs on that day. A multi-day fit is spread
  // across every day cell it runs through, and a job with two people on it
  // lands in both their columns — the same rule the day view follows.
  const cells = new Map<string, WeekCell[]>();
  let anyUnassigned = false;

  for (const e of events) {
    const ids = staffFor(e, staff);
    const keys = ids.length ? ids : ["unassigned"];
    if (!ids.length) anyUnassigned = true;

    for (const { day, cell } of spanDays(e)) {
      for (const id of keys) {
        const k = `${day}|${id}`;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k)!.push(cell);
      }
    }
  }
  for (const list of cells.values()) list.sort((a, b) => +a.start - +b.start);

  const columns: WeekColumn[] = staff.map((s) => ({
    key: s.id,
    label: s.name,
    hint: s.role,
    initials: s.initials,
  }));

  // A job with nobody on it is exactly what needs chasing, so it gets its own
  // column rather than being dropped off the grid.
  if (anyUnassigned) {
    columns.push({
      key: "unassigned",
      label: "Unassigned",
      hint: "Needs an owner",
      initials: "—",
      muted: true,
    });
  }

  return (
    <>
      <DiaryWeekGrid
        columns={columns}
        days={dates}
        cells={cells}
        // A cell is a PERSON on a DAY, so a click fixes both — the dialog only
        // has to ask what time, which its own TimePicker does.
        onPick={(columnKey, day) =>
          setSeed({
            startsAt: cellStart(day),
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

function whenLabel(d: Date): string {
  return d.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
