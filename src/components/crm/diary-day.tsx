"use client";

import Link from "next/link";

import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  WORKING_MINUTES,
  minutesFromDayStart,
} from "@/lib/diary";
import { WORK_CATEGORIES, durationLabel } from "@/lib/appointments";
import type { DiaryEvent } from "@/lib/data/appointments";
import type { DiaryStaff } from "@/lib/data/staff";
import { cn } from "@/lib/utils";

// Diary — DAY view (design screen 07). Staff as ROWS, the working day as
// columns, each booking a block positioned by its start and length.
//
// Why staff-as-rows rather than a single column of appointments: the question
// this screen answers is "who is doing what, and who is free" — which is read
// across a row. A flat time-ordered list can't show that a fitter has a gap.

const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
const ROW_HEIGHT = 62;
const NAME_COL = 190;

export function DiaryDay({
  events,
  staff,
  date,
}: {
  events: DiaryEvent[];
  staff: DiaryStaff[];
  date: string;
}) {
  // A booking can name staff by id (the modern path) or carry only free-text
  // names from before multi-staff existed. Both have to land on a row, or a
  // legacy job silently disappears from the diary.
  const byStaff = new Map<string, DiaryEvent[]>();
  for (const s of staff) byStaff.set(s.id, []);
  const unassigned: DiaryEvent[] = [];

  for (const e of events) {
    const ids = e.staffIds.filter((id) => byStaff.has(id));
    if (ids.length) {
      for (const id of ids) byStaff.get(id)!.push(e);
      continue;
    }
    // Fall back to matching the free-text names against the staff list.
    const named = staff.filter(
      (s) =>
        e.staffNames.some((n) => n.toLowerCase() === s.name.toLowerCase()) ||
        (e.assignedTo ?? "").toLowerCase() === s.name.toLowerCase(),
    );
    if (named.length) {
      for (const s of named) byStaff.get(s.id)!.push(e);
    } else {
      unassigned.push(e);
    }
  }

  const gridCols = `${NAME_COL}px repeat(${HOURS.length - 1}, minmax(88px, 1fr))`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto px-[26px] pb-4">
        <div className="min-w-[900px]">
          {/* Hour header. Sticky so scrolling a long staff list keeps the
              times in view — without it you lose track of what column is what. */}
          <div
            className="sticky top-0 z-10 grid items-center border-b border-[#e7e7ea] bg-white"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
              Staff
            </span>
            {HOURS.slice(0, -1).map((h) => (
              <span
                key={h}
                className="border-l border-[#f4f4f5] px-2 py-2 text-[11px] font-semibold text-[#71717a]"
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {staff.length === 0 && (
            <p className="py-10 text-center text-[13px] text-[#71717a]">
              No active staff yet — add people under Settings and their days will appear here.
            </p>
          )}

          {staff.map((s) => (
            <StaffRow key={s.id} staff={s} events={byStaff.get(s.id) ?? []} gridCols={gridCols} />
          ))}

          {/* Anything the diary can't place against a person still has to be
              SEEN — a job with nobody on it is precisely what needs chasing,
              so it gets its own row rather than being dropped. */}
          {unassigned.length > 0 && (
            <StaffRow
              staff={{ id: "unassigned", name: "Unassigned", role: "Needs an owner", initials: "—" }}
              events={unassigned}
              gridCols={gridCols}
              muted
            />
          )}
        </div>
      </div>

      <Legend date={date} />
    </div>
  );
}

function StaffRow({
  staff,
  events,
  gridCols,
  muted = false,
}: {
  staff: DiaryStaff;
  events: DiaryEvent[];
  gridCols: string;
  muted?: boolean;
}) {
  // Overlapping bookings are STACKED, not drawn on top of each other: a
  // double-booking is exactly the thing you need to see, so it must not hide
  // itself. Each lane is a row of blocks that don't collide.
  const lanes = packIntoLanes(events);

  return (
    <div
      className="grid border-b border-[#f4f4f5]"
      style={{ gridTemplateColumns: gridCols }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className={cn(
            "flex size-[26px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold",
            muted ? "bg-[#f4f4f5] text-[#a1a1aa]" : "bg-[var(--accent-tint)] text-[var(--accent-active)]",
          )}
        >
          {staff.initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold text-[#0a0a0a]">
            {staff.name}
          </span>
          {staff.role && (
            <span className="block truncate text-[10.5px] text-[#a1a1aa]">{staff.role}</span>
          )}
        </span>
      </div>

      {/* The timeline itself spans every hour column, so blocks can be placed
          by percentage rather than snapped to a column boundary. */}
      <div
        className="relative border-l border-[#f4f4f5]"
        style={{
          gridColumn: `2 / span ${HOURS.length - 1}`,
          minHeight: lanes.length ? lanes.length * ROW_HEIGHT : ROW_HEIGHT,
        }}
      >
        {/* Hour gridlines, so a block's start reads against the times above. */}
        {HOURS.slice(1, -1).map((h, i) => (
          <span
            key={h}
            className="absolute inset-y-0 border-l border-[#f4f4f5]"
            style={{ left: `${((i + 1) / (HOURS.length - 1)) * 100}%` }}
          />
        ))}

        {lanes.map((lane, laneIndex) =>
          lane.map((e) => <Block key={e.id} event={e} lane={laneIndex} />),
        )}
      </div>
    </div>
  );
}

function Block({ event, lane }: { event: DiaryEvent; lane: number }) {
  const start = new Date(event.startsAt);
  const offset = minutesFromDayStart(start);
  const mins = event.duration ?? 60;

  // A job can start before the working day or run past it (a 2-day fit shown on
  // its second day). Clamp to the visible window rather than letting the block
  // spill outside the row, and keep at least a sliver visible so it can be
  // clicked.
  const left = Math.max(0, offset);
  const right = Math.min(WORKING_MINUTES, offset + mins);
  const width = Math.max(right - left, 20);

  const cat = WORK_CATEGORIES.find((c) => c.key === event.category)!;
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
      <span className="block truncate text-[11.5px] font-semibold" style={{ color: cat.fg }}>
        {ref && <span className="font-mono">{ref} · </span>}
        {event.title}
      </span>
      {event.customerName && (
        <span className="block truncate text-[10.5px] text-[#52525b]">
          {event.customerName}
          {event.customerAddress && ` · ${event.customerAddress}`}
        </span>
      )}
      <span className="block truncate text-[10px] text-[#71717a]">
        {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ·{" "}
        {durationLabel(mins)}
        {event.provisional && " · Provisional"}
      </span>
    </>
  );

  const style = {
    left: `${(left / WORKING_MINUTES) * 100}%`,
    width: `${(width / WORKING_MINUTES) * 100}%`,
    top: lane * ROW_HEIGHT + 4,
    height: ROW_HEIGHT - 8,
    // Provisional draws as a dashed outline on white; a confirmed job takes the
    // category's fill. Colour says WHAT the job is, the outline says whether
    // it's pinned down — so a provisional survey still reads as a survey.
    background: event.provisional ? "#fff" : cat.bg,
    borderColor: event.provisional ? "#a1a1aa" : cat.bg,
    borderStyle: event.provisional ? "dashed" : "solid",
  } as const;

  const className = cn(
    "absolute overflow-hidden rounded-lg border px-2 py-1 text-left",
    href && "hover:brightness-[0.97]",
  );

  const title = `${event.title}${event.customerName ? ` — ${event.customerName}` : ""} · ${durationLabel(mins)}`;

  if (!href) {
    return (
      <div className={className} style={style} title={title}>
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className={className} style={style} title={title}>
      {body}
    </Link>
  );
}

/**
 * Greedy interval packing: put each booking in the first lane where it doesn't
 * overlap what's already there. Two jobs at the same time end up in two lanes,
 * so a clash is visible rather than one hiding behind the other.
 */
function packIntoLanes(events: DiaryEvent[]): DiaryEvent[][] {
  const sorted = [...events].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const lanes: DiaryEvent[][] = [];

  for (const e of sorted) {
    const start = +new Date(e.startsAt);
    const end = start + (e.duration ?? 60) * 60_000;
    const lane = lanes.find((l) =>
      l.every((o) => {
        const oStart = +new Date(o.startsAt);
        const oEnd = oStart + (o.duration ?? 60) * 60_000;
        // Half-open: back-to-back jobs share a lane, overlapping ones don't.
        return start >= oEnd || end <= oStart;
      }),
    );
    if (lane) lane.push(e);
    else lanes.push([e]);
  }
  return lanes;
}

function Legend({ date }: { date: string }) {
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
      <span className="ml-auto text-[11px] text-[#a1a1aa]">{date}</span>
    </div>
  );
}
