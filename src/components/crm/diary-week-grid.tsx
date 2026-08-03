"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Icon } from "@/components/crm/icon";
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
//
// But it occupies them as ONE CARD, SPANNING the blocks — not a copy of the card
// in each. A job running 09:00 → 15:00 drew two identical cards in AM and PM and
// read as two separate bookings. So each staff column is a 2-row grid per day
// and a card is placed across the rows it fills. A card that spans, STRETCHES to
// fill them, or it doesn't look like it spans anything.
//   Spanning stops at the DAY boundary: a 3-day fit is one card per day (marked
// "cont."), because a card drawn through the day's rule and past the date in the
// gutter reads as broken rather than as continuous.
//   When a spanning job shares a day with a shorter one, they take a LANE each —
// they'd otherwise be drawn on top of each other, and a clash is the one thing
// that must not hide behind itself (the same rule the day grid follows).
//
// A ROW NEVER GROWS WITH ITS CONTENT. Every row is the same height whether it
// holds nothing or four jobs, because a matrix you read across is only readable
// if the rows line up and stay where they were — one busy morning must not
// become the height of the screen. Cards are clipped and the row's AM/PM label
// grows a chevron that expands it to fit; see MIN_BLOCK_H and `need`/`shown`.
// ---------------------------------------------------------------------------

/** The height of EVERY half-day block, full or empty, until one is expanded. */
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

