"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
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

import { Icon, TOOLBAR_H } from "@/components/crm/primitives";
import type { IconName } from "@/components/crm/icon";
import { useSetParams } from "@/components/crm/list-controls";
import { useFloatingMenu } from "@/components/crm/floating-menu";
import { resetUserLayout, saveUserPref } from "@/app/(app)/preferences/actions";
import { cn } from "@/lib/utils";
import { humanLabel } from "@/lib/format";

// ---------------------------------------------------------------------------
// The shared list machinery behind /customers and /leads (and whatever comes
// next). Everything entity-specific — which columns exist, how a cell renders,
// which filters apply, where a row links — lives in a `ListSpec` supplied by
// each list; everything here is generic: the columns popover with its
// drag-reorder, column resize + persistence, server-side sort, the filters
// popover, the advanced value-filter builder, and the infinite-scroll table.
//
// See AGENTS.md § Lists & columns for the decisions this encodes. Fix bugs
// HERE, not in a per-entity copy — forking this file is what makes the lists
// drift apart.
// ---------------------------------------------------------------------------

/** `label` = a raw DB enum, displayed via humanLabel (never snake_case in the UI). */
export type ColumnKind = "text" | "bool" | "number" | "date" | "label";

export type ListColumn<V> = {
  key: string;
  label: string;
  group: string;
  /** Default width in px (resizable per user). */
  w: number;
  field?: string; // record field to read; defaults to key
  kind?: ColumnKind; // how to format record[field] (ignored when `cell` is set)
  cell?: (v: V) => React.ReactNode; // composite/computed cells
  cellClassName?: string;
  /** DB column to ORDER BY; undefined = not sortable (computed/composite). */
  sortField?: string;
};

export type FilterDef = {
  key: string;
  label: string;
  group: string;
  kind: "select" | "bool";
  /**
   * How to DISPLAY an option value. Defaults to `humanLabel`, which un-snakes
   * raw DB enums. Supply this where a canonical label already exists (the lead
   * stage registry). The stored/queried value is always the raw one.
   */
  formatOption?: (value: string) => string;
};

export type ListSpec<V, F> = {
  /**
   * Stable per list. Names the saved layout row AND the DndContext id — the
   * latter must be stable or dnd-kit's SSR/hydration ids diverge.
   */
  name: string;
  /** `user_ui_layouts.layout_key` for this list's column layout. */
  layoutKey: string;
  columns: ListColumn<V>[];
  groupOrder: string[];
  defaultVisible: string[];
  /** Columns that are computed/composite and therefore can't be ORDER BY'd. */
  noSort: string[];
  filters: FilterDef[];
  filterGroups: string[];
  /** Mirrors the server's value-filter allowlist; labels come from `columns`. */
  valueFieldKeys: string[];
  /**
   * A non-column boolean filter that can't be a plain column predicate — the
   * customers list's lead-derived "Has live lead". Rendered under `Activity`.
   */
  extraBoolFilter?: { param: string; label: string };
  /** Plural noun for the empty state ("No leads found"). */
  noun: string;
  rowId: (v: V) => string;
  rowHref: (v: V) => string;
  /** The raw record behind a row, for columns rendered generically by `kind`. */
  record: (v: V) => Record<string, unknown>;
  /** Fetches a further chunk. The same allowlisted path as the first render. */
  loadRows: (filters: F, page: number) => Promise<{ views: V[]; hasMore: boolean }>;
};

const MIN_WIDTH = 72;

// ---------------------------------------------------------------------------
// Spec + column state, shared by the toolbar buttons and the table. The spec is
// held as `ListSpec<unknown, unknown>` internally: every cell/href callback is
// authored in the spec where the row type IS known, so the looseness stops at
// this boundary and never reaches a call site.
type AnySpec = ListSpec<never, never>;

type ListCtx = {
  spec: AnySpec;
  /** Current layout, so a saved view can capture it (see lib/views). */
  layout: { order: string[]; widths: Record<string, number> };
  columnMap: Map<string, ListColumn<never>>;
  allKeys: string[];
  visible: string[];
  hidden: string[];
  widths: Record<string, number>;
  toggle: (key: string) => void;
  reorder: (from: number, to: number) => void;
  setWidth: (key: string, px: number) => void; // live, no persist
  commitWidth: (key: string, px: number) => void; // persist
  reset: () => void;
  isCustomised: boolean;
};

