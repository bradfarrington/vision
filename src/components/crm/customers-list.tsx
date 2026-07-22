"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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

import { Avatar, CountPill, Icon } from "@/components/crm/primitives";
import { Pagination, useSetParams } from "@/components/crm/list-controls";
import { useFloatingMenu } from "@/components/crm/floating-menu";
import { resetUserLayout, saveUserOrder } from "@/app/(app)/preferences/actions";
import { cn } from "@/lib/utils";
import type { ActivityLine, CustomerRow } from "@/lib/data/customers";

// The customer list, made COLUMN-CUSTOMISABLE and per-user persistent. The
// primary name column and the row controls (select box, chevron) are fixed; the
// middle columns are toggled on/off and reordered from the "Columns" button, and
// the arrangement saves to `user_ui_layouts` per user (see AGENTS.md
// § Rearrangeable cards). Filtering moved off inline pills into a "Filters"
// popover — both surfaces are here so they can share the toolbar row.

export type CustomerRowView = { c: CustomerRow; activity: ActivityLine };

// ---------------------------------------------------------------------------
// Column registry — the single source of truth for the configurable middle
// columns (the name column and row controls are fixed and not listed here).
type Column = {
  key: string;
  label: string;
  /** Grid track for this column, e.g. "minmax(110px,1.3fr)". */
  width: string;
  cell: (v: CustomerRowView) => React.ReactNode;
  cellClassName?: string;
};

const COLUMNS: Column[] = [
  {
    key: "address",
    label: "Installation address",
    width: "minmax(160px,2.1fr)",
    cell: (v) => (
      <span className="block min-w-0 pr-2">
        <span className="block truncate text-[#3f3f46]">{v.c.addressLine ?? "—"}</span>
        <span className="block truncate text-[11.5px] text-[#71717a]">
          {v.c.town ? `${v.c.town} · ` : ""}
          {v.c.postcode && <span className="font-mono">{v.c.postcode}</span>}
        </span>
      </span>
    ),
  },
  {
    key: "phone",
    label: "Phone",
    width: "minmax(110px,1.3fr)",
    cell: (v) => <span className="text-[#3f3f46]">{v.c.phone ?? "—"}</span>,
  },
  {
    key: "leads",
    label: "Leads",
    width: "minmax(70px,.9fr)",
    cell: (v) => <CountPill total={v.c.leadCount} live={v.c.liveLeadCount} />,
  },
  {
    key: "contracts",
    label: "Contracts",
    width: "minmax(80px,1fr)",
    cell: (v) => <CountPill total={v.c.contractCount} />,
  },
  {
    key: "activity",
    label: "Last activity",
    width: "minmax(140px,1.7fr)",
    cell: (v) => (
      <span className="block min-w-0 pr-2">
        <span className="block truncate font-medium text-[#3f3f46]">{v.activity.primary}</span>
        <span
          className={cn(
            "block truncate text-[11.5px]",
            v.activity.amber ? "font-semibold text-[#b86e00]" : "text-[#71717a]",
          )}
        >
          {v.activity.secondary}
        </span>
      </span>
    ),
  },
  {
    key: "type",
    label: "Type",
    width: "minmax(90px,1fr)",
    cell: (v) => <span className="text-[#3f3f46]">{titleCase(v.c.customerType) ?? "—"}</span>,
  },
  {
    key: "town",
    label: "Town",
    width: "minmax(90px,1fr)",
    cell: (v) => <span className="block truncate text-[#3f3f46]">{v.c.town ?? "—"}</span>,
  },
  {
    key: "postcode",
    label: "Postcode",
    width: "minmax(90px,.9fr)",
    cell: (v) => <span className="font-mono text-[#3f3f46]">{v.c.postcode ?? "—"}</span>,
  },
  {
    key: "created",
    label: "Added",
    width: "minmax(90px,1fr)",
    cell: (v) => <span className="text-[#3f3f46]">{shortDate(v.c.createdAt)}</span>,
  },
];

const COLUMN_MAP = new Map(COLUMNS.map((c) => [c.key, c]));
const ALL_KEYS = COLUMNS.map((c) => c.key);
const DEFAULT_VISIBLE = ["address", "phone", "leads", "contracts", "activity"];
const COLUMNS_KEY = "customers_columns";

