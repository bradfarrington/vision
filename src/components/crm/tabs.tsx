"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { resetUserLayout, saveUserOrder } from "@/app/(app)/preferences/actions";

const SEP = "\u001F"; // unit separator — never appears in a tab label

// Lightweight tab strip for detail screens. Panels are server-rendered and
// passed in as content; this only toggles which one is visible. Underline +
// active weight match the lead-detail tab bar.
export type TabDef = {
  label: string;
  count?: number;
  content: React.ReactNode;
};

// Summary cards on the Overview tab link through to the tab that owns the data
// ("View all →"). Panels are server components rendered as `content`, so they
// can't reach the `active` state directly — this context hands them a
// `goTo("Notes")` for the small client button that does the switch.
type TabNav = { goTo: (label: string) => void };
const TabNavContext = createContext<TabNav | null>(null);

/** Switch the surrounding <Tabs> by label. Throws outside a Tabs — a mounting bug. */
export function useTabNav(): TabNav {
  const ctx = useContext(TabNavContext);
  if (!ctx) throw new Error("useTabNav must be used inside <Tabs>");
  return ctx;
}

/**
 * Reconcile a saved tab order against the tabs that actually exist: keep the
 * saved order for labels still present, drop labels that have gone, and append
 * any NEW tab (added since the user saved) at the end — so a release that adds a
 * tab never hides it from someone who saved an order before it existed.
 */
function orderTabs(labels: string[], saved: string[] | null): string[] {
  if (!saved) return labels;
  const known = new Set(labels);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const l of saved) {
    if (known.has(l) && !seen.has(l)) {
      result.push(l);
      seen.add(l);
    }
  }
  for (const l of labels) if (!seen.has(l)) result.push(l);
  return result;
}

