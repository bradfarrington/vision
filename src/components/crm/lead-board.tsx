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

import { loadBoardColumn, moveLeadToStage } from "@/app/(app)/leads/actions";
import { STAGE_STAT_TONE, leadStage } from "@/lib/leads";
import { gbp, gbpCompact } from "@/lib/format";
import { RefChip } from "@/components/crm/primitives";
import { cn } from "@/lib/utils";
import type { BoardColumn, LeadFilters, LeadRow } from "@/lib/data/leads";

// Kanban board for the leads list — one column per stage, one card per lead,
// drag a card between columns to move the lead.
//
// It is the SAME query as the list (same filters, search and date range), run
// once per stage, so switching view never changes which leads you're looking
// at. See AGENTS.md § The leads board.

export function LeadBoard({
  columns: initial,
  filters,
}: {
  columns: BoardColumn[];
  /** The resolved query, so a column can fetch its own further pages. */
  filters: LeadFilters;
}) {
  const router = useRouter();
  const [columns, setColumns] = useState(initial);
  const [dragging, setDragging] = useState<LeadRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startMove] = useTransition();

  // A drag must clear a small distance before it counts, or clicking a card to
  // open the lead would be swallowed as a micro-drag.
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
    const from = card.status ?? "new";
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
            cards: [{ ...card, status: to }, ...col.cards],
            total: col.total + 1,
            value: col.value + Number(card.value ?? 0),
          };
        }
        return col;
      }),
    );

    startMove(async () => {
      const res = await moveLeadToStage(card.id, to);
      if (res.error) {
        setColumns(before);
        setError(res.error);
        return;
      }
      // Won/Lost also stamp result + result_date server-side, and the header
      // count above the board is server-rendered — refresh so both catch up.
      router.refresh();
    });
  }

  return (
    <DndContext
      // Stable id — without it dnd-kit builds aria ids from a global counter
      // that differs between SSR and hydration (see AGENTS.md § Rearrangeable).
      id="board-leads"
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
            <Column key={col.key} col={col} filters={filters} setColumns={setColumns} />
          ))}
        </div>
      </div>

      {/* The dragged card follows the cursor at a slight tilt, so it reads as
          picked up rather than as a copy left behind. */}
      <DragOverlay dropAnimation={null}>
        {dragging ? <Card card={dragging} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  col,
  filters,
  setColumns,
}: {
  col: BoardColumn;
  filters: LeadFilters;
  setColumns: React.Dispatch<React.SetStateAction<BoardColumn[]>>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  const stage = leadStage(col.key);
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
          const res = await loadBoardColumn(filters, col.key, next);
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
    // scrolling. A stage with 300 leads must not make its neighbours 300 cards
    // tall. Square at the bottom with no bottom border, like the list table:
    // that edge is the panel's.
    <div className="flex h-full w-[288px] shrink-0 flex-col rounded-t-xl border-x border-t border-[#e7e7ea] bg-[#fafafa]">
      {/* A STAT TILE, exactly like the summary tiles above the board and the
          customer overview's strip: 3px stage rule on the leading edge, the
          label on its own line, then the count hard left and the value hard
          right. Cramming all three onto one line made the label fight the
          figures for the same 288px. */}
      <div className="relative overflow-hidden rounded-t-xl border-b border-[#e7e7ea] bg-white px-3.5 py-2.5">
        <span className={cn("absolute inset-y-0 left-0 w-[3px]", tone.rule)} />
        {/* Wraps rather than truncates — a stage a tenant renamed has to stay
            readable, and the column is fixed height so a second line costs
            nothing but the header's own height. */}
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
          {col.label}
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={cn(
              "shrink-0 font-[family-name:var(--font-inter-tight)] text-[18px] font-extrabold tracking-[-0.01em]",
              tone.value,
            )}
          >
            {col.total.toLocaleString("en-GB")}
          </span>
          <span className="shrink-0 text-[11.5px] text-[#71717a]">{gbpCompact(col.value)}</span>
        </div>
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
            <DraggableCard key={card.id} card={card} />
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

function DraggableCard({ card }: { card: LeadRow }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });

  // A card is BOTH a drag handle and a link to the lead. The sensor's 6px
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
      <Card card={card} />
    </div>
  );
}

function Card({ card, overlay = false }: { card: LeadRow; overlay?: boolean }) {
  const followUpDue = !!card.followUpDate && card.live;
  const body = (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-[#e7e7ea] bg-white p-2.5",
        overlay
          ? "rotate-2 cursor-grabbing shadow-[0_10px_24px_rgba(10,10,10,0.18)]"
          : "cursor-grab shadow-[0_1px_2px_rgba(10,10,10,0.05)] hover:border-[#d4d4d8]",
      )}
    >
      <div className="flex items-center gap-2">
        <RefChip className="!px-1.5 !py-0.5 !text-[10.5px]">{card.ref}</RefChip>
        <span className="ml-auto shrink-0 text-[12.5px] font-bold text-[#0a0a0a]">
          {gbp(card.value)}
        </span>
      </div>
      <div className="truncate text-[12.5px] font-semibold text-[#0a0a0a]">{card.title}</div>
      <div className="truncate text-[12px] text-[#3f3f46]">{card.customerName}</div>
      {(card.customerTown || followUpDue) && (
        <div className="flex items-baseline gap-2 text-[11px]">
          {card.customerTown && (
            <span className="min-w-0 truncate text-[#a1a1aa]">{card.customerTown}</span>
          )}
          {followUpDue && (
            <span className="ml-auto shrink-0 font-semibold text-[#b86e00]">
              {shortDate(card.followUpDate)}
            </span>
          )}
        </div>
      )}
    </div>
  );

  // The overlay copy must not be a link — it's a floating render, not a target.
  if (overlay) return <div className="w-[272px]">{body}</div>;
  return (
    // draggable + link: the PointerSensor's 6px threshold decides which it is,
    // so a click opens the lead and a real drag moves it.
    <Link href={`/leads/${card.id}`} className="block">
      {body}
    </Link>
  );
}

function shortDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
