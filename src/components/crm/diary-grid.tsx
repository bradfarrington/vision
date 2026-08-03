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
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import {
  DAY_START_HOUR,
  DAY_END_HOUR,
  SLOTS_PER_DAY,
  SLOT_MINUTES,
  isSameDay,
  isWeekend,
  slotLabel,
  toDateParam,
} from "@/lib/diary";
import { durationLabel, suitsCategory, type WorkCategory } from "@/lib/appointments";
import { CardFieldsBody, CardFieldsButton } from "@/components/crm/card-fields";
import { CategoryColourButton, useCategory, useWorkCategories } from "@/components/crm/diary-colours";
import type { DiaryEvent } from "@/lib/data/appointments";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The diary's TIME GRID — times down the left, one column per STAFF member
// across the top, and a job occupying as many half-hour blocks as it lasts.
//
// This is the DAY view. The week is a different shape (staff across the top,
// days down the left — see diary-week-grid.tsx): a week of half-hour rows can
// only be drawn by making a column a day, which piles the whole team's jobs
// into one lane and stops saying whose they are.
//
// Everything derives from DAY_START_HOUR / DAY_END_HOUR / SLOT_MINUTES in
// lib/diary — the single place the per-company working hours will replace.
//
// ROWS FLEX. The grid fills its container's height and the slots divide it
// evenly, rather than being a fixed pixel stack that leaves a dead band under a
// tall window. MIN_SLOT_H is the floor: below that the grid scrolls instead of
// squashing the labels into each other.
// ---------------------------------------------------------------------------

/** Smallest a half-hour row may get before the grid scrolls instead. */
const MIN_SLOT_H = 34;
const GUTTER = 68;
const MIN_COL = 190;
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;

