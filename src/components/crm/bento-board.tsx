"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Card, CardTitle } from "@/components/crm/primitives";
import { cn } from "@/lib/utils";
import { resetUserLayout, saveUserLayout } from "@/app/(app)/preferences/actions";

/**
 * The customer-overview bento, made rearrangeable and PER-USER persistent.
 *
 * The cards themselves are server-rendered (they carry live data + inline
 * editors) and handed in as a `Record<id, ReactNode>`; this client board only
 * decides which column each one sits in and in what order, then saves that
 * arrangement to `user_ui_layouts` on every drop. Company A's five users each
 * get their own row, so their overviews can differ entirely.
 *
 * Why a drag HANDLE rather than a draggable card: every card is full of
 * clickable things — inline `EditableField`s, "Edit →" jumps, note/document
 * rows. Grabbing the whole card would swallow those clicks. The handle is a grip
 * that surfaces on hover at the card's top edge; the rest of the card stays
 * fully interactive.
 *
 * The fit-to-panel behaviour (see FitRows) is preserved by mirroring the flex
 * semantics the cards had as direct column children onto their sortable wrapper:
 * FIELD cards (Identity/Flags — editable only here) are `shrink-0` so a row is
 * never lost; LIST cards may shrink and their FitRows trims to fit.
 */

type BentoBoardProps = {
  layoutKey: string;
  /** id → server-rendered card. The keys are the full set of known cards. */
  cards: Record<string, React.ReactNode>;
  /** id → short title, used for the drag ghost. */
  titles: Record<string, string>;
  /** Cards that must keep every row (own the only editor for their fields). */
  fieldCards: string[];
  /** Fallback arrangement (columns of ids) when the user hasn't customised. */
  defaultLayout: string[][];
  /** The user's saved arrangement, or null. */
  savedLayout: string[][] | null;
};

/**
 * Reconcile a stored arrangement against the cards that actually exist now:
 * drop unknown/duplicate ids, and append any card missing from the layout to the
 * shortest column. That last part is what makes a card added in a later release
 * appear for users who already have a saved layout — nothing silently vanishes.
 */
function reconcile(layout: string[][], allIds: string[], columnCount: number): string[][] {
  const cols: string[][] = Array.from({ length: columnCount }, (_, i) => layout[i] ?? []);
  const seen = new Set<string>();
  const cleaned = cols.map((col) =>
    col.filter((id) => allIds.includes(id) && !seen.has(id) && (seen.add(id), true)),
  );
  for (const id of allIds) {
    if (seen.has(id)) continue;
    let shortest = 0;
    for (let i = 1; i < cleaned.length; i++) {
      if (cleaned[i].length < cleaned[shortest].length) shortest = i;
    }
    cleaned[shortest].push(id);
    seen.add(id);
  }
  return cleaned;
}

const sameLayout = (a: string[][], b: string[][]) =>
  a.length === b.length && a.every((col, i) => col.length === b[i].length && col.every((id, j) => id === b[i][j]));

/**
 * In-session arrangement, surviving component remounts. `Tabs` unmounts the
 * inactive panel, so leaving Overview and returning remounts this board — without
 * this it would re-initialise from the page-load `savedLayout` prop and drop any
 * change made since. Keyed by `layoutKey` (a per-user preference, the same across
 * every customer), so it stays consistent between records too.
 *
 * Only ever WRITTEN from browser event handlers, never during render, so the
 * server-side module copy stays empty — no cross-request leak, and the first
 * (hydrating) render always reads from `savedLayout`, matching the server.
 */
const layoutCache = new Map<string, string[][]>();