/** Keep known keys in saved order; unknown/new keys are simply hidden. */
function reconcileColumns(saved: string[] | null): string[] {
  if (!saved) return DEFAULT_VISIBLE;
  const known = new Set(ALL_KEYS);
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

// ---------------------------------------------------------------------------
// Shared column state — the "Columns" button and the table both read it.
type ColumnsCtx = {
  visible: string[];
  hidden: string[];
  toggle: (key: string) => void;
  reorder: (from: number, to: number) => void;
  reset: () => void;
  isCustomised: boolean;
};
const ColumnsContext = createContext<ColumnsCtx | null>(null);

export function CustomerColumnsProvider({
  saved,
  children,
}: {
  saved: string[] | null;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState<string[]>(() => reconcileColumns(saved));
  const hidden = ALL_KEYS.filter((k) => !visible.includes(k));

  const persist = (next: string[]) => {
    setVisible(next);
    void saveUserOrder(COLUMNS_KEY, next);
  };
  const toggle = (key: string) =>
    persist(visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key]);
  const reorder = (from: number, to: number) => persist(arrayMove(visible, from, to));
  const isCustomised = visible.join(",") !== DEFAULT_VISIBLE.join(",");
  const reset = () => {
    setVisible(DEFAULT_VISIBLE);
    void resetUserLayout(COLUMNS_KEY);
  };

  return (
    <ColumnsContext.Provider value={{ visible, hidden, toggle, reorder, reset, isCustomised }}>
      {children}
    </ColumnsContext.Provider>
  );
}

function useColumns(): ColumnsCtx {
  const ctx = useContext(ColumnsContext);
  if (!ctx) throw new Error("useColumns must be used inside CustomerColumnsProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// A dismissible popover trigger + panel, positioned against the viewport so it
// escapes the toolbar/card clipping (the CRM popover standard, keeping tenant
// accent inheritance — unlike a portalled menu).
function Popover({
  label,
  icon,
  badge,
  children,
}: {
  label: string;
  icon: "columns" | "filters";
  badge?: number;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuStyle = useFloatingMenu({ open, triggerRef, width: 264, align: "end" });

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
        className={cn(
          "inline-flex items-center gap-[7px] rounded-lg border bg-white px-3 py-2 text-[13px] font-semibold transition-colors",
          open || badge
            ? "border-[var(--accent-blue)] text-[var(--accent-blue)]"
            : "border-[#e7e7ea] text-[#3f3f46] hover:bg-[#fafafa]",
        )}
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
  const { visible, hidden, toggle, reorder, reset, isCustomised } = useColumns();
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

  return (
    <Popover label="Columns" icon="columns">
      {() => (
        <div className="flex max-h-[min(60vh,420px)] flex-col">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
              Shown
            </span>
            {isCustomised && (
              <button
                type="button"
                onClick={reset}
                className="text-[11px] font-medium text-[#a1a1aa] transition-colors hover:text-[#3f3f46]"
              >
                Reset
              </button>
            )}
          </div>
          <div className="min-h-0 overflow-y-auto px-1.5 pb-1.5">
            <DndContext
              id="cols-customers"
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
              <p className="px-2 py-2 text-[12px] text-[#a1a1aa]">
                Only the name is shown. Add a column below.
              </p>
            )}
            {hidden.length > 0 && (
              <>
                <div className="px-2 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
                  Hidden
                </div>
                {hidden.map((k) => (
                  <HiddenRow key={k} colKey={k} onShow={() => toggle(k)} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}

function ColumnRow({ colKey, onToggle }: { colKey: string; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: colKey,
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  const col = COLUMN_MAP.get(colKey);
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

function HiddenRow({ colKey, onShow }: { colKey: string; onShow: () => void }) {
  const col = COLUMN_MAP.get(colKey);
  if (!col) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-md py-1 pl-1 pr-1.5 hover:bg-[#fafafa]">
      <span className="w-[19px] shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px] text-[#71717a]">{col.label}</span>
      <Check checked={false} onClick={onShow} label={`Show ${col.label}`} />
    </div>
  );
}

// ---------------------------------------------------------------------------
export function FiltersButton({ towns }: { towns: string[] }) {
  const { setParams, searchParams } = useSetParams();
  const town = searchParams.get("town");
  const live = searchParams.get("live") === "1";
  const activeCount = (town ? 1 : 0) + (live ? 1 : 0);

  return (
    <Popover label="Filters" icon="filters" badge={activeCount || undefined}>
      {() => (
        <div className="flex max-h-[min(70vh,460px)] w-[264px] flex-col">
          <div className="flex items-center justify-between border-b border-[#f4f4f5] px-3 py-2.5">
            <span className="text-[13px] font-bold text-[#0a0a0a]">Filters</span>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => setParams({ town: null, live: null })}
                className="text-[11.5px] font-medium text-[var(--accent-blue)] hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto px-3 py-2.5">
            <FilterRow
              label="Has live lead"
              checked={live}
              onClick={() => setParams({ live: live ? null : "1" })}
            />

            <div className="mt-2.5">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
                Town
              </div>
              <div className="max-h-[190px] overflow-y-auto">
                <RadioRow label="All towns" checked={!town} onClick={() => setParams({ town: null })} />
                {towns.map((t) => (
                  <RadioRow
                    key={t}
                    label={t}
                    checked={town === t}
                    onClick={() => setParams({ town: t })}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Popover>
  );
}

function FilterRow({
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
      className="flex w-full items-center gap-2 rounded-md py-1.5 text-left hover:bg-[#fafafa]"
    >
      <Check checked={checked} label={label} />
      <span className="text-[13px] text-[#3f3f46]">{label}</span>
    </button>
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
      className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-[#fafafa]"
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
export function CustomerTable({
  views,
  total,
  page,
  pageCount,
  from,
  to,
}: {
  views: CustomerRowView[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
}) {
  const { visible } = useColumns();
  const cols = visible.map((k) => COLUMN_MAP.get(k)).filter((c): c is Column => !!c);
  // Fixed edges: 44px select box · the name column (always shown) · 40px chevron.
  const grid = `44px minmax(180px,2.1fr) ${cols.map((c) => c.width).join(" ")} 40px`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e7e7ea]">
      <div
        className="grid items-center border-b border-[#e7e7ea] bg-[#fafafa] px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]"
        style={{ gridTemplateColumns: grid }}
      >
        <span>
          <span className="inline-block size-[15px] rounded-[4px] border-[1.5px] border-[#d4d4d8]" />
        </span>
        <span>Customer</span>
        {cols.map((c) => (
          <span key={c.key} className="truncate">
            {c.label}
          </span>
        ))}
        <span />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {views.length === 0 ? (
          <EmptyState />
        ) : (
          views.map((v) => <Row key={v.c.id} v={v} cols={cols} grid={grid} />)
        )}
      </div>

      <div className="flex items-center border-t border-[#e7e7ea] bg-[#fafafa] px-4 py-3 text-[12.5px] text-[#71717a]">
        <span>
          {total === 0
            ? "No customers"
            : `Showing ${from}–${to} of ${total.toLocaleString("en-GB")}`}
        </span>
        <Pagination page={page} pageCount={pageCount} />
      </div>
    </div>
  );
}

function Row({ v, cols, grid }: { v: CustomerRowView; cols: Column[]; grid: string }) {
  const { c } = v;
  return (
    <Link
      href={`/customers/${c.id}`}
      className="grid items-center border-b border-[#f4f4f5] px-4 py-[11px] text-[13px] transition-colors last:border-b-0 hover:bg-[#fafafa]"
      style={{ gridTemplateColumns: grid }}
    >
      <span>
        <span className="inline-block size-[15px] rounded-[4px] border-[1.5px] border-[#d4d4d8]" />
      </span>
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={c.displayName} size={32} />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-[#0a0a0a]">{c.displayName}</span>
          {c.email && (
            <span className="block truncate text-[11.5px] text-[#71717a]">{c.email}</span>
          )}
        </span>
      </span>
      {cols.map((col) => (
        <span key={col.key} className={cn("min-w-0", col.cellClassName)}>
          {col.cell(v)}
        </span>
      ))}
      <span className="text-center text-[#a1a1aa]">›</span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-sm font-semibold text-[#3f3f46]">No customers found</p>
      <p className="text-[12.5px] text-[#71717a]">Try a different search or clear your filters.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A checkbox. Standalone (its own button) when given `onClick`; a visual-only
// span when not — so it can sit inside a row that is itself the button, without
// nesting a <button> in a <button>.
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

function titleCase(v: string | null): string | null {
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function shortDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