/** One person's job on one DAY, already resolved by the view. */
export type WeekCell = {
  event: DiaryEvent;
  /** The instant this day's stretch of the job starts. */
  start: Date;
  /** Minutes worked on THIS day (a longer job is split across days). */
  minutes: number;
  /** Which halves of the day it fills — one card spans all of them. */
  blocks: DayBlock[];
  /** Ran on an earlier day too. */
  continuedFrom: boolean;
  /** Runs on into a later day. */
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
  /** `${dayKey}|${columnKey}` → that person's jobs on that day. */
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

  // --- Row heights ---------------------------------------------------------
  // `need` is the tallest content in each half-day row (measured, because a card
  // is whatever the user's chosen fields make it), `shown` the height that row is
  // actually drawn at. A row whose content doesn't fit offers the chevron; only
  // an EXPANDED row is sized to its content. Everything else stays uniform.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [need, setNeed] = useState<Map<string, number>>(new Map());
  const [shown, setShown] = useState<Map<string, number>>(new Map());

  // Per row, per reporter — one cell's stack, so the row's requirement is the
  // tallest of them. Held in a ref and folded into state on the next frame:
  // ~90 cells report on first paint and on every resize.
  const naturals = useRef(new Map<string, Map<string, number>>());
  const frame = useRef<number | null>(null);
  const reportNatural = useCallback((row: string, cell: string, h: number) => {
    let per = naturals.current.get(row);
    if (!per) naturals.current.set(row, (per = new Map()));
    if (per.get(cell) === h) return;
    per.set(cell, h);
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const next = new Map<string, number>();
      for (const [key, reported] of naturals.current) {
        next.set(key, Math.max(0, ...reported.values()));
      }
      setNeed(next);
    });
  }, []);
  useEffect(() => () => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
  }, []);

  const reportShown = useCallback((row: string, h: number) => {
    setShown((prev) => (prev.get(row) === h ? prev : new Map(prev).set(row, h)));
  }, []);

  const toggleRow = (row: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(row)) next.add(row);
      return next;
    });

  /** The height to PIN a row at, or null to leave it sharing the day evenly. */
  const rowHeight = (row: string) =>
    expanded.has(row) ? Math.max(MIN_BLOCK_H, need.get(row) ?? MIN_BLOCK_H) : null;

  // Every day's two tracks, resolved up front: the day row's flex-basis is their
  // sum, and the whole body's basis is the sum of those — which is what lets the
  // grid SCROLL when it doesn't fit and FILL the panel when it does, without a
  // card's height ever reaching the calculation.
  const tracks = days.map((day) => {
    const key = toDateParam(day);
    const am = rowHeight(`${key}|am`);
    const pm = rowHeight(`${key}|pm`);
    return { key, am, pm, basis: (am ?? MIN_BLOCK_H) + (pm ?? MIN_BLOCK_H) };
  });
  const bodyBasis = tracks.reduce((n, t) => n + t.basis, 0);

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

          {/* --- Body: one row per day, two blocks per row -------------------
              Basis, not min-height: the body has to declare its own height for
              the scroller to scroll to it, and `flex-grow` then fills a panel
              taller than that. No content anywhere in here can add to it. */}
          <div
            className="flex flex-col"
            style={{ flex: `1 0 ${bodyBasis}px`, minHeight: bodyBasis }}
          >
            {days.map((day, dayIndex) => {
              const { key, am, pm, basis } = tracks[dayIndex];
              const lit = hover?.row?.startsWith(`${key}|`) ?? false;
              const today = isSameDay(day, new Date());
              const weekend = isWeekend(day);

              return (
                <div
                  key={key}
                  className="flex border-b border-[#e7e7ea]"
                  // minHeight explicitly, NOT `min-h-0`: a flex item's automatic
                  // minimum is its CONTENT's height, which is exactly how a busy
                  // morning used to stretch the row it was in. Stating the number
                  // leaves nothing for the cards to raise.
                  style={{ flex: `1 0 ${basis}px`, minHeight: basis }}
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

                  {/* The AM/PM rail. It sits OUTSIDE the day's cells now that a
                      card can span both of them, and each label owns its row's
                      height — so the rail and every column agree on where the
                      halves divide. It is also where a clipped row is expanded. */}
                  <div
                    className="sticky z-10 flex shrink-0 flex-col border-r border-[#e7e7ea]"
                    style={{ left: GUTTER, width: BLOCK_W }}
                  >
                    {BLOCKS.map(({ key: block, label }, i) => {
                      const rowKey = `${key}|${block}`;
                      const h = block === "am" ? am : pm;
                      return (
                        <RailCell
                          key={block}
                          label={label}
                          height={h}
                          hairline={i > 0}
                          lit={hover?.row === rowKey}
                          weekend={weekend}
                          open={expanded.has(rowKey)}
                          // Only offer it when something is actually hidden —
                          // fourteen chevrons that mostly do nothing is worse
                          // than none. `shown` is the row's real height, so this
                          // stays honest on a tall panel where a row that fits
                          // is bigger than MIN_BLOCK_H.
                          clipped={(need.get(rowKey) ?? 0) > (shown.get(rowKey) ?? MIN_BLOCK_H) + 1}
                          onToggle={() => toggleRow(rowKey)}
                          onShown={(px) => reportShown(rowKey, px)}
                        />
                      );
                    })}
                  </div>

                  {/* One column per person — the WHOLE day, both halves, so a
                      card can be placed across them. */}
                  {columns.map((col) => (
                    <DayColumn
                      key={col.key}
                      dayKey={key}
                      day={day}
                      col={col}
                      am={am}
                      pm={pm}
                      weekend={weekend}
                      blocked={blocked(col)}
                      // Highlighted only in the column being dropped on: the
                      // same job in someone else's row would be a different
                      // booking.
                      previewBlocks={dropCol === col.key ? preview : null}
                      hoverRow={hover?.col === col.key ? (hover.row ?? null) : null}
                      jobs={cells.get(`${key}|${col.key}`) ?? []}
                      onEnter={(block) => setHover({ col: col.key, row: `${key}|${block}` })}
                      onPick={(block) => onPick?.(col.key, day, block)}
                      onContext={onContext}
                      onNatural={reportNatural}
                    />
                  ))}
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

/**
 * Report an element's own height whenever it changes.
 *
 * Two jobs: a card stack reports the height it WANTS (so a row knows whether it
 * is hiding anything, and what to grow to), and a rail label reports the height
 * it GOT (which is the row's real height). `clear` sends a 0 on unmount so a
 * stack that goes away doesn't leave a phantom chevron behind it; a rail label
 * never unmounts while the grid lives, and must not report a 0 it would then be
 * measured against.
 */
function useReportHeight(report: (h: number) => void, clear = false) {
  const ref = useRef<HTMLDivElement | null>(null);
  // The reporter is a fresh closure every render; the observer must not be torn
  // down and rebuilt for it (the same pattern the map's tile-error callback uses).
  const latest = useRef(report);
  useEffect(() => {
    latest.current = report;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // scrollHeight, not offsetHeight: a spanning stack is pinned to its grid
    // area (`h-full`) so its card fills it, so its own box says nothing about
    // how tall the card actually wants to be — its overflow does.
    const measure = () => latest.current(Math.max(el.scrollHeight, el.offsetHeight));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => {
      ro.disconnect();
      if (clear) latest.current(0);
    };
  }, [clear]);

  return ref;
}

function RailCell({
  label,
  height,
  hairline,
  lit,
  weekend,
  open,
  clipped,
  onToggle,
  onShown,
}: {
  label: string;
  /** Pinned height, or null while the row just shares the day evenly. */
  height: number | null;
  hairline: boolean;
  lit: boolean;
  weekend: boolean;
  open: boolean;
  clipped: boolean;
  onToggle: () => void;
  onShown: (h: number) => void;
}) {
  const ref = useReportHeight(onShown);

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center gap-0.5 overflow-hidden pt-1.5 transition-colors",
        // Hairline between AM and PM; the day's own border is the heavier one,
        // so the halves read as halves rather than as fourteen separate rows.
        hairline && "border-t border-[#f4f4f5]",
        lit ? "bg-[var(--accent-tint)]" : weekend ? "bg-[#fafafa]" : "bg-white",
      )}
      style={height ? { height, flex: "0 0 auto" } : { flex: "1 0 0%" }}
    >
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.06em] transition-colors",
          lit ? "text-[var(--accent-active)]" : "text-[#a1a1aa]",
        )}
      >
        {label}
      </span>
      {(clipped || open) && (
        <button
          type="button"
          onClick={onToggle}
          title={open ? `Collapse ${label}` : `Show everything in ${label}`}
          aria-label={open ? `Collapse ${label}` : `Show everything in ${label}`}
          aria-expanded={open}
          className="rounded text-[#a1a1aa] transition-colors hover:bg-[#f4f4f5] hover:text-[var(--accent-active)]"
        >
          <Icon name="chevron-down" size={13} className={open ? "rotate-180" : undefined} />
        </button>
      )}
    </div>
  );
}