export function BentoBoard({
  layoutKey,
  cards,
  titles,
  fieldCards,
  defaultLayout,
  savedLayout,
}: BentoBoardProps) {
  const allIds = useMemo(() => Object.keys(cards), [cards]);
  const columnCount = defaultLayout.length;
  const fieldSet = useMemo(() => new Set(fieldCards), [fieldCards]);

  const [columns, setColumns] = useState<string[][]>(() =>
    reconcile(layoutCache.get(layoutKey) ?? savedLayout ?? defaultLayout, allIds, columnCount),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  // The arrangement as it was when the drag began — so onDragEnd can tell a real
  // move from a no-op and skip a needless save round-trip.
  const beforeDrag = useRef<string[][] | null>(null);

  const isCustomised = !sameLayout(columns, reconcile(defaultLayout, allIds, columnCount));

  const sensors = useSensors(
    // A small distance so a click on the handle doesn't register as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnOf = (id: string) => columns.findIndex((col) => col.includes(id));

  // Prefer pointer-within (finds the column under the cursor, including empty
  // ones), falling back to closest-corners against the cards.
  const collision: CollisionDetection = (args) => {
    const within = pointerWithin(args);
    return within.length ? within : closestCorners(args);
  };

  const persist = (next: string[][]) => {
    layoutCache.set(layoutKey, next);
    void saveUserLayout(layoutKey, next);
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    beforeDrag.current = columns.map((c) => [...c]);
  };

  const handleDragOver = (e: DragOverEvent) => {
    const activeCard = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;

    const from = columnOf(activeCard);
    // `over` is either another card or a column droppable (col-N).
    const to = overId.startsWith("col-")
      ? Number(overId.slice(4))
      : columnOf(overId);
    if (from === -1 || to === -1 || from === to) return;

    setColumns((prev) => {
      const next = prev.map((c) => [...c]);
      const fromIdx = next[from].indexOf(activeCard);
      if (fromIdx === -1) return prev;
      next[from].splice(fromIdx, 1);
      const overIdx = next[to].indexOf(overId);
      const insertAt = overIdx === -1 ? next[to].length : overIdx;
      next[to].splice(insertAt, 0, activeCard);
      return next;
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const activeCard = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setActiveId(null);

    let finalColumns = columns;
    if (overId && !overId.startsWith("col-")) {
      const col = columnOf(activeCard);
      const overCol = columnOf(overId);
      if (col !== -1 && col === overCol) {
        const from = columns[col].indexOf(activeCard);
        const to = columns[col].indexOf(overId);
        if (from !== -1 && to !== -1 && from !== to) {
          finalColumns = columns.map((c, i) => (i === col ? arrayMove(c, from, to) : c));
          setColumns(finalColumns);
        }
      }
    }

    const before = beforeDrag.current;
    beforeDrag.current = null;
    if (!before || !sameLayout(before, finalColumns)) persist(finalColumns);
  };

  const handleReset = () => {
    const base = reconcile(defaultLayout, allIds, columnCount);
    setColumns(base);
    layoutCache.set(layoutKey, base);
    void resetUserLayout(layoutKey);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {isCustomised && (
        <div className="flex shrink-0 justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] font-medium text-[#a1a1aa] transition-colors hover:text-[#3f3f46]"
          >
            Reset layout
          </button>
        </div>
      )}
      <DndContext
        // A STABLE id makes dnd-kit's accessibility ids deterministic across the
        // server and client renders. Without it, `aria-describedby` is generated
        // from a global counter that differs between SSR and hydration, which
        // React reports as a hydration mismatch.
        id={`bento-${layoutKey}`}
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          if (beforeDrag.current) setColumns(beforeDrag.current);
          beforeDrag.current = null;
          setActiveId(null);
        }}
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((ids, i) => (
            <BoardColumn key={i} index={i} ids={ids}>
              {ids.map((id) => (
                <SortableCard key={id} id={id} isField={fieldSet.has(id)} dragging={activeId === id}>
                  {cards[id]}
                </SortableCard>
              ))}
            </BoardColumn>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <Card className="!px-[15px] !py-[13px] cursor-grabbing shadow-[0_8px_24px_rgba(10,10,10,0.16)]">
              <div className="flex items-center gap-2">
                <Grip />
                <CardTitle>{titles[activeId] ?? activeId}</CardTitle>
              </div>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/** A droppable column — accepts drops even when empty (id `col-N`). */
function BoardColumn({
  index,
  ids,
  children,
}: {
  index: number;
  ids: string[];
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `col-${index}` });
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="flex min-h-0 flex-col gap-3">
        {children}
      </div>
    </SortableContext>
  );
}

function SortableCard({
  id,
  isField,
  dragging,
  children,
}: {
  id: string;
  isField: boolean;
  dragging: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/card relative",
        // Field cards keep every row; list cards may shrink so FitRows can trim.
        // The `[&>div]` rule targets the card (a <div>, unlike the handle <button>)
        // and fills the non-growing wrapper, so a shrunk list card hands its
        // FitRows the reduced height.
        isField
          ? "shrink-0"
          : "flex min-h-0 flex-col [&>div]:min-h-0 [&>div]:flex-1",
        dragging && "opacity-40",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to rearrange"
        className="absolute -top-2.5 left-1/2 z-20 flex h-5 w-7 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-md border border-[#e7e7ea] bg-white text-[#a1a1aa] opacity-0 shadow-sm transition-opacity hover:text-[#3f3f46] focus-visible:opacity-100 group-hover/card:opacity-100 active:cursor-grabbing"
      >
        <Grip />
      </button>
      {children}
    </div>
  );
}

function Grip() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <circle cx="3.5" cy="2.5" r="1" />
      <circle cx="8.5" cy="2.5" r="1" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="8.5" cy="6" r="1" />
      <circle cx="3.5" cy="9.5" r="1" />
      <circle cx="8.5" cy="9.5" r="1" />
    </svg>
  );
}
