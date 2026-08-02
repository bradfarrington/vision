"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { STAGE_STAT_TONE, type StageTone } from "@/lib/leads";
import { gbpCompact } from "@/lib/format";
import { CardFieldsBody } from "@/components/crm/card-fields";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The SHARED kanban board — one column per stage, one card per record, drag a
// card between columns to move it.
//
// Extracted from the leads board when contracts became the second consumer, for
// the same reason `data-list.tsx` was extracted: everything hard-won here is
// behavioural (optimistic moves that revert, the drag-vs-click threshold, the
// per-column infinite scroll, the fixed-height columns) and a fork lets one
// board silently regress them. A board screen is a BoardSpec, not a copy.
//
// It is the SAME query as its list (same filters, search and date range), run
// once per stage, so switching view never changes WHICH records you're looking
// at. See AGENTS.md § The leads board.
// ---------------------------------------------------------------------------

/** The minimum a board card must expose. Everything else rides in the spec. */
export type BoardCard = {
  id: string;
  /** Summed into the column header when a card moves between stages. */
  value: number | null;
};

export type BoardColumnData<Row> = {
  key: string;
  label: string;
  /** Every record in this stage matching the filters, not just the loaded ones. */
  total: number;
  /** Summed value of ALL of them, from the pipeline aggregate. */
  value: number;
  cards: Row[];
  hasMore: boolean;
};

export type BoardSpec<Row extends BoardCard, Filters> = {
  /**
   * Stable per board — it becomes the DndContext id (`board-${name}`). Without a
   * stable id dnd-kit builds aria ids from a global counter that differs between
   * SSR and hydration (see AGENTS.md § Rearrangeable cards).
   */
  name: string;
  /** The record's current stage key, for working out what a drop changed. */
  stageOf: (row: Row) => string;
  /** Write the stage back onto a card, for the optimistic move. */
  withStage: (row: Row, stage: string) => Row;
  /** Stage registry lookup, for the column header's colour rule. */
  resolveStage: (key: string) => { label: string; tone: StageTone };
  /** Where a card links to. */
  rowHref: (row: Row) => string;
  /** Fallback stage for a record with none — the first column, normally. */
  defaultStage: string;
  /** Singular noun for the empty column ("Nothing at this stage"). */
  noun: string;
  /** One more page of one column, for its own infinite scroll. */
  loadColumn: (
    filters: Filters,
    stage: string,
    page: number,
  ) => Promise<{ cards: Row[]; total: number; hasMore: boolean }>;
  /** Persist a drag. MUST return its error rather than throw — the board moves
   *  optimistically and needs to decide whether to keep the move or revert. */
  moveToStage: (id: string, stage: string) => Promise<{ error?: string }>;
};

