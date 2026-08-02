"use client";

import { useState } from "react";
import Link from "next/link";

import {
  DAY_START_HOUR,
  SLOTS_PER_DAY,
  SLOT_MINUTES,
  isSameDay,
  isWeekend,
  slotLabel,
  toDateParam,
} from "@/lib/diary";
import { WORK_CATEGORIES, durationLabel } from "@/lib/appointments";
import type { DiaryEvent } from "@/lib/data/appointments";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The diary's TIME GRID — times down the left, columns across the top, and a
// job occupying as many half-hour blocks as it lasts.
//
// One component serves both views; only what a COLUMN means changes:
//   Day view  → one column per staff member
//   Week view → one column per day
// Time is always the y-axis, so switching period never reorients the screen.
//
// Everything is derived from DAY_START_HOUR / DAY_END_HOUR / SLOT_MINUTES in
// lib/diary, which is where the per-company working hours will land — the grid
// doesn't hard-code a single hour anywhere.
// ---------------------------------------------------------------------------

/** Height of one 30-minute block. The unit the whole grid is measured in. */
const SLOT_H = 30;
const GUTTER = 62;
const MIN_COL = 190;

export type GridColumn = {
  key: string;
  label: string;
  /** Second line under the label — a staff role, or nothing. */
  hint?: string | null;
  /** Avatar initials, for the staff columns. */
  initials?: string;
  /** The day this column represents. Staff columns all share the view's day. */
  day: Date;
  events: DiaryEvent[];
  /** Renders the header as a link (the week's day headers). */
  href?: string;
  muted?: boolean;
};

