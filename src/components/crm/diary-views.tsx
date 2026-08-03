"use client";


import { DiaryGrid, type GridColumn } from "@/components/crm/diary-grid";
import { AppointmentMenu } from "@/components/crm/appointment-menu";
import { useDiaryMoves } from "@/components/crm/diary-dnd";
import { MIDDAY_HOUR, DAY_START_HOUR } from "@/lib/diary";
import {
  DiaryWeekGrid,
  cellStart,
  spanBlocks,
  type WeekCell,
  type WeekColumn,
} from "@/components/crm/diary-week-grid";
import { BookingDialog } from "@/components/crm/booking-dialog";
import type { DiaryEvent } from "@/lib/data/appointments";
import type { DiaryStaff } from "@/lib/data/staff";
import type { TenantOption } from "@/lib/data/customer-record";

// The two working views, and what each axis means:
//
//   Day  → a TIME grid: half-hour slots down the left, one column per staff
//          member. The surface for working the clock.
//   Week → a MATRIX: staff across the top, days down the left, each day split
//          AM/PM. The surface for seeing who is on what, and where the team has
//          a gap — half a day being the unit a job is actually booked in.
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
  events: allEvents,
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
  const { events, move, menu, setMenu, seed, setSeed, edit, error } = useDiaryMoves({
    initial: allEvents,
    staff,
  });

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
      {error && <MoveError message={error} />}
      <DiaryGrid
        columns={columns}
        // A day cell is (person, time), so a drop answers both at once.
        onMove={(id, start, columnKey) =>
          move(id, start, columnKey === "unassigned" ? null : columnKey)
        }
        onContext={(e, x, y) => setMenu({ event: e, x, y })}
        onPick={(columnKey, start) =>
          // On the day view a column IS a person, so clicking their slot books
          // it against them — no need to pick the staff member again.
          setSeed({
            startsAt: start,
            staffIds: columnKey === "unassigned" ? [] : [columnKey],
          })
        }
      />
      <AppointmentMenu target={menu} onClose={() => setMenu(null)} onEdit={edit} />
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
  events: allEvents,
  days,
  staff,
  types,
}: {
  events: DiaryEvent[];
  days: string[];
  staff: DiaryStaff[];
  types: TenantOption[];
}) {
  const { events, move, menu, setMenu, seed, setSeed, edit, error } = useDiaryMoves({
    initial: allEvents,
    staff,
  });
  const dates = days.map((iso) => new Date(iso));

  // (half-day, person) → that person's jobs in that block. A job is spread
  // across every AM/PM block it runs through, and one with two people on it
  // lands in both their columns — the same rule the day view follows.
  const cells = new Map<string, WeekCell[]>();
  let anyUnassigned = false;

  for (const e of events) {
    const ids = staffFor(e, staff);
    const keys = ids.length ? ids : ["unassigned"];
    if (!ids.length) anyUnassigned = true;

    for (const { row, cell } of spanBlocks(e)) {
      for (const id of keys) {
        const k = `${row}|${id}`;
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
      {error && <MoveError message={error} />}
      <DiaryWeekGrid
        columns={columns}
        days={dates}
        cells={cells}
        // A week cell is (person, half-day). The time of day is KEPT when you
        // drop into the same half it was already in, and snapped to the start
        // of the other half when you cross over — so an 09:00 survey dragged to
        // Thursday afternoon becomes 12:00 rather than staying at 09:00 in a
        // cell that says PM.
        onMove={(id, day, block, columnKey) => {
          const job = events.find((e) => e.id === id);
          const at = new Date(day);
          const was = job ? new Date(job.startsAt) : null;
          const keepsTime =
            was && (was.getHours() < MIDDAY_HOUR) === (block === "am");
          at.setHours(
            keepsTime ? was!.getHours() : block === "am" ? DAY_START_HOUR : MIDDAY_HOUR,
            keepsTime ? was!.getMinutes() : 0,
            0,
            0,
          );
          move(id, at, columnKey === "unassigned" ? null : columnKey);
        }}
        onContext={(e, x, y) => setMenu({ event: e, x, y })}
        // A cell is a PERSON in a HALF-DAY, so a click fixes both and seeds the
        // start at the top of that half (07:00 or 12:00) — the dialog's own
        // TimePicker moves it within the block.
        onPick={(columnKey, day, block) =>
          setSeed({
            startsAt: cellStart(day, block),
            staffIds: columnKey === "unassigned" ? [] : [columnKey],
          })
        }
      />
      <AppointmentMenu target={menu} onClose={() => setMenu(null)} onEdit={edit} />
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

/** A failed move puts the job back; this says why, rather than it just
 *  springing back with no explanation. */
function MoveError({ message }: { message: string }) {
  return (
    <p className="mx-[26px] rounded-lg border border-[#f3c2c2] bg-[#fdecec] px-3 py-2 text-[12px] font-medium text-[#d64545]">
      Couldn&rsquo;t move that appointment — {message}
    </p>
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
