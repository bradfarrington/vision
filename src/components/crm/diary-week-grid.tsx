"use client";

import { useState } from "react";
import Link from "next/link";

import {
  DAY_START_HOUR,
  MIDDAY_HOUR,
  isSameDay,
  isWeekend,
  startOfDay,
  toDateParam,
  workingSpan,
  type DayBlock,
} from "@/lib/diary";
import { WORK_CATEGORIES, durationLabel } from "@/lib/appointments";
import type { DiaryEvent } from "@/lib/data/appointments";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The diary's WEEK view — a matrix of STAFF (columns, across the top) against
// DAYS (rows, down the left), each day split into an AM and a PM block.
//
// It deliberately does NOT share the day view's time grid. The week answers a
// different question — "who is on what this week, and where are the gaps in the
// team" — and a time axis can't carry it: seven days of half-hour rows either
// means seven separate grids or one column per day with everybody's jobs piled
// together, which is what it was, and which never told you WHOSE they were.
//
// So time stops being an axis here and becomes what a card says — but NOT
// entirely: a day is split in half, because half a day is the real unit of
// work (a survey in the morning, a service call after lunch). One cell per day
// could show three jobs and still not say which half was free.
//
// A multi-day fit occupies EVERY block it runs through (via workingSpan, the
// same helper the slot finder uses), because a row is a half day: showing a
// 3-day installation only on Monday morning would read as free time that isn't.
// ---------------------------------------------------------------------------

/** Smallest a half-day block may get before the grid scrolls instead. */
const MIN_BLOCK_H = 56;
const GUTTER = 82;
/** The AM/PM label rail, sitting between the date and the staff cells. */
const BLOCK_W = 38;
const MIN_COL = 190;

const BLOCKS: { key: DayBlock; label: string }[] = [
  { key: "am", label: "AM" },
  { key: "pm", label: "PM" },
];

export type WeekColumn = {
  key: string;
  label: string;
  /** Second line under the name — the staff role. */
  hint?: string | null;
  initials?: string;
  muted?: boolean;
};

/** One person's job in one half-day, already resolved by the view. */
export type WeekCell = {
  event: DiaryEvent;
  /** The instant this block's stretch of the job starts. */
  start: Date;
  /** Minutes worked in THIS block (a longer job is split across blocks). */
  minutes: number;
  /** Ran in an earlier block too. */
  continuedFrom: boolean;
  /** Runs on into a later block. */
  continuesInto: boolean;
};