/**
 * One person's whole DAY — both halves, as a 2-row grid.
 *
 * The grid is what lets a card span the halves: a job is placed on the rows it
 * fills (`gridRow`), not stacked inside one of them. The half-day backdrops sit
 * under it as the droppables and the booking targets.
 */
function DayColumn({
  dayKey,
  day,
  col,
  am,
  pm,
  weekend,
  blocked,
  previewBlocks,
  hoverRow,
  jobs,
  onEnter,
  onPick,
  onContext,
  onNatural,
}: {
  dayKey: string;
  day: Date;
  col: WeekColumn;
  am: number | null;
  pm: number | null;
  weekend: boolean;
  /** This person can't take the job being dragged. */
  blocked: boolean;
  /** Rows the dragged job would land in, or null if it's not over this column. */
  previewBlocks: Set<string> | null;
  hoverRow: string | null;
  jobs: WeekCell[];
  onEnter: (block: DayBlock) => void;
  onPick: (block: DayBlock) => void;
  onContext?: (event: DiaryEvent, x: number, y: number) => void;
  onNatural: (row: string, cell: string, h: number) => void;
}) {
  // A job that fills only one half stacks with the others in that half; a job
  // that SPANS both can't share that stack, so it takes a lane of its own.
  const spanning = jobs.filter((j) => j.blocks.length > 1);
  const halves: Record<DayBlock, WeekCell[]> = {
    am: jobs.filter((j) => j.blocks.length === 1 && j.blocks[0] === "am"),
    pm: jobs.filter((j) => j.blocks.length === 1 && j.blocks[0] === "pm"),
  };
  const twoLanes = spanning.length > 0 && (halves.am.length > 0 || halves.pm.length > 0);

  const track = (h: number | null) => (h ? `${h}px` : "minmax(0, 1fr)");

  return (
    <div
      className="grid min-w-0 flex-1 border-r border-[#e7e7ea]"
      style={{
        minWidth: MIN_COL,
        gridTemplateColumns: twoLanes ? "1fr 1fr" : "1fr",
        gridTemplateRows: `${track(am)} ${track(pm)}`,
      }}
    >
      {BLOCKS.map(({ key: block, label }, i) => (
        <Backdrop
          key={block}
          id={`${dayKey}|${block}|${col.key}`}
          row={i + 1}
          hairline={i > 0}
          blocked={blocked}
          inPreview={!!previewBlocks?.has(`${dayKey}|${block}`)}
          lit={hoverRow === `${dayKey}|${block}`}
          weekend={weekend}
          muted={col.muted}
          label={`${day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} ${label} — ${col.label}`}
          onEnter={() => onEnter(block)}
          onPick={() => onPick(block)}
        />
      ))}

      {BLOCKS.map(({ key: block }, i) =>
        halves[block].length === 0 ? null : (
          <Stack
            key={block}
            row={`${i + 1}`}
            lane={twoLanes ? "1" : "1 / -1"}
            jobs={halves[block]}
            day={day}
            onEnter={() => onEnter(block)}
            onContext={onContext}
            onNatural={(h) => onNatural(`${dayKey}|${block}`, col.key, h)}
          />
        ),
      )}

      {spanning.length > 0 && (
        <Stack
          row="1 / 3"
          lane={twoLanes ? "2" : "1 / -1"}
          jobs={spanning}
          day={day}
          stretch
          onContext={onContext}
          // It occupies both rows, so it needs half of its height from each —
          // otherwise expanding AM alone would still clip it.
          onNatural={(h) => {
            const half = Math.ceil(h / 2);
            onNatural(`${dayKey}|am`, `${col.key}#span`, half);
            onNatural(`${dayKey}|pm`, `${col.key}#span`, half);
          }}
        />
      )}
    </div>
  );
}

