"use client";

import { createContext, useContext, useState } from "react";
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  Check,
  Grip,
  Popover,
  SectionLabel,
  shortDate,
  type ListColumn,
} from "@/components/crm/data-list";
import { resetUserLayout, saveUserPref } from "@/app/(app)/preferences/actions";
import { humanLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Which fields show on a KANBAN CARD — the board's answer to the list's column
// picker. It reuses the SAME field registry (a list's `ListColumn[]`): the card
// hints (`cardCell`/`cardHeader`/`cardBare`) live on those columns, so one
// registry drives both the table and the card. A card lays out differently from
// a row, so this is a separate, lighter machine from data-list's columns — no
// widths, no sort, just which fields and in what order, persisted per user.
//
// Built generic so contracts (the third list) gets a card picker for free: it
// supplies a CardFieldsSpec and nothing here changes. See AGENTS.md § board.
// ---------------------------------------------------------------------------

export type CardFieldsSpec<V> = {
  /** Stable per list — the DndContext id (SSR/hydration ids must not diverge). */
  name: string;
  /** `user_ui_layouts.layout_key` for this board's card layout. */
  layoutKey: string;
  /** The list's column registry, reused as the field catalogue. */
  fields: ListColumn<V>[];
  groupOrder: string[];
  defaultVisible: string[];
  /** The raw record behind a row, for fields rendered generically by `kind`. */
  record: (v: V) => Record<string, unknown>;
};

type AnySpec = CardFieldsSpec<never>;

type CardFieldsCtx = {
  name: string;
  fieldMap: Map<string, ListColumn<never>>;
  groupOrder: string[];
  record: (v: never) => Record<string, unknown>;
  visible: string[];
  hidden: string[];
  toggle: (key: string) => void;
  reorder: (from: number, to: number) => void;
  reset: () => void;
  isCustomised: boolean;
};

const CardFieldsContext = createContext<CardFieldsCtx | null>(null);

function useCardFields(): CardFieldsCtx {
  const ctx = useContext(CardFieldsContext);
  if (!ctx) throw new Error("useCardFields must be used inside a CardFieldsProvider");
  return ctx;
}

function reconcile(saved: string[] | null, allKeys: string[], defaultVisible: string[]): string[] {
  if (!saved) return defaultVisible;
  const known = new Set(allKeys);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of saved) {
    if (known.has(k) && !seen.has(k)) {
      out.push(k);
      seen.add(k);
    }
  }
  return out;
}