export function Board<Row extends BoardCard, Filters>({
  spec,
  columns: initial,
  filters,
}: {
  spec: BoardSpec<Row, Filters>;
  columns: BoardColumnData<Row>[];
  /** The resolved query, so a column can fetch its own further pages. */
  filters: Filters;
}) {
  const router = useRouter();
  const [columns, setColumns] = useState(initial);
  const [dragging, setDragging] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startMove] = useTransition();

  // A drag must clear a small distance before it counts, or clicking a card to
  // open the record would be swallowed as a micro-drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const cardById = (id: string) =>
    columns.flatMap((c) => c.cards).find((c) => c.id === id) ?? null;

  function onDragStart(e: DragStartEvent) {
    setDragging(cardById(String(e.active.id)));
    setError(null);
  }

  function onDragEnd(e: DragEndEvent) {
    const card = dragging;
    setDragging(null);
    if (!card || !e.over) return;

    // Droppable ids are the stage keys.
    const to = String(e.over.id);
    const from = spec.stageOf(card) || spec.defaultStage;
    if (to === from) return;

    // Move OPTIMISTICALLY — a card that hangs where you dropped it until a round
    // trip finishes makes the board feel broken. `before` is captured so a
    // failed write can put everything back exactly as it was.
    const before = columns;
    setColumns((cols) =>
      cols.map((col) => {
        if (col.key === from) {
          return {
            ...col,
            cards: col.cards.filter((c) => c.id !== card.id),
            total: Math.max(0, col.total - 1),
            value: col.value - Number(card.value ?? 0),
          };
        }
        if (col.key === to) {
          return {
            ...col,
            cards: [spec.withStage(card, to), ...col.cards],
            total: col.total + 1,
            value: col.value + Number(card.value ?? 0),
          };
        }
        return col;
      }),
    );

    startMove(async () => {
      const res = await spec.moveToStage(card.id, to);
      if (res.error) {
        setColumns(before);
        setError(res.error);
        return;
      }
      // A closing stage also stamps its outcome columns server-side, and the
      // summary above the board is server-rendered — refresh so both catch up.
      router.refresh();
    });
  }

  return (
    <DndContext
      id={`board-${spec.name}`}
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {error && (
          <div className="mx-[26px] mb-2 rounded-lg border border-[#f3c7c7] bg-[#fdecec] px-3.5 py-2 text-[12.5px] font-medium text-[#d64545]">
            {error} — the card has been put back.
          </div>
        )}

        {/* One horizontal scroller holding fixed-width columns. Columns don't
            share the width: a board with six stages on a laptop would give each
            about 190px, which is narrower than the card content needs.
            No bottom padding — the columns run to the panel's edge and scroll
            their own contents, so the board's height is all cards. */}
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-[26px]">
          {columns.map((col) => (
            <Column key={col.key} spec={spec} col={col} filters={filters} setColumns={setColumns} />
          ))}
        </div>
      </div>

      {/* The dragged card follows the cursor at a slight tilt, so it reads as
          picked up rather than as a copy left behind. */}
      <DragOverlay dropAnimation={null}>
        {dragging ? <Card spec={spec} card={dragging} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column<Row extends BoardCard, Filters>({
  spec,
  col,
  filters,
  setColumns,
}: {
  spec: BoardSpec<Row, Filters>;
  col: BoardColumnData<Row>;
  filters: Filters;
  setColumns: React.Dispatch<React.SetStateAction<BoardColumnData<Row>[]>>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  const stage = spec.resolveStage(col.key);
  const tone = STAGE_STAT_TONE[stage.tone];

  const [page, setPage] = useState(1);
  const [loading, startLoading] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Latest values for the observer callback, synced after render (never during).
  const stateRef = useRef({ page, hasMore: col.hasMore, loading });
  useEffect(() => {
    stateRef.current = { page, hasMore: col.hasMore, loading };
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const { page: cur, hasMore, loading: busy } = stateRef.current;
        if (!hasMore || busy) return;
        const next = cur + 1;
        startLoading(async () => {
          const res = await spec.loadColumn(filters, col.key, next);
          setColumns((cols) =>
            cols.map((c) => {
              if (c.key !== col.key) return c;
              // De-dupe on id: a card moved by someone else can shift across
              // the page boundary between fetches.
              const seen = new Set(c.cards.map((x) => x.id));
              return {
                ...c,
                cards: [...c.cards, ...res.cards.filter((x) => !seen.has(x.id))],
                hasMore: res.hasMore,
              };
            }),
          );
          setPage(next);
        });
      },
      { root, rootMargin: "300px 0px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
    // filters is stable per mount (the page re-mounts the board on query change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [col.key]);

  return (
    // FIXED height — the column fills the board and its cards scroll inside it,
    // rather than the column growing with its cards and the whole board
    // scrolling. A stage with 300 records must not make its neighbours 300 cards
    // tall. Square at the bottom with no bottom border, like the list table:
    // that edge is the panel's.
    <div className="flex h-full w-[288px] shrink-0 flex-col rounded-t-xl border-x border-t border-[#e7e7ea] bg-[#fafafa]">
      {/* ONE compact line — a column header is a label, not a stat tile; the
          figures that deserve that treatment are in the summary row above the
          board. Stage name then its count badge on the LEFT (they're one
          thought: "New, two of them"), the value badge pushed hard RIGHT. Both
          badges stay neutral — the 3px rule already carries the stage colour. */}
      <div className="relative flex items-center gap-2 overflow-hidden rounded-t-xl border-b border-[#e7e7ea] bg-white px-3 py-2">
        <span className={cn("absolute inset-y-0 left-0 w-[3px]", tone.rule)} />
        <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
          {col.label}
        </span>
        {/* Circular, but `min-w` + `px` rather than a fixed square: a stage with
            a three-figure count would otherwise clip inside the circle. One and
            two digits read as a circle, more grow into a pill. */}
        <span className="inline-flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#f4f4f5] px-1.5 text-[10.5px] font-bold text-[#3f3f46]">
          {col.total.toLocaleString("en-GB")}
        </span>
        <span className="ml-auto inline-flex h-[20px] shrink-0 items-center rounded-full bg-[#f4f4f5] px-2 text-[10.5px] font-semibold text-[#71717a]">
          {gbpCompact(col.value)}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-0 flex-1 transition-colors",
          // The whole column lights up as a drop target — a thin insertion line
          // is too small a target for a card-sized thing.
          isOver && "bg-[var(--accent-tint)] ring-1 ring-inset ring-[var(--accent-blue)]",
        )}
      >
        {/* The cards scroll here. No visible scrollbar — that's the app-wide
            rule (globals.css); the column looks scrollable from its content. */}
        <div ref={scrollRef} className="flex h-full flex-col gap-2 overflow-y-auto p-2 pb-4">
          {col.cards.length === 0 && !loading && (
            <p className="px-1 py-6 text-center text-[12px] text-[#a1a1aa]">
              {isOver ? "Drop to move here" : "Nothing at this stage"}
            </p>
          )}
          {col.cards.map((card) => (
            <DraggableCard key={card.id} spec={spec} card={card} />
          ))}
          <div ref={sentinelRef} />
          {loading && (
            <p className="py-2 text-center text-[11.5px] text-[#a1a1aa]">Loading more…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DraggableCard<Row extends BoardCard, Filters>({
  spec,
  card,
}: {
  spec: BoardSpec<Row, Filters>;
  card: Row;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });

  // A card is BOTH a drag handle and a link to the record. The sensor's 6px
  // threshold decides which, but the click still fires after a drag ends — so
  // without this, every drop would also navigate away from the board.
  const justDragged = useRef(false);
  useEffect(() => {
    if (isDragging) {
      justDragged.current = true;
      return;
    }
    if (!justDragged.current) return;
    // Cleared on the next macrotask, i.e. after the click that follows pointerup
    // — so it suppresses that one click and no later ones.
    const t = setTimeout(() => {
      justDragged.current = false;
    }, 0);
    return () => clearTimeout(t);
  }, [isDragging]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClickCapture={(e) => {
        if (justDragged.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={cn(isDragging && "opacity-40")}
    >
      <Card spec={spec} card={card} />
    </div>
  );
}

function Card<Row extends BoardCard, Filters>({
  spec,
  card,
  overlay = false,
}: {
  spec: BoardSpec<Row, Filters>;
  card: Row;
  overlay?: boolean;
}) {
  // Which fields show is the user's choice — see components/crm/card-fields.tsx
  // (the "Cards" toolbar button). This wrapper only owns the card's frame; the
  // fields inside are rendered from the per-user card layout.
  const body = (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-[#e7e7ea] bg-white p-2.5",
        overlay
          ? "rotate-2 cursor-grabbing shadow-[0_10px_24px_rgba(10,10,10,0.18)]"
          : "cursor-grab shadow-[0_1px_2px_rgba(10,10,10,0.05)] hover:border-[#d4d4d8]",
      )}
    >
      <CardFieldsBody row={card} />
    </div>
  );

  // The overlay copy must not be a link — it's a floating render, not a target.
  if (overlay) return <div className="w-[272px]">{body}</div>;
  return (
    // draggable + link: the PointerSensor's 6px threshold decides which it is,
    // so a click opens the record and a real drag moves it.
    <Link href={spec.rowHref(card)} className="block">
      {body}
    </Link>
  );
}