function Backdrop({
  id,
  row,
  hairline,
  blocked,
  inPreview,
  lit,
  weekend,
  muted,
  label,
  onEnter,
  onPick,
}: {
  id: string;
  row: number;
  hairline: boolean;
  blocked: boolean;
  inPreview: boolean;
  lit: boolean;
  weekend: boolean;
  muted?: boolean;
  label: string;
  onEnter: () => void;
  onPick: () => void;
}) {
  // Disabled, so a blocked column can't even become the drop target — there is
  // nothing to land on, and no landing preview to mislead with.
  const { setNodeRef } = useDroppable({ id, disabled: blocked });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative transition-colors",
        hairline && "border-t border-[#f4f4f5]",
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
        gridRow: row,
        gridColumn: "1 / -1",
        ...(blocked ? { outline: "2px dashed #e9a3a3", outlineOffset: "-2px" } : null),
      }}
      onMouseEnter={onEnter}
    >
      {/* The empty half-day IS the booking target — the whole of it, so a
          card-sized thing has a card-sized target (the same rule the kanban's
          columns follow). It sits UNDER the jobs so a click on a job opens the
          job rather than starting a new booking. */}
      <button
        type="button"
        onClick={onPick}
        className="absolute inset-0 hover:bg-[#f4f4f5]/60"
        aria-label={`Book — ${label}`}
      />
    </div>
  );
}

