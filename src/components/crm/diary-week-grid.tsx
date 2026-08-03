"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

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
import { durationLabel, suitsCategory } from "@/lib/appointments";
import { CardFieldsBody, CardFieldsButton } from "@/components/crm/card-fields";
import { CategoryColourButton, useCategory, useWorkCategories } from "@/components/crm/diary-colours";
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
/** The date rail down the left. */
const GUTTER = 82;
/** The AM/PM label rail, sitting between the date and the staff cells. */
const BLOCK_W = 38;
/** A staff column never gets narrower than its card content needs. */
const MIN_COL = 190;

const BLOCKS: { key: DayBlock; label: string }[] = [
  { key: "am", label: "AM" },
  { key: "pm", label: "PM" },
];

export type WeekColumn = {
  key: string;
  label: string;
  /** Second line under the name — the staff role. Also the suitability check. */
  hint?: string | null;
  role?: string | null;
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
  onMove,
  onContext,
}: {
  columns: WeekColumn[];
  days: Date[];
  /** `${dayKey}|${block}|${columnKey}` → that person's jobs in that half-day. */
  cells: Map<string, WeekCell[]>;
  onPick?: (columnKey: string, day: Date, block: DayBlock) => void;
  /** Dropped a job in a cell: that person, that half-day. */
  onMove?: (id: string, day: Date, block: DayBlock, columnKey: string) => void;
  /** Right-clicked a job. */
  onContext?: (event: DiaryEvent, x: number, y: number) => void;
}) {
  // The crosshair, as on the day grid: hovering a cell lights BOTH the half-day
  // down the left and the person across the top, so you can read off whose
  // Thursday morning you are looking at without tracing row and column by eye.
  const [hover, setHover] = useState<{ col: string; row: string } | null>(null);

  // Same 6px threshold and pointer collision as the day grid — a click on a
  // job must still open its record.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Every block the dragged job would fill, not just the cell under the
  // pointer: a full day lights AM and PM, a two-day fit lights four blocks.
  const [dragJob, setDragJob] = useState<DiaryEvent | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Set<string>>(new Set());
  /** Which staff column the pointer is over — the preview belongs to one. */
  const [dropCol, setDropCol] = useState<string | null>(null);

  const jobById = (id: string) => {
    for (const list of cells.values()) {
      const hit = list.find((c) => c.event.id === id);
      if (hit) return hit.event;
    }
    return null;
  };

  /** Can't take this job — closed for the drag, and shown as closed. */
  const blocked = (col: WeekColumn) => !!dragJob && !suitsCategory(col.role, dragJob.category);

  const clearDrag = () => {
    setDragJob(null);
    setDragId(null);
    setPreview(new Set());
    setDropCol(null);
  };

  function onDragOver(e: DragOverEvent) {
    const job = dragId ? jobById(dragId) : null;
    if (!e.over || !job) {
      setPreview(new Set());
      setDropCol(null);
      return;
    }
    const [dayKey, block, colKey] = String(e.over.id).split("|");
    setDropCol(colKey);
    const day = days.find((d) => toDateParam(d) === dayKey);
    if (!day || (block !== "am" && block !== "pm")) return;

    // The same splitter the grid renders with, from the same landing time the
    // drop will use — so the highlight can't promise a shape the drop won't
    // produce.
    const start = weekDropStart(job, day, block);
    const rows = workingSpan(start, job.duration ?? 60).map((s) => {
      const at = new Date(s.start);
      return `${toDateParam(at)}|${at.getHours() < MIDDAY_HOUR ? "am" : "pm"}`;
    });
    setPreview(new Set(rows.length ? rows : [`${dayKey}|${block}`]));
  }

  function onDragEnd(e: DragEndEvent) {
    const job = dragJob;
    clearDrag();
    if (!e.over || !onMove) return;
    const [dayKey, block, colKey] = String(e.over.id).split("|");
    const day = days.find((d) => toDateParam(d) === dayKey);
    if (!day || (block !== "am" && block !== "pm")) return;
    // Belt and braces — a blocked column's cells are disabled droppables.
    const col = columns.find((c) => c.key === colKey);
    if (job && col && !suitsCategory(col.role, job.category)) return;
    onMove(String(e.active.id), day, block, colKey);
  }

  if (!columns.length) {
    return (
      <p className="px-[26px] py-10 text-center text-[13px] text-[#71717a]">
        Nothing to show — add staff under Settings, or widen the filters.
      </p>
    );
  }

  return (
    // Stable id — see the day grid.
    <DndContext
      id="diary-week"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => {
        const id = String(e.active.id);
        setDragId(id);
        setDragJob(jobById(id));
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={clearDrag}
    >
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
              const shut = blocked(col);
              return (
                <div
                  key={col.key}
                  className={cn(
                    "flex flex-1 items-center gap-2 border-b border-r border-[#e7e7ea] px-2.5 py-2 transition-colors",
                    shut
                      ? "bg-[#fdecec] text-[#d64545]"
                      : active
                        ? "bg-[var(--accent-tint)]"
                        : col.muted
                          ? "bg-[#fafafa]"
                          : "bg-white",
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
                              id={`${rowKey}|${col.key}`}
                              // Highlighted only in the column being dropped
                              // on: the same job in someone else's row would be
                              // a different booking.
                              inPreview={preview.has(rowKey) && dropCol === col.key}
                              blocked={blocked(col)}
                              day={day}
                              weekend={weekend}
                              muted={col.muted}
                              lit={hover?.col === col.key && hover.row === rowKey}
                              jobs={cells.get(`${rowKey}|${col.key}`) ?? []}
                              label={`${day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} ${label} — ${col.label}`}
                              onEnter={() => setHover({ col: col.key, row: rowKey })}
                              onPick={() => onPick?.(col.key, day, block)}
                              onContext={onContext}
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
    </DndContext>
  );
}

function Cell({
  id,
  inPreview,
  blocked,
  day,
  weekend,
  muted,
  lit,
  jobs,
  label,
  onEnter,
  onPick,
  onContext,
}: {
  id: string;
  inPreview: boolean;
  /** This person can't take the job being dragged. */
  blocked: boolean;
  day: Date;
  weekend: boolean;
  muted?: boolean;
  lit: boolean;
  jobs: WeekCell[];
  label: string;
  onEnter: () => void;
  onPick: () => void;
  onContext?: (event: DiaryEvent, x: number, y: number) => void;
}) {
  // Disabled, so a blocked column can't even become the drop target — there is
  // nothing to land on, and no landing preview to mislead with.
  const { setNodeRef } = useDroppable({ id, disabled: blocked });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col border-r border-[#e7e7ea] transition-colors",
        blocked
          ? "bg-[#fdecec]/60"
          : inPreview
            ? "bg-[var(--accent-tint)] ring-1 ring-inset ring-[var(--accent-blue)]"
            : lit
              ? "bg-[var(--accent-tint)]"
              : weekend || muted
                ? "bg-[#fafafa]"
                : "bg-white",
      )}
      style={{
        minWidth: MIN_COL,
        ...(blocked ? { outline: "2px dashed #e9a3a3", outlineOffset: "-2px" } : null),
      }}
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
          <JobChip key={`${j.event.id}-${+j.start}`} cell={j} day={day} onContext={onContext} />
        ))}
      </div>
    </div>
  );
}