const ListContext = createContext<ListCtx | null>(null);

function useList(): ListCtx {
  const ctx = useContext(ListContext);
  if (!ctx) throw new Error("useList must be used inside a DataListProvider");
  return ctx;
}

/**
 * The list's current column layout, for whoever needs to SAVE it — the view
 * switcher. Returns null outside a provider so a screen with no column picker
 * (a board-only list) can still host the switcher.
 */
export function useListLayout(): { order: string[]; widths: Record<string, number> } | null {
  return useContext(ListContext)?.layout ?? null;
}

/** Resolve each column's sortField once: real DB columns sort by their own field. */
function prepare(spec: AnySpec): Map<string, ListColumn<never>> {
  const noSort = new Set(spec.noSort);
  for (const c of spec.columns) {
    if (c.sortField === undefined && !noSort.has(c.key)) c.sortField = c.field ?? c.key;
  }
  return new Map(spec.columns.map((c) => [c.key, c]));
}

export function DataListProvider<V, F>({
  spec,
  saved,
  persist = true,
  children,
}: {
  spec: ListSpec<V, F>;
  saved: Record<string, unknown> | null;
  /**
   * Whether a column change writes straight to the user's own preference.
   *
   * FALSE while a saved view is loaded: the columns then belong to the VIEW,
   * so a change is held in state and marks the view dirty until you Save —
   * otherwise fiddling with a column on someone's shared view would silently
   * rewrite your personal default instead.
   */
  persist?: boolean;
  children: React.ReactNode;
}) {
  const anySpec = spec as unknown as AnySpec;
  const columnMap = prepare(anySpec);
  const allKeys = anySpec.columns.map((c) => c.key);
  const { defaultVisible, layoutKey } = anySpec;

  const init = sanitiseSaved(saved, columnMap);
  const [visible, setVisible] = useState<string[]>(() =>
    reconcileColumns(init.order, allKeys, defaultVisible),
  );
  const [widths, setWidths] = useState<Record<string, number>>(() => init.widths);
  const hidden = allKeys.filter((k) => !visible.includes(k));

  const save = (order: string[], w: Record<string, number>) => {
    if (persist) void saveUserPref(layoutKey, { order, widths: w });
  };

  // These read `visible`/`widths` from the render closure. That's safe: toggle
  // and reorder run on discrete clicks (closure is current), and commitWidth
  // merges the final px explicitly — during a drag only that one column changes,
  // so even a mid-drag stale closure produces the correct saved object.
  const toggle = (key: string) => {
    const next = visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key];
    setVisible(next);
    save(next, widths);
  };
  const reorder = (from: number, to: number) => {
    const next = arrayMove(visible, from, to);
    setVisible(next);
    save(next, widths);
  };
  const setWidth = (key: string, px: number) => setWidths((w) => ({ ...w, [key]: px }));
  const commitWidth = (key: string, px: number) => {
    const next = { ...widths, [key]: px };
    setWidths(next);
    save(visible, next);
  };
  const isCustomised =
    visible.join(",") !== defaultVisible.join(",") || Object.keys(widths).length > 0;
  const reset = () => {
    setVisible(defaultVisible);
    setWidths({});
    if (persist) void resetUserLayout(layoutKey);
  };

  return (
    <ListContext.Provider
      value={{
        spec: anySpec,
        layout: { order: visible, widths },
        columnMap,
        allKeys,
        visible,
        hidden,
        widths,
        toggle,
        reorder,
        setWidth,
        commitWidth,
        reset,
        isCustomised,
      }}
    >
      {children}
    </ListContext.Provider>
  );
}