/** The cards in one half-day (or, when `stretch`, the ones spanning both). */
function Stack({
  row,
  lane,
  jobs,
  day,
  stretch,
  onEnter,
  onContext,
  onNatural,
}: {
  row: string;
  lane: string;
  jobs: WeekCell[];
  day: Date;
  stretch?: boolean;
  onEnter?: () => void;
  onContext?: (event: DiaryEvent, x: number, y: number) => void;
  onNatural: (h: number) => void;
}) {
  // The INNER box is measured — it's the height the cards want, which is what
  // the row's chevron and its expanded height are decided from. The outer box is
  // clipped to the row: jobs never grow it.
  const ref = useReportHeight(onNatural, true);

  return (
    <div
      className="relative z-10 overflow-y-auto"
      style={{
        gridRow: row,
        gridColumn: lane,
        // A stack of short cards is only as tall as they are, so the space left
        // under them still belongs to the backdrop underneath and stays
        // clickable to book. A spanning card fills its area by definition.
        ...(stretch ? null : { alignSelf: "start", maxHeight: "100%" }),
      }}
      onMouseEnter={onEnter}
    >
      <div ref={ref} className={cn("flex flex-col gap-1 p-1.5", stretch && "h-full")}>
        {jobs.map((j) => (
          <JobChip
            key={`${j.event.id}-${+j.start}`}
            cell={j}
            day={day}
            stretch={stretch}
            onContext={onContext}
          />
        ))}
      </div>
    </div>
  );
}

function JobChip({
  cell,
  day,
  stretch,
  onContext,
}: {
  cell: WeekCell;
  day: Date;
  /** Spans more than one half-day, so it FILLS them — a card that stops short
   *  of the halves it covers doesn't read as spanning anything. */
  stretch?: boolean;
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
    stretch && "h-full",
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
        draggable && "cursor-grab",
        isDragging && "relative z-30 cursor-grabbing opacity-90 shadow-[0_6px_16px_rgba(10,10,10,0.18)]",
      )}
      style={{
        // Grows into the halves it spans, but NEVER shrinks below its content:
        // that overflow is what tells the row it is hiding something.
        flex: stretch ? "1 0 auto" : "0 0 auto",
        transform: CSS.Translate.toString(transform),
        touchAction: "none",
      }}
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
 * Spread one booking across the DAYS it occupies, saying which halves of each
 * day it fills.
 *
 * `workingSpan` is the slot finder's own splitter, so the week grid and the
 * availability engine agree on which days a 2.5-day fit consumes — including
 * that it stops at 17:00 and resumes the next working morning rather than
 * running through the night.
 *
 * ONE piece PER DAY, carrying the blocks it fills — NOT one piece per half-day.
 * A job running 09:00 → 15:00 used to yield two pieces and therefore two
 * identical cards stacked in AM and PM, which read as two separate bookings.
 * It is one job, so it is one card, spanning both halves (see the header note).
 */
export function spanBlocks(event: DiaryEvent): { day: string; cell: WeekCell }[] {
  const start = new Date(event.startsAt);
  const minutes = event.duration ?? 60;
  const stretches = workingSpan(start, minutes);

  // A booking outside working hours yields no stretch; show it in its own
  // half-day rather than dropping it off the diary entirely.
  const spans = stretches.length
    ? stretches
    : [{ start: +start, end: +start + minutes * 60_000 }];

  return spans.map((s, i) => {
    const from = new Date(s.start);
    const midday = new Date(from);
    midday.setHours(MIDDAY_HOUR, 0, 0, 0);
    const blocks: DayBlock[] = [];
    if (+from < +midday) blocks.push("am");
    if (s.end > +midday) blocks.push("pm");

    return {
      day: toDateParam(from),
      cell: {
        event,
        start: from,
        minutes: Math.max(1, Math.round((s.end - s.start) / 60_000)),
        // A stretch always touches at least the half it starts in.
        blocks: blocks.length ? blocks : [from.getHours() < MIDDAY_HOUR ? "am" : "pm"],
        // The flags describe the WHOLE job, not one day of it.
        continuedFrom: i > 0,
        continuesInto: i < spans.length - 1,
      },
    };
  });
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