export type GridColumn = {
  key: string;
  label: string;
  /** Second line under the label — a staff role, or the month. */
  hint?: string | null;
  /** Avatar initials, for the staff columns. */
  initials?: string;
  /** The staff member's trade, for the drop-suitability check. */
  role?: string | null;
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
  onMove,
  onContext,
}: {
  columns: GridColumn[];
  /** Called when an empty slot is chosen — booking arrives with the dialog. */
  onPick?: (columnKey: string, start: Date) => void;
  /** Dropped a job on a cell: that person, that time. */
  onMove?: (id: string, start: Date, columnKey: string) => void;
  /** Right-clicked a job. */
  onContext?: (event: DiaryEvent, x: number, y: number) => void;
}) {
  // The crosshair: which cell the pointer is over. Both the time in the gutter
  // AND the column header light up, so you can read off exactly which slot and
  // whose it is without tracing the row and column by eye.
  const [hover, setHover] = useState<{ col: string; slot: number } | null>(null);
  const [picked, setPicked] = useState<{ col: string; slot: number } | null>(null);

  const slots = Array.from({ length: SLOTS_PER_DAY }, (_, i) => i);

  // A drag must clear 6px before it counts, or clicking a job to open its
  // record would be swallowed as a micro-drag (the same threshold the kanban
  // uses). `pointerWithin` because a cell is small and the pointer says which
  // one you mean far better than rect overlap does.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // While dragging, the preview highlights the slots the job would ACTUALLY
  // fill — an hour-long job lights two half-hour rows, a two-hour job four.
  // Highlighting only the cell under the pointer asks someone to picture the
  // rest, which is the one thing a diary shouldn't make you do.
  const [drag, setDrag] = useState<{ slots: number; category: WorkCategory } | null>(null);
  const [over, setOver] = useState<{ col: string; slot: number } | null>(null);

  const clearDrag = () => {
    setDrag(null);
    setOver(null);
  };

  function onDragStart(e: DragStartEvent) {
    const job = columns.flatMap((c) => c.events).find((x) => x.id === String(e.active.id));
    const mins = job?.duration ?? 60;
    setDrag({
      slots: Math.max(1, Math.ceil(mins / SLOT_MINUTES)),
      category: job?.category ?? "other",
    });
  }

  /** Can't take this job — the column is closed for the drag and says so. */
  const blocked = (col: GridColumn) => !!drag && !suitsCategory(col.role, drag.category);

  function onDragOver(e: DragOverEvent) {
    if (!e.over) {
      setOver(null);
      return;
    }
    const [col, slot] = String(e.over.id).split("|");
    setOver({ col, slot: Number(slot) });
  }

  function onDragEnd(e: DragEndEvent) {
    const wasDragging = drag;
    clearDrag();
    if (!e.over || !onMove) return;
    const [colKey, slot] = String(e.over.id).split("|");
    const col = columns.find((c) => c.key === colKey);
    // Belt and braces: the slots in a blocked column are disabled droppables,
    // so this shouldn't fire — but a drop that lands anyway must not write.
    if (!col || (wasDragging && !suitsCategory(col.role, wasDragging.category))) return;
    const start = new Date(col.day);
    start.setHours(0, 0, 0, 0);
    start.setMinutes(DAY_START_HOUR * 60 + Number(slot) * SLOT_MINUTES);
    onMove(String(e.active.id), start, colKey);
  }

  if (!columns.length) {
    return (
      <p className="px-[26px] py-10 text-center text-[13px] text-[#71717a]">
        Nothing to show — add staff under Settings, or widen the filters.
      </p>
    );
  }

  return (
    // Stable DndContext id — dnd-kit builds aria ids from a global counter
    // otherwise, and SSR and hydration disagree (AGENTS.md § Rearrangeable cards).
    <DndContext
      id="diary-day"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={clearDrag}
    >
    <div className="flex min-h-0 flex-1 flex-col">
      {/* One scroller for BOTH axes, so the gutter and headers stay pinned to
          their own edges while the grid moves under them. */}
      {/* No LEFT padding — the time gutter sits flush against the panel edge,
          like the list table (AGENTS.md § a list table is EDGE TO EDGE). Every
          pixel of width belongs to the grid. */}
      <div className="min-h-0 flex-1 overflow-auto pr-[26px]">
        {/* min-h-full makes the grid FILL a tall window; the body's own
            min-height stops it squashing in a short one (it scrolls instead). */}
        <div className="flex min-h-full min-w-full flex-col">
          {/* --- Header row ------------------------------------------------ */}
          <div className="sticky top-0 z-20 flex shrink-0 bg-white">
            {/* The corner sits above the gutter and left of the headers, so it
                has to be sticky on BOTH axes or it slides away from one. */}
            <div
              className="sticky left-0 z-10 shrink-0 border-b border-r border-[#e7e7ea] bg-white"
              style={{ width: GUTTER }}
            />
            {columns.map((col) => {
              const active = hover?.col === col.key || picked?.col === col.key;
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

          {/* --- Body: gutter + columns, filling the remaining height ------- */}
          <div
            className="flex min-h-0 flex-1"
            style={{ minHeight: SLOTS_PER_DAY * MIN_SLOT_H }}
          >
            {/* Time gutter. Sticky left so the times stay readable however far
                the grid is scrolled sideways. */}
            <div
              className="sticky left-0 z-10 flex shrink-0 flex-col border-r border-[#e7e7ea] bg-white"
              style={{ width: GUTTER }}
            >
              {slots.map((i) => {
                const onTheHour = i % 2 === 0;
                const lit = hover?.slot === i || picked?.slot === i;
                return (
                  <div
                    key={i}
                    className={cn(
                      // The label is CENTRED in its own row rather than sitting
                      // on the gridline: on the line, the first one clips
                      // against the header and every one reads as belonging to
                      // the row above as much as its own.
                      "flex flex-1 items-center justify-end pr-2.5 transition-colors",
                      onTheHour ? "border-t border-[#e7e7ea]" : "border-t border-[#f4f4f5]",
                      lit && "bg-[var(--accent-tint)]",
                    )}
                  >
                    <span
                      className={cn(
                        "tabular-nums transition-colors",
                        lit
                          ? "text-[11.5px] font-bold text-[var(--accent-active)]"
                          : onTheHour
                            ? "text-[11.5px] font-semibold text-[#3f3f46]"
                            : "text-[11px] text-[#a1a1aa]",
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
                hover={hover}
                picked={picked}
                setHover={setHover}
                onContext={onContext}
                blocked={blocked(col)}
                // The span this drop would occupy, in this column only.
                preview={
                  drag && over?.col === col.key && !blocked(col)
                    ? { from: over.slot, to: over.slot + drag.slots }
                    : null
                }
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
    </DndContext>
  );
}

function Column({
  col,
  slots,
  hover,
  picked,
  setHover,
  onPickSlot,
  onContext,
  preview,
  blocked,
}: {
  col: GridColumn;
  slots: number[];
  hover: { col: string; slot: number } | null;
  picked: { col: string; slot: number } | null;
  setHover: (v: { col: string; slot: number } | null) => void;
  onPickSlot: (slot: number, start: Date) => void;
  onContext?: (event: DiaryEvent, x: number, y: number) => void;
  preview: { from: number; to: number } | null;
  /** This person can't take the job being dragged — closed, and shown as such. */
  blocked: boolean;
}) {
  const lanes = packIntoLanes(col.events);

  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col border-r border-[#e7e7ea]",
        (isWeekend(col.day) || col.muted) && "bg-[#fafafa]",
        blocked && "bg-[#fdecec]/60",
      )}
      // Red DASHED, inset so it reads as the column being closed rather than as
      // a border between columns.
      style={{
        minWidth: MIN_COL,
        ...(blocked ? { outline: "2px dashed #e9a3a3", outlineOffset: "-2px" } : null),
      }}
      onMouseLeave={() => setHover(null)}
    >
      {/* Empty slot cells — the gridlines, the hover target, and what you click
          to book. They flex to share the column's height, so a taller window
          gives roomier rows rather than leaving dead space at the bottom. */}
      {slots.map((i) => (
        <Slot
          key={i}
          col={col}
          index={i}
          inPreview={!!preview && i >= preview.from && i < preview.to}
          isHover={hover?.col === col.key && hover.slot === i}
          isPicked={picked?.col === col.key && picked.slot === i}
          blocked={blocked}
          onEnter={() => setHover({ col: col.key, slot: i })}
          onPick={() => {
            const start = new Date(col.day);
            start.setHours(0, 0, 0, 0);
            start.setMinutes(DAY_START_HOUR * 60 + i * SLOT_MINUTES);
            onPickSlot(i, start);
          }}
        />
      ))}

      {/* Job blocks, positioned as a PERCENTAGE of the column height rather
          than in pixels — so they stay aligned with the rows however the grid
          flexes. */}
      {lanes.map((lane, laneIndex) =>
        lane.map((e) => (
          <JobBlock
            key={e.id}
            event={e}
            day={col.day}
            lane={laneIndex}
            laneCount={lanes.length}
            onContext={onContext}
          />
        )),
      )}
    </div>
  );
}

/** One half-hour cell: the gridline, the hover target, the booking click, and
 *  the drop target for a dragged job. */
function Slot({
  col,
  index,
  inPreview,
  blocked,
  isHover,
  isPicked,
  onEnter,
  onPick,
}: {
  col: GridColumn;
  index: number;
  blocked: boolean;
  /** Part of the span the dragged job would fill, not just the cell under the pointer. */
  inPreview: boolean;
  isHover: boolean;
  isPicked: boolean;
  onEnter: () => void;
  onPick: () => void;
}) {
  // A disabled droppable can't become `over`, so a blocked column can't even
  // show a landing preview — there is nothing to land on.
  const { setNodeRef } = useDroppable({ id: `${col.key}|${index}`, disabled: blocked });
  const onTheHour = index % 2 === 0;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onMouseEnter={onEnter}
      onClick={onPick}
      className={cn(
        "flex-1 transition-colors",
        onTheHour ? "border-t border-[#e7e7ea]" : "border-t border-[#f4f4f5]",
        inPreview
          ? "bg-[var(--accent-tint)] ring-1 ring-inset ring-[var(--accent-blue)]"
          : isPicked
            ? "bg-[var(--accent-tint)] ring-1 ring-inset ring-[var(--accent-blue)]"
            : isHover
              ? "bg-[var(--accent-tint)]"
              : "hover:bg-[#f4f4f5]",
      )}
      aria-label={`${slotLabel(index)} — ${col.label}`}
    />
  );
}

function JobBlock({
  event,
  day,
  lane,
  laneCount,
  onContext,
}: {
  event: DiaryEvent;
  day: Date;
  lane: number;
  laneCount: number;
  onContext?: (event: DiaryEvent, x: number, y: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
  });
  // A block is BOTH a drag handle and a link. The sensor's 6px threshold
  // decides which, but the click still fires after a drop — so without this
  // guard every move would also navigate away from the diary. Same pattern,
  // same reason, as the kanban card.
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
  const start = new Date(event.startsAt);
  const mins = event.duration ?? 60;

  // Minutes from the top of the working day. A job can start before the day
  // opens or run past it (day 2 of a multi-day fit), so clamp to the grid
  // rather than letting the block escape the column.
  const rawTop = (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes();
  const top = Math.max(0, rawTop);
  const bottom = Math.min(TOTAL_MINUTES, rawTop + mins);
  const spanMinutes = Math.max(bottom - top, SLOT_MINUTES / 2);

  const continuesAfter = rawTop + mins > TOTAL_MINUTES;
  const startedBefore = rawTop < 0;
  // Multi-day jobs land in every column they touch; only the first shows full
  // detail, the rest read as a continuation.
  const isContinuation = !isSameDay(start, day);

  const cat = useCategory(event.category);
  const href = event.contractId
    ? `/contracts/${event.contractId}`
    : event.leadId
      ? `/leads/${event.leadId}`
      : event.customerId
        ? `/customers/${event.customerId}`
        : null;

  // Side-by-side when a person is double-booked: a clash is exactly the thing
  // that must not hide behind itself.
  const width = `calc(${100 / laneCount}% - 5px)`;
  const left = `calc(${(lane * 100) / laneCount}% + 3px)`;
  // A short booking gets one line; anything half an hour or more can carry the
  // customer too.
  const compact = spanMinutes <= SLOT_MINUTES;

  // WHICH fields these are is the user's choice — see appointment-fields.tsx
  // (the "Card fields" button in the legend). The block owns its frame, the
  // colour band and the continuation markers; the contents are theirs.
  const body = (
    <>
      {(startedBefore || isContinuation || event.provisional) && (
        <span className="flex items-baseline gap-1.5">
          {(startedBefore || isContinuation) && (
            <span className="shrink-0 text-[10px] font-bold text-[#71717a]">cont.</span>
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
      {continuesAfter && !compact && (
        <span className="block text-[10px] text-[#71717a]">&rarr;</span>
      )}
    </>
  );

  const face = cn(
    "flex h-full w-full flex-col gap-px overflow-hidden rounded-md border px-1.5 py-0.5 text-left",
    href && "hover:brightness-[0.97]",
  );
  const faceStyle = {
    // Colour says WHAT the job is; the dashed outline says whether it's pinned
    // down — so a provisional survey still reads as a survey.
    background: event.provisional ? "#fff" : cat.bg,
    borderColor: event.provisional ? "#a1a1aa" : `${cat.fg}33`,
    borderStyle: event.provisional ? "dashed" : "solid",
  } as const;

  const title = `${start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · ${durationLabel(mins)} — ${event.title}${event.customerName ? ` (${event.customerName})` : ""}`;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // Right-click is the shortcut menu; left-click opens the record; a real
      // drag does neither.
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
        "absolute z-10 cursor-grab",
        isDragging && "z-30 cursor-grabbing opacity-90 shadow-[0_6px_16px_rgba(10,10,10,0.18)]",
      )}
      style={{
        top: `${(top / TOTAL_MINUTES) * 100}%`,
        height: `${(spanMinutes / TOTAL_MINUTES) * 100}%`,
        left,
        width,
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
  const categories = useWorkCategories();
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#e7e7ea] py-2 pl-3 pr-[26px]">
      <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
        Legend
      </span>
      {/* Each swatch is a colour picker — the legend is where you READ the
          colours, so it's where you change them. */}
      {categories
        .filter((c) => c.key !== "other")
        .map((c) => (
          <CategoryColourButton key={c.key} category={c} />
        ))}
      <span className="flex items-center gap-1.5 px-1.5 text-[11.5px] text-[#52525b]">
        <span className="size-3 rounded border-[1.5px] border-dashed border-[#a1a1aa]" />
        Provisional
      </span>
      {/* The card picker lives HERE rather than in the toolbar: the legend is
          already the "how this is drawn" bar, and the toolbar has no width
          left (AGENTS.md § it is ONE ROW). */}
      <span className="ml-auto flex items-center gap-2.5">
        <span className="text-[11px] text-[#a1a1aa]">{SLOT_MINUTES}-minute blocks</span>
        <CardFieldsButton />
      </span>
    </div>
  );
}

export { toDateParam };