function JobChip({
  cell,
  day,
  onContext,
}: {
  cell: WeekCell;
  day: Date;
  onContext?: (event: DiaryEvent, x: number, y: number) => void;
}) {
  const { event, start, minutes, continuedFrom, continuesInto } = cell;
  // Only the FIRST piece of a multi-block job is draggable: dragging "the
  // afternoon of a two-day fit" has no meaning the diary could act on.
  const draggable = !continuedFrom;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    disabled: !draggable,
  });
  // A chip is BOTH a drag handle and a link; the 6px threshold decides which,
  // and this suppresses the click that follows a drop. Same as the kanban card.
  const justDragged = useRef(false);
  useEffect(() => {
    if (isDragging) {
      justDragged.current = true;
      return;
    }
    if (!justDragged.current) return;
    const t = setTimeout(() => {
      justDragged.current = false;
    }, 0);
    return () => clearTimeout(t);
  }, [isDragging]);
  const cat = useCategory(event.category);
  const href = event.contractId
    ? `/contracts/${event.contractId}`
    : event.leadId
      ? `/leads/${event.leadId}`
      : event.customerId
        ? `/customers/${event.customerId}`
        : null;

  const time = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  // Contents are the user's choice (appointment-fields.tsx); the chip owns its
  // frame, its colour band and the continuation markers.
  const body = (
    <>
      {(continuedFrom || continuesInto || event.provisional) && (
        <span className="flex items-baseline gap-1.5">
          {continuedFrom && (
            <span className="shrink-0 text-[10px] font-bold text-[#71717a]">cont.</span>
          )}
          {continuesInto && !continuedFrom && (
            <span className="shrink-0 text-[10px] text-[#71717a]">&rarr;</span>
          )}
          {event.provisional && (
            <span className="ml-auto shrink-0 text-[9px] font-bold uppercase tracking-[0.04em] text-[#a1a1aa]">
              Prov
            </span>
          )}
        </span>
      )}
      <span className="min-w-0" style={{ color: cat.fg }}>
        <CardFieldsBody row={event} />
      </span>
    </>
  );

  const face = cn(
    "flex flex-col gap-px overflow-hidden rounded-md border px-1.5 py-1 text-left",
    href && "hover:brightness-[0.97]",
  );
  const faceStyle = {
    // Colour says WHAT the job is; the dashed outline says whether it's pinned
    // down — so a provisional survey still reads as a survey.
    background: event.provisional ? "#fff" : cat.bg,
    borderColor: event.provisional ? "#a1a1aa" : `${cat.fg}33`,
    borderStyle: event.provisional ? "dashed" : "solid",
  } as const;

  const title = `${isSameDay(start, day) ? time : "continues"} · ${durationLabel(minutes)} — ${event.title}${event.customerName ? ` (${event.customerName})` : ""}`;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onContextMenu={(ev) => {
        if (!onContext) return;
        ev.preventDefault();
        onContext(event, ev.clientX, ev.clientY);
      }}
      onClickCapture={(ev) => {
        if (justDragged.current) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      }}
      className={cn(
        "shrink-0",
        draggable && "cursor-grab",
        isDragging && "relative z-30 cursor-grabbing opacity-90 shadow-[0_6px_16px_rgba(10,10,10,0.18)]",
      )}
      style={{ transform: CSS.Translate.toString(transform), touchAction: "none" }}
    >
      {href ? (
        <Link href={href} className={face} style={faceStyle} title={title}>
          {body}
        </Link>
      ) : (
        <div className={face} style={faceStyle} title={title}>
          {body}
        </div>
      )}
    </div>
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

