"use client";

import Link from "next/link";

import { isSameDay, isWeekend, toDateParam } from "@/lib/diary";
import { WORK_CATEGORIES, durationLabel } from "@/lib/appointments";
import type { DiaryEvent } from "@/lib/data/appointments";
import type { DiaryStaff } from "@/lib/data/staff";
import { cn } from "@/lib/utils";

// Diary — STAFF AS COLUMNS. One column per person, their jobs listed down it in
// time order. The day view shows one day; the week view shows all seven, with a
// date divider between them inside each column.
//
// This is the resource-scheduler orientation (staff on the x-axis, time running
// down the y-axis) and it DEPARTS from design screens 07/08a, which laid the day
// out as staff rows against an hour ruler. Two reasons it's better here:
//
//   - A row against an hour ruler wastes most of its width on empty time. A
//     column lists only what's actually booked, so ten staff fit on screen
//     instead of four.
//   - It matches the kanban the rest of the CRM already uses, so a column runs
//     full height, scrolls its own contents, and reads the same way as the leads
//     and contracts boards.
//
// Columns are FIXED WIDTH in a horizontal scroller, not equal shares — the same
// call as the board: eight staff on a laptop would give each ~150px, narrower
// than a job card needs.

const COL_WIDTH = 260;

export function DiaryColumns({
  events,
  staff,
  days,
}: {
  events: DiaryEvent[];
  staff: DiaryStaff[];
  /** The days this view spans — one for day view, seven for week. */
  days: Date[];
}) {
  // A job can name staff by id (the modern path) or carry only free-text names
  // from before multi-staff existed. Both must land in a column, or a legacy
  // booking silently disappears from the diary.
  const byStaff = new Map<string, DiaryEvent[]>();
  for (const s of staff) byStaff.set(s.id, []);
  const unassigned: DiaryEvent[] = [];

  for (const e of events) {
    const ids = e.staffIds.filter((id) => byStaff.has(id));
    const named = ids.length
      ? ids
      : staff
          .filter(
            (s) =>
              e.staffNames.some((n) => n.toLowerCase() === s.name.toLowerCase()) ||
              (e.assignedTo ?? "").toLowerCase() === s.name.toLowerCase(),
          )
          .map((s) => s.id);

    if (!named.length) unassigned.push(e);
    else for (const id of named) byStaff.get(id)!.push(e);
  }

  const columns = [
    ...staff.map((s) => ({ staff: s, events: byStaff.get(s.id) ?? [] })),
    // A job with nobody on it is exactly what needs chasing, so it gets its own
    // column rather than being dropped.
    ...(unassigned.length
      ? [
          {
            staff: {
              id: "unassigned",
              name: "Unassigned",
              role: "Needs an owner",
              initials: "—",
            } as DiaryStaff,
            events: unassigned,
          },
        ]
      : []),
  ];

  if (!columns.length) {
    return (
      <p className="px-[26px] py-10 text-center text-[13px] text-[#71717a]">
        No active staff yet — add people under Settings and their days will appear here.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* One horizontal scroller of fixed-width, full-height columns — the same
          frame as the leads/contracts board. */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-[26px]">
        {columns.map((col) => (
          <StaffColumn key={col.staff.id} staff={col.staff} events={col.events} days={days} />
        ))}
      </div>
      <Legend />
    </div>
  );
}

function StaffColumn({
  staff,
  events,
  days,
}: {
  staff: DiaryStaff;
  events: DiaryEvent[];
  days: Date[];
}) {
  const sorted = [...events].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const multiDay = days.length > 1;
  const muted = staff.id === "unassigned";

  // Total booked time, so a column header says at a glance who is loaded and
  // who has room — the question the diary is opened to answer.
  const totalMinutes = sorted.reduce((n, e) => n + (e.duration ?? 60), 0);

  return (
    // FULL HEIGHT: the column runs to the bottom of the panel and its own
    // contents scroll, rather than the column growing with its jobs and the
    // whole board scrolling. Square at the bottom with no bottom border — that
    // edge is the panel's, same rule as the list table and the kanban.
    <div
      className="flex h-full shrink-0 flex-col rounded-t-xl border-x border-t border-[#e7e7ea] bg-[#fafafa]"
      style={{ width: COL_WIDTH }}
    >
      <div className="flex items-center gap-2 rounded-t-xl border-b border-[#e7e7ea] bg-white px-3 py-2">
        <span
          className={cn(
            "flex size-[26px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold",
            muted ? "bg-[#f4f4f5] text-[#a1a1aa]" : "bg-[var(--accent-tint)] text-[var(--accent-active)]",
          )}
        >
          {staff.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-[#0a0a0a]">
            {staff.name}
          </span>
          {staff.role && (
            <span className="block truncate text-[10.5px] text-[#a1a1aa]">{staff.role}</span>
          )}
        </span>
        {sorted.length > 0 && (
          <span className="shrink-0 rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10.5px] font-semibold text-[#3f3f46]">
            {durationLabel(totalMinutes)}
          </span>
        )}
      </div>

      {/* The jobs scroll here. No visible scrollbar — that's app-wide; the
          column has to look scrollable from its content. */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2 pb-4">
        {sorted.length === 0 && (
          <p className="px-1 py-6 text-center text-[12px] text-[#a1a1aa]">Nothing booked</p>
        )}

        {multiDay
          ? // Week: group down the column by day, with a date divider between.
            days.map((d) => {
              const dayEvents = sorted.filter((e) => isSameDay(new Date(e.startsAt), d));
              if (!dayEvents.length) return null;
              return (
                <div key={toDateParam(d)} className="flex flex-col gap-1.5">
                  <DayDivider day={d} />
                  {dayEvents.map((e) => (
                    <JobCard key={e.id} event={e} />
                  ))}
                </div>
              );
            })
          : sorted.map((e) => <JobCard key={e.id} event={e} />)}
      </div>
    </div>
  );
}

function DayDivider({ day }: { day: Date }) {
  const today = isSameDay(day, new Date());
  return (
    <Link
      href={`/diary?view=day&d=${toDateParam(day)}`}
      className={cn(
        "mt-1 flex items-center gap-2 px-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] first:mt-0",
        today ? "text-[var(--accent-blue)]" : isWeekend(day) ? "text-[#d4d4d8]" : "text-[#a1a1aa]",
      )}
    >
      {day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
      <span className="h-px flex-1 bg-[#e7e7ea]" />
    </Link>
  );
}

function JobCard({ event }: { event: DiaryEvent }) {
  const cat = WORK_CATEGORIES.find((c) => c.key === event.category)!;
  const start = new Date(event.startsAt);
  const ref = event.contractRef ?? event.leadRef;
  const href = event.contractId
    ? `/contracts/${event.contractId}`
    : event.leadId
      ? `/leads/${event.leadId}`
      : event.customerId
        ? `/customers/${event.customerId}`
        : null;

  const body = (
    <>
      {/* Time first — a column is read down in time order, so the clock is what
          the eye tracks. */}
      <span className="flex items-baseline gap-1.5">
        <span className="text-[11.5px] font-bold text-[#0a0a0a]">
          {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="text-[10.5px] text-[#71717a]">{durationLabel(event.duration)}</span>
        {event.provisional && (
          <span className="ml-auto shrink-0 text-[9.5px] font-bold uppercase tracking-[0.05em] text-[#a1a1aa]">
            Provisional
          </span>
        )}
      </span>
      <span className="block truncate text-[11.5px] font-semibold" style={{ color: cat.fg }}>
        {ref && <span className="font-mono">{ref} · </span>}
        {event.title}
      </span>
      {event.customerName && (
        <span className="block truncate text-[11px] text-[#3f3f46]">{event.customerName}</span>
      )}
      {event.customerAddress && (
        <span className="block truncate text-[10.5px] text-[#71717a]">{event.customerAddress}</span>
      )}
    </>
  );

  const className = cn(
    "flex flex-col gap-0.5 overflow-hidden rounded-lg border px-2 py-1.5",
    href && "hover:brightness-[0.97]",
  );
  // Colour says WHAT the job is; the dashed outline says whether it's pinned
  // down — so a provisional survey still reads as a survey.
  const style = {
    background: event.provisional ? "#fff" : cat.bg,
    borderColor: event.provisional ? "#a1a1aa" : cat.bg,
    borderStyle: event.provisional ? "dashed" : "solid",
  } as const;

  if (!href) return <div className={className} style={style}>{body}</div>;
  return (
    <Link href={href} className={className} style={style}>
      {body}
    </Link>
  );
}

function Legend() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-4 border-t border-[#e7e7ea] px-[26px] py-2.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
        Legend
      </span>
      {WORK_CATEGORIES.filter((c) => c.key !== "other").map((c) => (
        <span key={c.key} className="flex items-center gap-1.5 text-[11.5px] text-[#52525b]">
          <span className="size-3 rounded" style={{ background: c.bg }} />
          {c.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-[11.5px] text-[#52525b]">
        <span className="size-3 rounded border-[1.5px] border-dashed border-[#a1a1aa]" />
        Provisional
      </span>
    </div>
  );
}