export function DiaryWeekGrid({
  columns,
  days,
  cells,
  onPick,
}: {
  columns: WeekColumn[];
  days: Date[];
  /** `${dayKey}|${block}|${columnKey}` → that person's jobs in that half-day. */
  cells: Map<string, WeekCell[]>;
  onPick?: (columnKey: string, day: Date, block: DayBlock) => void;
}) {
  // The crosshair, as on the day grid: hovering a cell lights BOTH the half-day
  // down the left and the person across the top, so you can read off whose
  // Thursday morning you are looking at without tracing row and column by eye.
  const [hover, setHover] = useState<{ col: string; row: string } | null>(null);

  if (!columns.length) {
    return (
      <p className="px-[26px] py-10 text-center text-[13px] text-[#71717a]">
        Nothing to show — add staff under Settings, or widen the filters.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* One scroller for BOTH axes, so the day gutter and the staff headers
          stay pinned to their own edges while the grid moves under them. No
          LEFT padding — the grid runs flush to the panel edge like the list
          table (AGENTS.md § a list table is EDGE TO EDGE). */}
      <div className="min-h-0 flex-1 overflow-auto pr-[26px]">
        <div className="flex min-h-full min-w-full flex-col">
          {/* --- Header row: the staff -------------------------------------- */}
          <div className="sticky top-0 z-20 flex shrink-0 bg-white">
            {/* The corner is sticky on BOTH axes or it slides away from one. */}
            <div
              className="sticky left-0 z-10 shrink-0 border-b border-r border-[#e7e7ea] bg-white"
              style={{ width: GUTTER + BLOCK_W }}
            />
            {columns.map((col) => {
              const active = hover?.col === col.key;
              return (
                <div
                  key={col.key}
                  className={cn(
                    "flex flex-1 items-center gap-2 border-b border-r border-[#e7e7ea] px-2.5 py-2 transition-colors",
                    active ? "bg-[var(--accent-tint)]" : col.muted ? "bg-[#fafafa]" : "bg-white",
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
                    <span className="block truncate text-[12.5px] font-semibold text-[#0a0a0a]">
                      {col.label}
                    </span>
                    {col.hint && (
                      <span className="block truncate text-[10.5px] text-[#a1a1aa]">{col.hint}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* --- Body: one row per day, two blocks per row ------------------- */}
          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{ minHeight: days.length * 2 * MIN_BLOCK_H }}
          >
            {days.map((day) => {
              const key = toDateParam(day);
              const lit = hover?.row?.startsWith(`${key}|`) ?? false;
              const today = isSameDay(day, new Date());
              const weekend = isWeekend(day);

              return (
                <div
                  key={key}
                  className="flex min-h-0 flex-1 border-b border-[#e7e7ea]"
                  onMouseLeave={() => setHover(null)}
                >
                  {/* The date spans BOTH its blocks — a day is still one thing,
                      it just has two halves. Sticky left so it stays readable
                      however far the grid is scrolled sideways, and a link into
                      that day — the natural next move from "Thursday's heavy". */}
                  <Link
                    href={`/diary?view=day&d=${key}`}
                    className={cn(
                      "sticky left-0 z-10 flex shrink-0 flex-col justify-center gap-0.5 border-r border-[#e7e7ea] px-2.5 transition-colors",
                      lit
                        ? "bg-[var(--accent-tint)]"
                        : weekend
                          ? "bg-[#fafafa] hover:bg-[#f4f4f5]"
                          : "bg-white hover:bg-[#f4f4f5]",
                    )}
                    style={{ width: GUTTER }}
                  >
                    <span
                      className={cn(
                        "text-[11px] font-bold uppercase tracking-[0.06em]",
                        today ? "text-[var(--accent-active)]" : "text-[#a1a1aa]",
                      )}
                    >
                      {day.toLocaleDateString("en-GB", { weekday: "short" })}
                    </span>
                    <span
                      className={cn(
                        "text-[15px] font-extrabold leading-none tabular-nums",
                        today ? "text-[var(--accent-active)]" : "text-[#0a0a0a]",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <span className="text-[10.5px] text-[#a1a1aa]">
                      {today ? "Today" : day.toLocaleDateString("en-GB", { month: "short" })}
                    </span>
                  </Link>

                  {/* The day's two halves. */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    {BLOCKS.map(({ key: block, label }, i) => {
                      const rowKey = `${key}|${block}`;
                      const rowLit = hover?.row === rowKey;
                      return (
                        <div
                          key={block}
                          className={cn(
                            "flex min-h-0 flex-1",
                            // Hairline between AM and PM; the day's own border
                            // is the heavier one, so the halves read as halves
                            // rather than as fourteen separate rows.
                            i > 0 && "border-t border-[#f4f4f5]",
                          )}
                        >
                          <div
                            className={cn(
                              "sticky z-10 flex shrink-0 items-start justify-center border-r border-[#e7e7ea] pt-1.5 transition-colors",
                              rowLit
                                ? "bg-[var(--accent-tint)]"
                                : weekend
                                  ? "bg-[#fafafa]"
                                  : "bg-white",
                            )}
                            style={{ left: GUTTER, width: BLOCK_W }}
                          >
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-[0.06em] transition-colors",
                                rowLit ? "text-[var(--accent-active)]" : "text-[#a1a1aa]",
                              )}
                            >
                              {label}
                            </span>
                          </div>

                          {columns.map((col) => (
                            <Cell
                              key={col.key}
                              day={day}
                              weekend={weekend}
                              muted={col.muted}
                              lit={hover?.col === col.key && hover.row === rowKey}
                              jobs={cells.get(`${rowKey}|${col.key}`) ?? []}
                              label={`${day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} ${label} — ${col.label}`}
                              onEnter={() => setHover({ col: col.key, row: rowKey })}
                              onPick={() => onPick?.(col.key, day, block)}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Legend />
    </div>
  );
}

function Cell({
  day,
  weekend,
  muted,
  lit,
  jobs,
  label,
  onEnter,
  onPick,
}: {
  day: Date;
  weekend: boolean;
  muted?: boolean;
  lit: boolean;
  jobs: WeekCell[];
  label: string;
  onEnter: () => void;
  onPick: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-1 flex-col border-r border-[#e7e7ea] transition-colors",
        lit ? "bg-[var(--accent-tint)]" : weekend || muted ? "bg-[#fafafa]" : "bg-white",
      )}
      style={{ minWidth: MIN_COL }}
      onMouseEnter={onEnter}
    >
      {/* The empty cell IS the booking target — the whole cell, so a
          card-sized thing has a card-sized target (the same rule the kanban's
          columns follow). It sits UNDER the jobs so a click on a job opens the
          job rather than starting a new booking. */}
      <button
        type="button"
        onClick={onPick}
        className="absolute inset-0 hover:bg-[#f4f4f5]/60"
        aria-label={`Book — ${label}`}
      />

      {/* Jobs scroll inside their own cell rather than growing the row: one
          busy person must not set the height of everybody else's Tuesday. */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5">
        {jobs.map((j) => (
          <JobChip key={`${j.event.id}-${+j.start}`} cell={j} day={day} />
        ))}
      </div>
    </div>
  );
}

function JobChip({ cell, day }: { cell: WeekCell; day: Date }) {
  const { event, start, minutes, continuedFrom, continuesInto } = cell;
  const cat = WORK_CATEGORIES.find((c) => c.key === event.category)!;
  const ref = event.contractRef ?? event.leadRef;
  const href = event.contractId
    ? `/contracts/${event.contractId}`
    : event.leadId
      ? `/leads/${event.leadId}`
      : event.customerId
        ? `/customers/${event.customerId}`
        : null;

  const time = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const body = (
    <>
      <span className="flex items-baseline gap-1.5">
        <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-[#0a0a0a]">
          {continuedFrom ? "cont." : time}
        </span>
        <span className="truncate text-[10px] text-[#71717a]">
          {durationLabel(minutes)}
          {continuesInto && " →"}
        </span>
        {event.provisional && (
          <span className="ml-auto shrink-0 text-[9px] font-bold uppercase tracking-[0.04em] text-[#a1a1aa]">
            Prov
          </span>
        )}
      </span>
      <span className="block truncate text-[11px] font-semibold" style={{ color: cat.fg }}>
        {ref && <span className="font-mono">{ref} · </span>}
        {event.customerName ?? event.title}
      </span>
      <span className="block truncate text-[10px] leading-tight text-[#52525b]">{event.title}</span>
    </>
  );

  const className = cn(
    "flex shrink-0 flex-col gap-px overflow-hidden rounded-md border px-1.5 py-1 text-left",
    href && "hover:brightness-[0.97]",
  );
  const style = {
    // Colour says WHAT the job is; the dashed outline says whether it's pinned
    // down — so a provisional survey still reads as a survey.
    background: event.provisional ? "#fff" : cat.bg,
    borderColor: event.provisional ? "#a1a1aa" : `${cat.fg}33`,
    borderStyle: event.provisional ? "dashed" : "solid",
  } as const;

  const title = `${isSameDay(start, day) ? time : "continues"} · ${durationLabel(minutes)} — ${event.title}${event.customerName ? ` (${event.customerName})` : ""}`;

  if (!href)
    return (
      <div className={className} style={style} title={title}>
        {body}
      </div>
    );
  return (
    <Link href={href} className={className} style={style} title={title}>
      {body}
    </Link>
  );
}

/**
 * Spread one booking across the half-day blocks it actually occupies.
 *
 * `workingSpan` is the slot finder's own splitter, so the week grid and the
 * availability engine agree on which days a 2.5-day fit consumes — including
 * that it stops at 17:00 and resumes the next working morning rather than
 * running through the night. Each of its stretches is then cut at midday, so a
 * full day lands in BOTH that day's blocks and an 11:00 → 13:00 survey shows in
 * the morning it starts and the afternoon it runs into.
 */
export function spanBlocks(event: DiaryEvent): { row: string; cell: WeekCell }[] {
  const start = new Date(event.startsAt);
  const minutes = event.duration ?? 60;
  const stretches = workingSpan(start, minutes);

  // A booking outside working hours yields no stretch; show it in its own
  // half-day rather than dropping it off the diary entirely.
  const spans = stretches.length
    ? stretches
    : [{ start: +start, end: +start + minutes * 60_000 }];

  // Cut every stretch at midday, then walk the pieces in order so the
  // continuation flags describe the WHOLE job, not one day of it.
  const pieces: { row: string; start: Date; minutes: number }[] = [];
  for (const s of spans) {
    const from = new Date(s.start);
    const midday = new Date(from);
    midday.setHours(MIDDAY_HOUR, 0, 0, 0);
    const cuts = +from < +midday && s.end > +midday ? [+midday] : [];
    let cursor = +from;
    for (const edge of [...cuts, s.end]) {
      const at = new Date(cursor);
      pieces.push({
        row: `${toDateParam(at)}|${at.getHours() < MIDDAY_HOUR ? "am" : "pm"}`,
        start: at,
        minutes: Math.max(1, Math.round((edge - cursor) / 60_000)),
      });
      cursor = edge;
    }
  }

  return pieces.map((p, i) => ({
    row: p.row,
    cell: {
      event,
      start: p.start,
      minutes: p.minutes,
      continuedFrom: i > 0,
      continuesInto: i < pieces.length - 1,
    },
  }));
}

/** The instant a booking made from an empty cell should start. */
export function cellStart(day: Date, block: DayBlock): Date {
  const out = startOfDay(day);
  out.setHours(block === "am" ? DAY_START_HOUR : MIDDAY_HOUR, 0, 0, 0);
  return out;
}

function Legend() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-4 border-t border-[#e7e7ea] py-2.5 pl-3 pr-[26px]">
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
        Click a cell to book that person that morning or afternoon
      </span>
    </div>
  );
}