/**
 * Where a job dropped on (day, half-day) would actually START.
 *
 * The time of day is KEPT when the drop stays in the half it was already in,
 * and snapped to the start of the other half when it crosses over — so an
 * 09:00 survey dragged to Thursday afternoon becomes 12:00 rather than sitting
 * at 09:00 in a cell labelled PM.
 *
 * ONE function, used by both the drop PREVIEW and the drop itself: two copies
 * would eventually disagree, and the disagreement would be a highlight that
 * lies about where the job is going.
 */
export function weekDropStart(job: DiaryEvent, day: Date, block: DayBlock): Date {
  const was = new Date(job.startsAt);
  const keepsTime = (was.getHours() < MIDDAY_HOUR) === (block === "am");
  const at = startOfDay(day);
  at.setHours(
    keepsTime ? was.getHours() : block === "am" ? DAY_START_HOUR : MIDDAY_HOUR,
    keepsTime ? was.getMinutes() : 0,
    0,
    0,
  );
  return at;
}

/** The instant a booking made from an empty cell should start. */
export function cellStart(day: Date, block: DayBlock): Date {
  const out = startOfDay(day);
  out.setHours(block === "am" ? DAY_START_HOUR : MIDDAY_HOUR, 0, 0, 0);
  return out;
}

function Legend() {
  const categories = useWorkCategories();
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#e7e7ea] py-2 pl-3 pr-[26px]">
      <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
        Legend
      </span>
      {categories
        .filter((c) => c.key !== "other")
        .map((c) => (
          <CategoryColourButton key={c.key} category={c} />
        ))}
      <span className="flex items-center gap-1.5 px-1.5 text-[11.5px] text-[#52525b]">
        <span className="size-3 rounded border-[1.5px] border-dashed border-[#a1a1aa]" />
        Provisional
      </span>
      <span className="ml-auto flex items-center gap-2.5">
        <span className="text-[11px] text-[#a1a1aa]">Click a cell to book</span>
        <CardFieldsButton />
      </span>
    </div>
  );
}