export function CardFieldsProvider<V>({
  spec,
  saved,
  children,
}: {
  spec: CardFieldsSpec<V>;
  saved: Record<string, unknown> | null;
  children: React.ReactNode;
}) {
  const anySpec = spec as unknown as AnySpec;
  const fieldMap = new Map(anySpec.fields.map((c) => [c.key, c]));
  const allKeys = anySpec.fields.map((c) => c.key);
  const { defaultVisible, layoutKey } = anySpec;

  const rawOrder = saved?.order;
  const savedOrder =
    Array.isArray(rawOrder) && rawOrder.every((x) => typeof x === "string")
      ? (rawOrder as string[])
      : null;

  const [visible, setVisible] = useState<string[]>(() =>
    reconcile(savedOrder, allKeys, defaultVisible),
  );
  const hidden = allKeys.filter((k) => !visible.includes(k));

  const save = (order: string[]) => void saveUserPref(layoutKey, { order });

  const toggle = (key: string) => {
    const next = visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key];
    setVisible(next);
    save(next);
  };
  const reorder = (from: number, to: number) => {
    const next = arrayMove(visible, from, to);
    setVisible(next);
    save(next);
  };
  const isCustomised = visible.join(",") !== defaultVisible.join(",");
  const reset = () => {
    setVisible(defaultVisible);
    void resetUserLayout(layoutKey);
  };

  return (
    <CardFieldsContext.Provider
      value={{
        name: anySpec.name,
        fieldMap,
        groupOrder: anySpec.groupOrder,
        record: anySpec.record,
        visible,
        hidden,
        toggle,
        reorder,
        reset,
        isCustomised,
      }}
    >
      {children}
    </CardFieldsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// The card body — renders the visible fields for one row. Returns a fragment so
// the board's card wrapper owns the padding/border/hover; this only lays out
// the fields inside it.
function renderValue(
  col: ListColumn<never>,
  row: never,
  record: (v: never) => Record<string, unknown>,
): React.ReactNode | null {
  if (col.cardCell) return col.cardCell(row);
  const raw = record(row)[col.field ?? col.key];
  if (raw == null || raw === "") return null; // empty → the caller drops the row
  if (col.kind === "bool") return raw ? "Yes" : "No";
  if (col.kind === "date") return shortDate(String(raw));
  if (col.kind === "label") return humanLabel(String(raw));
  return String(raw);
}

export function CardFieldsBody<V>({ row }: { row: V }) {
  const { visible, fieldMap, record } = useCardFields();
  const r = row as unknown as never;

  const rendered = visible
    .map((k) => fieldMap.get(k))
    .filter((c): c is ListColumn<never> => !!c)
    .map((col) => ({ col, node: renderValue(col, r, record) }))
    // A field with no value is dropped so the card stays compact — except the
    // header fields (ref/value), which always carry a value and anchor the card.
    .filter((x) => x.node !== null || x.col.cardHeader);

  const header = rendered.filter((x) => x.col.cardHeader);
  const body = rendered.filter((x) => !x.col.cardHeader);

  if (rendered.length === 0) {
    return <span className="text-[11px] text-[#a1a1aa]">No fields shown</span>;
  }

  return (
    <>
      {header.length > 0 && (
        <div className="flex items-center gap-2">
          {header.map(({ col, node }, i) => (
            <span key={col.key} className={i === 0 ? "min-w-0 truncate" : "ml-auto shrink-0"}>
              {node}
            </span>
          ))}
        </div>
      )}
      {body.map(({ col, node }) =>
        col.cardBare ? (
          <div key={col.key} className="min-w-0 truncate">
            {node}
          </div>
        ) : (
          <div key={col.key} className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="shrink-0 text-[#a1a1aa]">{col.label}</span>
            <span className="min-w-0 truncate text-right text-[#3f3f46]">{node}</span>
          </div>
        ),
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The "Cards" toolbar button — toggle + drag-reorder which fields show on a
// card. Mirrors data-list's ColumnsButton (search · Shown drag-list · Hidden by
// group · Reset), reusing the shared Popover/Check/Grip/SectionLabel.
export function CardFieldsButton() {
  const { name, fieldMap, groupOrder, visible, hidden, toggle, reorder, reset, isCustomised } =
    useCardFields();
  const [query, setQuery] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const overId = e.over ? String(e.over.id) : null;
    const activeId = String(e.active.id);
    if (!overId || overId === activeId) return;
    const from = visible.indexOf(activeId);
    const to = visible.indexOf(overId);
    if (from !== -1 && to !== -1) reorder(from, to);
  };

  const q = query.trim().toLowerCase();
  const matches = (k: string) => fieldMap.get(k)?.label.toLowerCase().includes(q);
  const hiddenByGroup = groupOrder
    .map((g) => ({
      group: g,
      keys: hidden.filter((k) => fieldMap.get(k)?.group === g && (!q || matches(k))),
    }))
    .filter((g) => g.keys.length > 0);

  return (
    <Popover label="Cards" icon="card" width={264}>
      {() => (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-[#f4f4f5] px-2.5 py-2">
            <span className="min-w-0 flex-1 text-[11px] text-[#a1a1aa]">
              Choose what shows on each card
            </span>
            {isCustomised && (
              <button
                type="button"
                onClick={reset}
                className="shrink-0 text-[11px] font-medium text-[#a1a1aa] transition-colors hover:text-[#3f3f46]"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 border-b border-[#f4f4f5] px-2.5 py-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fields…"
              className="w-full bg-transparent text-[13px] text-[#3f3f46] placeholder:text-[#a1a1aa] focus:outline-none"
            />
          </div>

          <div className="min-h-0 overflow-y-auto px-1.5 py-1.5">
            {!q && (
              <>
                <SectionLabel>Shown · drag to reorder</SectionLabel>
                <DndContext
                  id={`cards-${name}`}
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext items={visible} strategy={verticalListSortingStrategy}>
                    {visible.map((k) => (
                      <FieldRow key={k} col={fieldMap.get(k)} onToggle={() => toggle(k)} />
                    ))}
                  </SortableContext>
                </DndContext>
                {visible.length === 0 && (
                  <p className="px-2 py-1.5 text-[12px] text-[#a1a1aa]">Add a field below.</p>
                )}
              </>
            )}

            {q &&
              visible
                .filter((k) => matches(k))
                .map((k) => (
                  <StaticRow key={k} col={fieldMap.get(k)} checked onToggle={() => toggle(k)} />
                ))}

            {hiddenByGroup.map(({ group, keys }) => (
              <div key={group}>
                <SectionLabel>{group}</SectionLabel>
                {keys.map((k) => (
                  <StaticRow
                    key={k}
                    col={fieldMap.get(k)}
                    checked={false}
                    onToggle={() => toggle(k)}
                  />
                ))}
              </div>
            ))}
            {q && hiddenByGroup.length === 0 && visible.filter((k) => matches(k)).length === 0 && (
              <p className="px-2 py-2 text-[12px] text-[#a1a1aa]">No fields match “{query}”.</p>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}

function FieldRow({ col, onToggle }: { col: ListColumn<never> | undefined; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col?.key ?? "",
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  if (!col) return null;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1.5 rounded-md py-1 pl-1 pr-1.5 hover:bg-[#fafafa]",
        isDragging && "opacity-60",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab touch-none px-0.5 text-[#c4c4c8] hover:text-[#71717a] active:cursor-grabbing"
      >
        <Grip />
      </button>
      <span className="min-w-0 flex-1 truncate text-[13px] text-[#3f3f46]">{col.label}</span>
      <Check checked onClick={onToggle} label={`Hide ${col.label}`} />
    </div>
  );
}

function StaticRow({
  col,
  checked,
  onToggle,
}: {
  col: ListColumn<never> | undefined;
  checked: boolean;
  onToggle: () => void;
}) {
  if (!col) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 rounded-md py-1 pl-[26px] pr-1.5 text-left hover:bg-[#fafafa]"
    >
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          checked ? "text-[#3f3f46]" : "text-[#71717a]",
        )}
      >
        {col.label}
      </span>
      <Check checked={checked} label={checked ? `Hide ${col.label}` : `Show ${col.label}`} />
    </button>
  );
}