export function DiaryGrid({
  columns,
  onPick,
}: {
  columns: GridColumn[];
  /** Called when an empty slot is chosen — booking arrives with the dialog. */
  onPick?: (columnKey: string, start: Date) => void;
}) {
  // The crosshair: which cell the pointer is over. Both the time in the gutter
  // AND the column header light up, so you can read off exactly which slot and
  // whose it is without tracing the row and column by eye.
  const [hover, setHover] = useState<{ col: string; slot: number } | null>(null);
  const [picked, setPicked] = useState<{ col: string; slot: number } | null>(null);

  const slots = Array.from({ length: SLOTS_PER_DAY }, (_, i) => i);
  const gridHeight = SLOTS_PER_DAY * SLOT_H;

  if (!columns.length) {
    return (
      <p className="px-[26px] py-10 text-center text-[13px] text-[#71717a]">
        Nothing to show — add staff under Settings, or widen the filters.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* One scroller for BOTH axes, so the gutter and headers stay pinned to
          their own edges while the grid moves under them. */}
      <div className="min-h-0 flex-1 overflow-auto px-[26px] pb-4">
        <div className="inline-flex min-w-full flex-col">
          {/* --- Header row ------------------------------------------------ */}
          <div className="sticky top-0 z-20 flex bg-white">
            {/* Corner: sits above the gutter and left of the headers, so it has
                to be sticky on BOTH axes or it slides away from one of them. */}
            <div
              className="sticky left-0 z-10 shrink-0 border-b border-r border-[#e7e7ea] bg-white"
              style={{ width: GUTTER }}
            />
            {columns.map((col) => {
              const active = hover?.col === col.key || picked?.col === col.key;
              return (
                <div
                  key={col.key}
                  className={cn(
                    "flex flex-1 items-center gap-2 border-b border-r border-[#e7e7ea] px-2.5 py-2 transition-colors",
                    active && "bg-[var(--accent-tint)]",
                    col.muted && "bg-[#fafafa]",
                  )}
                  style={{ minWidth: MIN_COL }}
                >
                  {col.initials && (
                    <span
                      className={cn(
                        "flex size-[24px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        col.muted
                          ? "bg-[#f4f4f5] text-[#a1a1aa]"
                          : "bg-[var(--accent-tint)] text-[var(--accent-active)]",
                      )}
                    >
                      {col.initials}
                    </span>
                  )}
                  <span className="min-w-0">
                    {col.href ? (
                      <Link
                        href={col.href}
                        className="block truncate text-[12.5px] font-semibold text-[#0a0a0a] hover:text-[var(--accent-blue)]"
                      >
                        {col.label}
                      </Link>
                    ) : (
                      <span className="block truncate text-[12.5px] font-semibold text-[#0a0a0a]">
                        {col.label}
                      </span>
                    )}
                    {col.hint && (
                      <span className="block truncate text-[10.5px] text-[#a1a1aa]">{col.hint}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* --- Body: gutter + columns ------------------------------------ */}
          <div className="flex">
            {/* Time gutter. Sticky left so the times stay readable however far
                the grid is scrolled sideways. */}
            <div
              className="sticky left-0 z-10 shrink-0 border-r border-[#e7e7ea] bg-white"
              style={{ width: GUTTER, height: gridHeight }}
            >
              {slots.map((i) => {
                const onTheHour = i % 2 === 0;
                const lit = hover?.slot === i || picked?.slot === i;
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative flex items-start justify-end pr-2 transition-colors",
                      // The gutter's own gridlines match the columns' — the
                      // hour line is solid, the half-hour lighter.
                      onTheHour ? "border-t border-[#e7e7ea]" : "border-t border-[#f4f4f5]",
                      lit && "bg-[var(--accent-tint)]",
                    )}
                    style={{ height: SLOT_H }}
                  >
                    <span
                      className={cn(
                        "-mt-[7px] text-[10.5px] tabular-nums transition-colors",
                        lit
                          ? "font-bold text-[var(--accent-active)]"
                          : onTheHour
                            ? "font-semibold text-[#71717a]"
                            : "text-[#c4c4c8]",
                      )}
                    >
                      {slotLabel(i)}
                    </span>
                  </div>
                );
              })}
            </div>

            {columns.map((col) => (
              <Column
                key={col.key}
                col={col}
                slots={slots}
                gridHeight={gridHeight}
                hover={hover}
                picked={picked}
                setHover={setHover}
                onPickSlot={(slot, start) => {
                  setPicked({ col: col.key, slot });
                  onPick?.(col.key, start);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <Legend />
    </div>
  );
}

function Column({
  col,
  slots,
  gridHeight,
  hover,
  picked,
  setHover,
  onPickSlot,
}: {
  col: GridColumn;
  slots: number[];
  gridHeight: number;
  hover: { col: string; slot: number } | null;
  picked: { col: string; slot: number } | null;
  setHover: (v: { col: string; slot: number } | null) => void;
  onPickSlot: (slot: number, start: Date) => void;
}) {
  const lanes = packIntoLanes(col.events);

  return (
    <div
      className={cn(
        "relative flex-1 border-r border-[#e7e7ea]",
        isWeekend(col.day) && "bg-[#fafafa]",
        col.muted && "bg-[#fafafa]",
      )}
      style={{ minWidth: MIN_COL, height: gridHeight }}
      onMouseLeave={() => setHover(null)}
    >
      {/* Empty slot cells — the gridlines, the hover target, and (once the
          booking dialog lands) what you click to book. They sit UNDER the job
          blocks, so a booked slot isn't clickable through its job. */}
      {slots.map((i) => {
        const isHover = hover?.col === col.key && hover.slot === i;
        const isPicked = picked?.col === col.key && picked.slot === i;
        const onTheHour = i % 2 === 0;
        return (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHover({ col: col.key, slot: i })}
            onClick={() => {
              const start = new Date(col.day);
              start.setHours(0, 0, 0, 0);
              start.setMinutes(DAY_START_HOUR * 60 + i * SLOT_MINUTES);
              onPickSlot(i, start);
            }}
            className={cn(
              "absolute inset-x-0 transition-colors",
              onTheHour ? "border-t border-[#e7e7ea]" : "border-t border-[#f4f4f5]",
              isPicked
                ? "bg-[var(--accent-tint)] ring-1 ring-inset ring-[var(--accent-blue)]"
                : isHover
                  ? "bg-[var(--accent-tint)]"
                  : "hover:bg-[#fafafa]",
            )}
            style={{ top: i * SLOT_H, height: SLOT_H }}
            aria-label={`${slotLabel(i)} — ${col.label}`}
          />
        );
      })}

      {/* Job blocks, positioned by start time and sized by duration. */}
      {lanes.map((lane, laneIndex) =>
        lane.map((e) => (
          <JobBlock
            key={e.id}
            event={e}
            day={col.day}
            lane={laneIndex}
            laneCount={lanes.length}
          />
        )),
      )}
    </div>
  );
}

function JobBlock({
  event,
  day,
  lane,
  laneCount,
}: {
  event: DiaryEvent;
  day: Date;
  lane: number;
  laneCount: number;
}) {
  const start = new Date(event.startsAt);
  const mins = event.duration ?? 60;

  // Minutes from the top of the working day. A job can start before the day
  // opens or run past it (day 2 of a multi-day fit), so clamp to the grid
  // rather than letting the block escape the column.
  const rawTop = (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes();
  const top = Math.max(0, rawTop);
  const bottom = Math.min(SLOTS_PER_DAY * SLOT_MINUTES, rawTop + mins);
  // Never thinner than a readable sliver, or a 15-minute call is unclickable.
  const height = Math.max(((bottom - top) / SLOT_MINUTES) * SLOT_H, 22);

  // Runs on past the end of the visible day, or started before it began.
  const continuesAfter = rawTop + mins > SLOTS_PER_DAY * SLOT_MINUTES;
  const startedBefore = rawTop < 0;
  // Multi-day jobs land in every column they touch; only the first shows the
  // full detail, the rest read as a continuation.
  const isContinuation = !isSameDay(start, day);

  const cat = WORK_CATEGORIES.find((c) => c.key === event.category)!;
  const ref = event.contractRef ?? event.leadRef;
  const href = event.contractId
    ? `/contracts/${event.contractId}`
    : event.leadId
      ? `/leads/${event.leadId}`
      : event.customerId
        ? `/customers/${event.customerId}`
        : null;

  // Side-by-side when a person is double-booked: a clash is exactly the thing
  // that must not hide behind itself.
  const width = `calc(${100 / laneCount}% - 4px)`;
  const left = `calc(${(lane * 100) / laneCount}% + 2px)`;

  const compact = height < 46;

  const body = (
    <>
      <span className="flex items-baseline gap-1.5">
        <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-[#0a0a0a]">
          {startedBefore || isContinuation
            ? "cont."
            : start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
        {!compact && (
          <span className="truncate text-[10px] text-[#71717a]">{durationLabel(mins)}</span>
        )}
        {event.provisional && !compact && (
          <span className="ml-auto shrink-0 text-[9px] font-bold uppercase tracking-[0.04em] text-[#a1a1aa]">
            Prov
          </span>
        )}
      </span>
      <span className="block truncate text-[11px] font-semibold" style={{ color: cat.fg }}>
        {ref && <span className="font-mono">{ref} · </span>}
        {event.customerName ?? event.title}
      </span>
      {!compact && (
        <span className="block truncate text-[10px] text-[#52525b]">
          {event.title}
          {continuesAfter && " →"}
        </span>
      )}
    </>
  );

  const className = cn(
    "absolute z-10 flex flex-col gap-px overflow-hidden rounded-md border px-1.5 py-0.5 text-left",
    href && "hover:brightness-[0.97]",
  );
  const style = {
    top,
    height,
    left,
    width,
    // Colour says WHAT the job is; the dashed outline says whether it's pinned
    // down — so a provisional survey still reads as a survey.
    background: event.provisional ? "#fff" : cat.bg,
    borderColor: event.provisional ? "#a1a1aa" : cat.fg + "33",
    borderStyle: event.provisional ? "dashed" : "solid",
  } as const;

  const title = `${start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · ${durationLabel(mins)} — ${event.title}${event.customerName ? ` (${event.customerName})` : ""}`;

  if (!href) return <div className={className} style={style} title={title}>{body}</div>;
  return (
    <Link href={href} className={className} style={style} title={title}>
      {body}
    </Link>
  );
}

/**
 * Greedy interval packing: each booking goes in the first lane where it doesn't
 * overlap what's already there, so two jobs at the same time sit side by side
 * rather than one hiding the other.
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
        // Half-open, so back-to-back jobs share a lane and only real overlaps
        // split into two.
        return start >= oEnd || end <= oStart;
      }),
    );
    if (lane) lane.push(e);
    else lanes.push([e]);
  }
  return lanes;
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
      <span className="ml-auto text-[11px] text-[#a1a1aa]">
        Click a slot to book · {SLOT_MINUTES}-minute blocks
      </span>
    </div>
  );
}

export { toDateParam };