export function Tabs({
  tabs,
  layoutKey,
  savedOrder,
}: {
  tabs: TabDef[];
  /** Enables per-user drag-to-reorder + persistence when set (e.g. 'customer_tabs'). */
  layoutKey?: string;
  /** The user's saved tab order, or null — ignored unless `layoutKey` is set. */
  savedOrder?: string[] | null;
}) {
  const authored = tabs.map((t) => t.label);
  // The order the tabs are DISPLAYED in. The authored order is the default; a
  // user's saved order (when reordering is enabled) overrides it.
  const [order, setOrder] = useState<string[]>(() =>
    layoutKey ? orderTabs(authored, savedOrder ?? null) : authored,
  );
  // Active tab tracked by LABEL, not index — reordering must not change which
  // tab is open, and jumps target a label.
  const [activeLabel, setActiveLabel] = useState<string>(() =>
    (layoutKey ? orderTabs(authored, savedOrder ?? null)[0] : authored[0]) ?? "",
  );

  const byLabel = useMemo(() => new Map(tabs.map((t) => [t.label, t])), [tabs]);
  const orderedTabs = order.map((l) => byLabel.get(l)).filter((t): t is TabDef => !!t);
  const active = byLabel.get(activeLabel) ?? orderedTabs[0];

  const labelKey = authored.join(SEP);
  const nav = useMemo<TabNav>(
    () => ({
      // Matched case-insensitively: a jump target is written out by hand at every
      // call site, so "Leads & contracts" vs "Leads & Contracts" would otherwise
      // be a silent no-op button rather than an error.
      goTo: (label: string) => {
        const want = label.toLowerCase();
        const match = labelKey.split(SEP).find((l) => l.toLowerCase() === want);
        if (match) setActiveLabel(match);
      },
    }),
    [labelKey],
  );

  const sensors = useSensors(
    // A small distance so a click on a tab switches to it; only a real drag
    // (past the threshold) starts a reorder.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const overId = e.over ? String(e.over.id) : null;
    const activeId = String(e.active.id);
    if (!overId || overId === activeId) return;
    const from = order.indexOf(activeId);
    const to = order.indexOf(overId);
    if (from === -1 || to === -1) return;
    const next = arrayMove(order, from, to);
    setOrder(next);
    if (layoutKey) void saveUserOrder(layoutKey, next);
  };

  const isCustomised = layoutKey != null && order.join(SEP) !== authored.join(SEP);
  const handleReset = () => {
    setOrder(authored);
    if (layoutKey) void resetUserLayout(layoutKey);
  };

  const strip = orderedTabs.map((t) =>
    layoutKey ? (
      <SortableTab
        key={t.label}
        label={t.label}
        count={t.count}
        active={t.label === active?.label}
        onSelect={() => setActiveLabel(t.label)}
      />
    ) : (
      <TabButton
        key={t.label}
        label={t.label}
        count={t.count}
        active={t.label === active?.label}
        onSelect={() => setActiveLabel(t.label)}
      />
    ),
  );

  return (
    <TabNavContext.Provider value={nav}>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* overflow-x-auto alone makes the strip scrollable in BOTH axes, and the
            active underline used to sit at -bottom-px — one pixel outside the
            box — so the bar could be dragged a pixel and snapped back. The
            underline now sits inside at bottom-0 and vertical overflow is
            clipped, leaving only the genuine horizontal scroll on narrow
            windows. */}
        <div className="flex items-end gap-0.5 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-[#e7e7ea]">
          {layoutKey ? (
            <DndContext
              // Stable id so dnd-kit's aria ids match between SSR and hydration.
              id={`tabs-${layoutKey}`}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={order} strategy={horizontalListSortingStrategy}>
                {strip}
              </SortableContext>
            </DndContext>
          ) : (
            strip
          )}
          {isCustomised && (
            <button
              type="button"
              onClick={handleReset}
              className="ml-auto shrink-0 whitespace-nowrap px-2 pb-[11px] pt-[9px] text-[11px] font-medium text-[#a1a1aa] transition-colors hover:text-[#3f3f46]"
            >
              Reset order
            </button>
          )}
        </div>
        {/* The bottom breathing room lives INSIDE the scroller, so a card that
            reaches the end of the panel still clears its edge by the same margin
            as the sides — padding on the page wrapper sits outside the scroll
            box and the last card would run flush into it. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-3 pb-2">
          {active?.content}
        </div>
      </div>
    </TabNavContext.Provider>
  );
}

// A tab is BOTH a switch (click) and — when reordering is on — a drag handle.
// There is no separate grip: a tab is a single word, so a whole-tab drag with a
// click threshold is the least cluttered affordance (the browser tab bar model).
const tabClass = (active: boolean) =>
  `relative whitespace-nowrap px-3.5 pb-[11px] pt-[9px] text-[13px] ${
    active ? "font-bold text-[#0a0a0a]" : "font-medium text-[#71717a] hover:text-[#3f3f46]"
  }`;

function TabInner({ label, count, active }: { label: string; count?: number; active: boolean }) {
  return (
    <>
      {label}
      {count != null && count > 0 && (
        <span className="ml-1 text-[11px] text-[#a1a1aa]">{count}</span>
      )}
      {active && (
        <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-sm bg-[var(--accent-blue)]" />
      )}
    </>
  );
}

function TabButton({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count?: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className={tabClass(active)}>
      <TabInner label={label} count={count} active={active} />
    </button>
  );
}

function SortableTab({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count?: number;
  active: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: label,
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      onClick={onSelect}
      {...attributes}
      {...listeners}
      className={`${tabClass(active)} touch-none ${
        isDragging ? "z-10 cursor-grabbing opacity-70" : ""
      }`}
    >
      <TabInner label={label} count={count} active={active} />
    </button>
  );
}

/**
 * The "View all →" affordance on an Overview summary card. Client-side by
 * necessity (it flips tab state); everything around it stays a server component.
 */
export function TabLink({
  to,
  children,
  className = "",
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { goTo } = useTabNav();
  return (
    <button
      type="button"
      onClick={() => goTo(to)}
      className={`text-[11.5px] font-semibold text-[var(--accent-blue)] hover:underline ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * A whole row/region that acts as a jump to another tab — used where the summary
 * item itself should be clickable (a note snippet, a document row).
 */
export function TabJump({
  to,
  children,
  className = "",
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { goTo } = useTabNav();
  return (
    <button type="button" onClick={() => goTo(to)} className={className}>
      {children}
    </button>
  );
}