function reconcileColumns(
  saved: string[] | null,
  allKeys: string[],
  defaultVisible: string[],
): string[] {
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

function sanitiseSaved(
  saved: Record<string, unknown> | null,
  columnMap: Map<string, unknown>,
): { order: string[] | null; widths: Record<string, number> } {
  const rawOrder = saved?.order;
  const order =
    Array.isArray(rawOrder) && rawOrder.every((x) => typeof x === "string")
      ? (rawOrder as string[])
      : null;
  const widths: Record<string, number> = {};
  const rawW = saved?.widths;
  if (rawW && typeof rawW === "object") {
    for (const [k, v] of Object.entries(rawW as Record<string, unknown>)) {
      if (typeof v === "number" && v >= MIN_WIDTH && columnMap.has(k)) widths[k] = v;
    }
  }
  return { order, widths };
}

const widthOf = (widths: Record<string, number>, col: ListColumn<never>) =>
  widths[col.key] ?? col.w;

function renderCell(
  v: never,
  col: ListColumn<never>,
  record: (v: never) => Record<string, unknown>,
): React.ReactNode {
  if (col.cell) return col.cell(v);
  const val = record(v)[col.field ?? col.key];
  if (val == null || val === "") return <span className="text-[#a1a1aa]">—</span>;
  if (col.kind === "bool") return val ? "Yes" : "No";
  if (col.kind === "date") return shortDate(String(val));
  if (col.kind === "label") return humanLabel(String(val));
  return String(val);
}

// ---------------------------------------------------------------------------
// Dismissible popover — positioned against the viewport (the CRM standard, so it
// escapes toolbar clipping AND keeps tenant-accent inheritance, unlike a portal).
// Exported so every list-toolbar button (Columns, Filters, Date range) is the
// same button; don't hand-roll another one.
export function Popover({
  label,
  icon,
  badge,
  active,
  width = 272,
  children,
}: {
  label: string;
  icon: IconName;
  /** Numeric badge — also lights the trigger as active. */
  badge?: number;
  /** Light the trigger as active without a badge (e.g. a named selection). */
  active?: boolean;
  width?: number;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuStyle = useFloatingMenu({ open, triggerRef, width, align: "end", maxHeight: 460 });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ display: "contents" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        // THREE distinct states, because "this popover is open" and "this
        // control is narrowing your data" are different facts and used to look
        // identical — so a filter left on read as nothing once the popover
        // closed. APPLIED is filled with the accent tint and keeps its count
        // badge, so it stays obvious from across the screen; OPEN is only
        // outlined; idle is neutral.
        className={cn(
          TOOLBAR_H,
          "inline-flex items-center gap-[7px] rounded-lg border px-3 text-[13px] font-semibold transition-colors",
          badge || active
            ? "border-[var(--accent-blue)] bg-[var(--accent-tint)] text-[var(--accent-blue)]"
            : open
              ? "border-[var(--accent-blue)] bg-white text-[var(--accent-blue)]"
              : "border-[#e7e7ea] bg-white text-[#3f3f46] hover:bg-[#fafafa]",
        )}
        aria-label={badge ? `${label} — ${badge} applied` : label}
      >
        <Icon name={icon} size={13} /> {label}
        {badge ? (
          <span className="flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[var(--accent-blue)] px-1 text-[10.5px] font-bold text-white">
            {badge}
          </span>
        ) : null}
      </button>
      {open && menuStyle && (
        <div
          style={menuStyle}
          className="z-50 flex flex-col overflow-hidden rounded-xl border border-[#e7e7ea] bg-white shadow-[0_8px_28px_rgba(10,10,10,0.14)]"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function ColumnsButton() {
  const { spec, columnMap, visible, hidden, toggle, reorder, reset, isCustomised } = useList();
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
  const matches = (k: string) => columnMap.get(k)?.label.toLowerCase().includes(q);
  const hiddenByGroup = spec.groupOrder
    .map((g) => ({
      group: g,
      keys: hidden.filter((k) => columnMap.get(k)?.group === g && (!q || matches(k))),
    }))
    .filter((g) => g.keys.length > 0);

  return (
    <Popover label="Columns" icon="columns" width={264}>
      {() => (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-[#f4f4f5] px-2.5 py-2">
            <Icon name="search" size={13} className="text-[#a1a1aa]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fields…"
              className="w-full bg-transparent text-[13px] text-[#3f3f46] placeholder:text-[#a1a1aa] focus:outline-none"
            />
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

          <div className="min-h-0 overflow-y-auto px-1.5 py-1.5">
            {!q && (
              <>
                <SectionLabel>Shown · drag to reorder</SectionLabel>
                <DndContext
                  id={`cols-${spec.name}`}
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext items={visible} strategy={verticalListSortingStrategy}>
                    {visible.map((k) => (
                      <ColumnRow key={k} colKey={k} onToggle={() => toggle(k)} />
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
                .map((k) => <StaticRow key={k} colKey={k} checked onToggle={() => toggle(k)} />)}

            {hiddenByGroup.map(({ group, keys }) => (
              <div key={group}>
                <SectionLabel>{group}</SectionLabel>
                {keys.map((k) => (
                  <StaticRow key={k} colKey={k} checked={false} onToggle={() => toggle(k)} />
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
      {children}
    </div>
  );
}

function ColumnRow({ colKey, onToggle }: { colKey: string; onToggle: () => void }) {
  const { columnMap } = useList();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: colKey,
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  const col = columnMap.get(colKey);
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
  colKey,
  checked,
  onToggle,
}: {
  colKey: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const { columnMap } = useList();
  const col = columnMap.get(colKey);
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

// ---------------------------------------------------------------------------
// Filters — data-driven over the entity's fields; all URL-param-driven
// (`f_<key>`), plus the spec's one extra derived flag.
const OPERATORS: { op: string; label: string; needsValue: boolean }[] = [
  { op: "contains", label: "Contains", needsValue: true },
  { op: "equals", label: "Equals", needsValue: true },
  { op: "begins", label: "Begins with", needsValue: true },
  { op: "ends", label: "Ends with", needsValue: true },
  { op: "empty", label: "Is empty", needsValue: false },
  { op: "notempty", label: "Has a value", needsValue: false },
];
const opLabel = (op: string) => OPERATORS.find((o) => o.op === op)?.label ?? op;
const opNeedsValue = (op: string) => OPERATORS.find((o) => o.op === op)?.needsValue ?? true;

type ValueCond = { f: string; op: string; v: string };

function parseConditions(raw: string | null): ValueCond[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is ValueCond =>
        c && typeof c.f === "string" && typeof c.op === "string" && typeof c.v === "string",
    );
  } catch {
    return [];
  }
}

export function FiltersButton({ filterOptions }: { filterOptions: Record<string, string[]> }) {
  const { spec, columnMap } = useList();
  const { setParams, searchParams } = useSetParams();
  const extra = spec.extraBoolFilter;
  const extraOn = !!extra && searchParams.get(extra.param) === "1";
  const conditions = parseConditions(searchParams.get("fq"));
  const [openKey, setOpenKey] = useState<string | null>(null);

  const fieldLabel = (k: string) => columnMap.get(k)?.label ?? k;
  const valueFields = spec.valueFieldKeys
    .map((k) => ({ key: k, label: fieldLabel(k) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const activeCount =
    (extraOn ? 1 : 0) +
    conditions.length +
    spec.filters.filter((f) => (searchParams.get(`f_${f.key}`) ?? "") !== "").length;

  const clearAll = () => {
    const updates: Record<string, null> = { fq: null };
    if (extra) updates[extra.param] = null;
    for (const f of spec.filters) updates[`f_${f.key}`] = null;
    setParams(updates);
  };

  return (
    <Popover label="Filters" icon="filters" badge={activeCount || undefined} width={316}>
      {() => (
        <div className="flex min-h-0 w-[316px] flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[#f4f4f5] px-3 py-2.5">
            <span className="text-[13px] font-bold text-[#0a0a0a]">Filters</span>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[11.5px] font-medium text-[var(--accent-blue)] hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto px-2.5 py-1.5">
            <ValueFilterBuilder
              fields={valueFields}
              fieldLabel={fieldLabel}
              conditions={conditions}
              onChange={(next) => setParams({ fq: next.length ? JSON.stringify(next) : null })}
            />
            <div className="my-1.5 border-t border-[#f4f4f5]" />
            <SectionLabel>Quick filters</SectionLabel>
            {spec.filterGroups.map((group) => {
              const inGroup = spec.filters.filter((f) => f.group === group);
              const showExtra = !!extra && group === "Activity";
              if (inGroup.length === 0 && !showExtra) return null;
              return (
                <div key={group} className="pb-1">
                  <SectionLabel>{group}</SectionLabel>
                  {showExtra && extra && (
                    <BoolFilter
                      label={extra.label}
                      value={extraOn ? "1" : ""}
                      onChange={(v) => setParams({ [extra.param]: v === "1" ? "1" : null })}
                      yesNo={false}
                    />
                  )}
                  {inGroup.map((f) =>
                    f.kind === "bool" ? (
                      <BoolFilter
                        key={f.key}
                        label={f.label}
                        value={searchParams.get(`f_${f.key}`) ?? ""}
                        onChange={(v) => setParams({ [`f_${f.key}`]: v || null })}
                      />
                    ) : (
                      <SelectFilter
                        key={f.key}
                        label={f.label}
                        value={searchParams.get(`f_${f.key}`)}
                        format={f.formatOption ?? humanLabel}
                        options={filterOptions[f.key] ?? []}
                        open={openKey === f.key}
                        onOpen={() => setOpenKey(openKey === f.key ? null : f.key)}
                        onChange={(v) => setParams({ [`f_${f.key}`]: v })}
                      />
                    ),
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Popover>
  );
}

function ValueFilterBuilder({
  fields,
  fieldLabel,
  conditions,
  onChange,
}: {
  fields: { key: string; label: string }[];
  fieldLabel: (k: string) => string;
  conditions: ValueCond[];
  onChange: (c: ValueCond[]) => void;
}) {
  const [field, setField] = useState(fields[0]?.key ?? "");
  const [op, setOp] = useState("contains");
  const [value, setValue] = useState("");
  const [open, setOpen] = useState<null | "field" | "op">(null);
  const [fieldQuery, setFieldQuery] = useState("");

  const needsValue = opNeedsValue(op);
  const canAdd = !!field && (!needsValue || value.trim().length > 0);

  const add = () => {
    if (!canAdd) return;
    onChange([...conditions, { f: field, op, v: needsValue ? value.trim() : "" }]);
    setValue("");
    setOpen(null);
  };
  const removeAt = (i: number) => onChange(conditions.filter((_, idx) => idx !== i));

  const fq = fieldQuery.trim().toLowerCase();
  const fieldMatches = fields.filter((f) => !fq || f.label.toLowerCase().includes(fq));

  return (
    <div className="pt-1">
      <SectionLabel>Advanced · match a field</SectionLabel>

      {conditions.length > 0 && (
        <div className="mb-2 flex flex-col gap-1">
          {conditions.map((c, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-md bg-[var(--accent-tint)] px-2 py-1"
            >
              <span className="min-w-0 flex-1 truncate text-[12px] text-[#3f3f46]">
                <span className="font-semibold">{fieldLabel(c.f)}</span> {opLabel(c.op).toLowerCase()}
                {opNeedsValue(c.op) && <span className="text-[#0a0a0a]"> “{c.v}”</span>}
              </span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Remove condition"
                className="shrink-0 text-[13px] leading-none text-[#a1a1aa] hover:text-[#d64545]"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5 px-1">
        <InlinePicker
          label={fieldLabel(field)}
          open={open === "field"}
          onToggle={() => setOpen(open === "field" ? null : "field")}
        >
          <div className="border-b border-[#f4f4f5] px-2 py-1.5">
            <input
              autoFocus
              value={fieldQuery}
              onChange={(e) => setFieldQuery(e.target.value)}
              placeholder="Search fields…"
              className="w-full bg-transparent text-[13px] text-[#3f3f46] placeholder:text-[#a1a1aa] focus:outline-none"
            />
          </div>
          {fieldMatches.map((f) => (
            <PickerRow
              key={f.key}
              label={f.label}
              active={f.key === field}
              onClick={() => {
                setField(f.key);
                setOpen(null);
                setFieldQuery("");
              }}
            />
          ))}
          {fieldMatches.length === 0 && (
            <p className="px-2 py-1.5 text-[12px] text-[#a1a1aa]">No fields.</p>
          )}
        </InlinePicker>

        <div className="flex gap-1.5">
          <InlinePicker
            label={opLabel(op)}
            open={open === "op"}
            onToggle={() => setOpen(open === "op" ? null : "op")}
            className="w-[132px] shrink-0"
          >
            {OPERATORS.map((o) => (
              <PickerRow
                key={o.op}
                label={o.label}
                active={o.op === op}
                onClick={() => {
                  setOp(o.op);
                  setOpen(null);
                }}
              />
            ))}
          </InlinePicker>
          {needsValue && (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="Value"
              className="min-w-0 flex-1 rounded-md border border-[#e7e7ea] px-2 py-1.5 text-[13px] text-[#3f3f46] focus:border-[var(--accent-blue)] focus:outline-none"
            />
          )}
        </div>

        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className={cn(
            "flex items-center justify-center gap-1 rounded-md border py-1.5 text-[12.5px] font-semibold transition-colors",
            canAdd
              ? "border-[var(--accent-blue)] text-[var(--accent-blue)] hover:bg-[var(--accent-tint)]"
              : "cursor-not-allowed border-[#e7e7ea] text-[#a1a1aa]",
          )}
        >
          + Add condition
        </button>
      </div>
    </div>
  );
}

function InlinePicker({
  label,
  open,
  onToggle,
  className,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-1 rounded-md border border-[#e7e7ea] bg-white px-2 py-1.5 text-[13px] text-[#3f3f46] hover:bg-[#fafafa]"
      >
        <span className="min-w-0 truncate">{label}</span>
        <Icon
          name="chevron-down"
          size={11}
          className={cn("shrink-0 text-[#a1a1aa] transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        // Absolute so it OVERLAYS rather than growing the picker's box — an
        // inline dropdown pushed the sibling Value input taller. The builder sits
        // at the top of the popover, so opening downward isn't clipped.
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-[220px] overflow-y-auto rounded-md border border-[#e7e7ea] bg-white py-1 shadow-[0_8px_20px_rgba(10,10,10,0.14)]">
          {children}
        </div>
      )}
    </div>
  );
}

function PickerRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1 px-2 py-1.5 text-left text-[13px] hover:bg-[#fafafa]",
        active ? "font-medium text-[var(--accent-blue)]" : "text-[#3f3f46]",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active && <span className="text-[var(--accent-blue)]">✓</span>}
    </button>
  );
}

function BoolFilter({
  label,
  value,
  onChange,
  yesNo = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  yesNo?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1 pl-2 pr-1">
      <span className="min-w-0 flex-1 truncate text-[13px] text-[#3f3f46]">{label}</span>
      {yesNo ? (
        <div className="flex shrink-0 overflow-hidden rounded-md border border-[#e7e7ea]">
          {[
            { v: "", t: "Any" },
            { v: "1", t: "Yes" },
            { v: "0", t: "No" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              className={cn(
                "px-2 py-1 text-[11.5px] font-medium transition-colors",
                value === o.v
                  ? "bg-[var(--accent-blue)] text-white"
                  : "bg-white text-[#71717a] hover:bg-[#fafafa]",
              )}
            >
              {o.t}
            </button>
          ))}
        </div>
      ) : (
        <Check checked={value === "1"} onClick={() => onChange(value === "1" ? "" : "1")} label={label} />
      )}
    </div>
  );
}

function SelectFilter({
  label,
  value,
  options,
  format,
  open,
  onOpen,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  /** Display only — the value written to the URL and queried stays raw. */
  format: (v: string) => string;
  open: boolean;
  onOpen: () => void;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-2 rounded-md py-1 pl-2 pr-1 text-left hover:bg-[#fafafa]"
      >
        <span className="min-w-0 flex-1 truncate text-[13px] text-[#3f3f46]">{label}</span>
        <span
          className={cn(
            "max-w-[120px] shrink-0 truncate text-[12px]",
            value ? "font-medium text-[var(--accent-blue)]" : "text-[#a1a1aa]",
          )}
        >
          {value ? format(value) : "Any"}
        </span>
        <Icon
          name="chevron-down"
          size={11}
          className={cn("shrink-0 text-[#a1a1aa] transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="mb-1 ml-2 max-h-[180px] overflow-y-auto rounded-md border border-[#f4f4f5] py-1">
          <RadioRow label="Any" checked={!value} onClick={() => onChange(null)} />
          {options.length === 0 && (
            <p className="px-2 py-1 text-[12px] text-[#a1a1aa]">No values yet.</p>
          )}
          {options.map((o) => (
            <RadioRow key={o} label={format(o)} checked={value === o} onClick={() => onChange(o)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RadioRow({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-[#fafafa]"
    >
      <span
        className={cn(
          "flex size-[15px] shrink-0 items-center justify-center rounded-full border",
          checked ? "border-[var(--accent-blue)]" : "border-[#d4d4d8]",
        )}
      >
        {checked && <span className="size-[7px] rounded-full bg-[var(--accent-blue)]" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-[#3f3f46]">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
export function DataTable<V, F>({
  initialViews,
  total,
  filters,
  sort,
  dir,
}: {
  initialViews: V[];
  total: number;
  /** The resolved query, so the table can fetch further chunks itself. */
  filters: F;
  sort: string | null;
  dir: "asc" | "desc";
}) {
  const { spec, columnMap, visible, widths } = useList();
  const cols = visible
    .map((k) => columnMap.get(k))
    .filter((c): c is ListColumn<never> => !!c);
  // Fixed edges: 44px select box · resizable data columns · flexible spacer (so
  // rows fill the width and borders span) · 40px chevron.
  const grid = `44px ${cols.map((c) => `${widthOf(widths, c)}px`).join(" ")} minmax(16px,1fr) 40px`;

  // Continuous scroll: the first chunk is server-rendered; more are appended as
  // the sentinel scrolls into view. A changed query re-mounts this component
  // (keyed on the query in the page), so state always starts from a fresh chunk.
  const [rows, setRows] = useState<V[]>(initialViews);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialViews.length < total);
  const [loading, startLoading] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Latest values for the observer callback without re-subscribing each render.
  // Synced in an effect (not during render) — the observer only reads it from a
  // callback that fires after paint, so post-render is soon enough.
  const stateRef = useRef({ page, hasMore, loading });
  useEffect(() => {
    stateRef.current = { page, hasMore, loading };
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;

    function loadMore() {
      const { page: cur, hasMore: more, loading: busy } = stateRef.current;
      if (!more || busy) return;
      const next = cur + 1;
      startLoading(async () => {
        const load = spec.loadRows as unknown as (
          f: F,
          p: number,
        ) => Promise<{ views: V[]; hasMore: boolean }>;
        const res = await load(filters, next);
        // De-dupe on id in case a row shifted across the chunk boundary.
        const idOf = spec.rowId as unknown as (v: V) => string;
        setRows((prev) => {
          const seen = new Set(prev.map(idOf));
          return [...prev, ...res.views.filter((r) => !seen.has(idOf(r)))];
        });
        setPage(next);
        setHasMore(res.hasMore);
      });
    }

    // `rootMargin` starts the next fetch a little before the sentinel is reached,
    // so scrolling feels seamless. It also fires on mount if the first chunk
    // doesn't fill the container, loading until it does (or nothing remains).
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root, rootMargin: "400px 0px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
    // filters is stable per mount (the page re-mounts on query change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idOf = spec.rowId as unknown as (v: V) => string;
  const hrefOf = spec.rowHref as unknown as (v: V) => string;

  return (
    // Edge to edge: the table meets the panel's left, right and bottom edges, so
    // the ONLY border it needs is the top one separating it from the toolbar.
    // Rounding here would cut notches out of the header row and the last row.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[#e7e7ea]">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <div style={{ minWidth: "min-content" }}>
          <div
            className="sticky top-0 z-10 grid items-stretch border-b border-[#e7e7ea] bg-[#fafafa] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#a1a1aa]"
            style={{ gridTemplateColumns: grid }}
          >
            <span className="flex items-center justify-center py-2.5">
              <span className="inline-block size-[15px] rounded-[4px] border-[1.5px] border-[#d4d4d8]" />
            </span>
            {cols.map((c) => (
              <HeaderCell key={c.key} col={c} sort={sort} dir={dir} />
            ))}
            <span />
            <span />
          </div>

          {rows.length === 0 ? (
            <EmptyState noun={spec.noun} />
          ) : (
            rows.map((v) => (
              <Row key={idOf(v)} v={v} href={hrefOf(v)} cols={cols} grid={grid} />
            ))
          )}

          {/* Load-more sentinel; the observer starts the next fetch as it nears. */}
          <div ref={sentinelRef} />
          {loading && (
            <div className="py-4 text-center text-[12px] text-[#a1a1aa]">Loading more…</div>
          )}
        </div>
      </div>

      {/* NO footer bar. It only restated the count already in the page header's
          pill, and cost ~45px of every screen to do it. The scroll list is the
          whole card now. "Loading more…" above is the only progress signal the
          continuous scroll needs. */}
    </div>
  );
}

function HeaderCell({
  col,
  sort,
  dir,
}: {
  col: ListColumn<never>;
  sort: string | null;
  dir: "asc" | "desc";
}) {
  const { widths, setWidth, commitWidth } = useList();
  const { setParams } = useSetParams();
  const sortable = !!col.sortField;
  const active = sortable && col.sortField === sort;

  const onSort = () => {
    if (!col.sortField) return;
    const nextDesc = active && dir === "asc";
    setParams({ sort: col.sortField, dir: nextDesc ? "desc" : null });
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widths[col.key] ?? col.w;
    const width = (ev: PointerEvent) => Math.max(MIN_WIDTH, Math.round(startW + (ev.clientX - startX)));
    const move = (ev: PointerEvent) => setWidth(col.key, width(ev));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      commitWidth(col.key, width(ev));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="group/hcell relative flex items-center">
      <button
        type="button"
        onClick={onSort}
        disabled={!sortable}
        className={cn(
          // `uppercase` must sit on the button: Tailwind preflight resets
          // `button { text-transform: none }`, overriding the header row's class.
          "flex min-w-0 flex-1 items-center gap-1 px-3 py-2.5 text-left uppercase",
          sortable ? "hover:text-[#52525b]" : "cursor-default",
        )}
      >
        <span className="truncate">{col.label}</span>
        {active && <span className="text-[var(--accent-blue)]">{dir === "desc" ? "▼" : "▲"}</span>}
      </button>
      {/* Resize handle — grabs the right edge; stops the click reaching sort. */}
      <span
        onPointerDown={startResize}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 z-10 flex h-full w-[9px] cursor-col-resize items-center justify-center"
      >
        <span className="h-[55%] w-px bg-[#e7e7ea] transition-colors group-hover/hcell:bg-[#c4c4c8]" />
      </span>
    </div>
  );
}

function Row<V>({
  v,
  href,
  cols,
  grid,
}: {
  v: V;
  href: string;
  cols: ListColumn<never>[];
  grid: string;
}) {
  const { spec } = useList();
  const record = spec.record as unknown as (v: never) => Record<string, unknown>;
  const row = v as unknown as never;
  return (
    <Link
      href={href}
      // Hover is a heavily-transparent wash of the tenant accent (via color-mix
      // on --accent-blue) rather than a flat grey, so it picks up each tenant's
      // brand colour. Kept very light so dense rows don't read as "selected".
      className="grid items-center border-b border-[#f4f4f5] px-0 py-[11px] text-[13px] transition-colors last:border-b-0 hover:bg-[color-mix(in_srgb,var(--accent-blue)_8%,transparent)]"
      style={{ gridTemplateColumns: grid }}
    >
      <span className="flex items-center justify-center">
        <span className="inline-block size-[15px] rounded-[4px] border-[1.5px] border-[#d4d4d8]" />
      </span>
      {cols.map((col) =>
        col.cell ? (
          <span key={col.key} className={cn("min-w-0 px-3", col.cellClassName)}>
            {renderCell(row, col, record)}
          </span>
        ) : (
          <span
            key={col.key}
            className={cn("min-w-0 truncate px-3 text-[#3f3f46]", col.cellClassName)}
          >
            {renderCell(row, col, record)}
          </span>
        ),
      )}
      <span />
      <span className="text-center text-[#a1a1aa]">›</span>
    </Link>
  );
}

function EmptyState({ noun }: { noun: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-sm font-semibold text-[#3f3f46]">No {noun} found</p>
      <p className="text-[12.5px] text-[#71717a]">Try a different search or clear your filters.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Check({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick?: () => void;
  label: string;
}) {
  const className = cn(
    "flex size-[16px] shrink-0 items-center justify-center rounded-[4px] border transition-colors",
    checked
      ? "border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white"
      : "border-[#d4d4d8] bg-white",
    onClick && !checked && "hover:border-[#a1a1aa]",
  );
  const glyph = checked ? <Icon name="check" size={11} strokeWidth={3} /> : null;
  if (!onClick) {
    return (
      <span className={className} aria-hidden>
        {glyph}
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={checked} className={className}>
      {glyph}
    </button>
  );
}

function Grip() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <circle cx="3" cy="3" r="1" />
      <circle cx="7" cy="3" r="1" />
      <circle cx="3" cy="7" r="1" />
      <circle cx="7" cy="7" r="1" />
      <circle cx="3" cy="11" r="1" />
      <circle cx="7" cy="11" r="1" />
    </svg>
  );
}

/** Shared cell formatter — used by specs and by the generic `kind` path. */
export function shortDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
