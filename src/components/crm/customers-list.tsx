"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
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
import { resetUserLayout, saveUserPref } from "@/app/(app)/preferences/actions";
import { cn } from "@/lib/utils";
import type { ActivityLine, CustomerRow } from "@/lib/data/customers";

// The customer list: every field is a column that can be shown, reordered,
// RESIZED and SORTED — all per user. Columns (which, order, widths) save to
// `user_ui_layouts` (see AGENTS.md § Lists & columns); sort lives in the URL so
// the server orders across all pages and the state is shareable. There is no
// hardcoded name column any more — "Name" is just the first default column.

export type CustomerRowView = { c: CustomerRow; activity: ActivityLine };

// ---------------------------------------------------------------------------
// Column registry — one entry per showable field. Only the select box (left) and
// a trailing chevron are fixed; everything else is a registry column.
type ColumnKind = "text" | "bool" | "number" | "date";
type Column = {
  key: string;
  label: string;
  group: string;
  /** Default width in px (resizable per user). */
  w: number;
  field?: string; // record field to read; defaults to key
  kind?: ColumnKind; // how to format record[field] (ignored when `cell` is set)
  cell?: (v: CustomerRowView) => React.ReactNode; // composite/computed cells
  cellClassName?: string;
  /** DB column to ORDER BY; undefined = not sortable (computed/composite). */
  sortField?: string;
};

// Default widths per shape (px).
const NAME = 226;
const ADDR = 250;
const WIDE = 240;
const EMAIL = 210;
const TEXT = 158;
const SHORT = 112;
const BOOL = 122;
const DATE = 132;
const COUNT = 104;
const ACT = 200;

const COLUMNS: Column[] = [
  {
    key: "name",
    label: "Name",
    group: "Identity",
    w: NAME,
    sortField: "last_name",
    cell: (v) => (
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={v.c.displayName} size={28} />
        <span className="min-w-0 truncate font-semibold text-[#0a0a0a]">{v.c.displayName}</span>
      </span>
    ),
  },

  // Identity
  { key: "title", label: "Title", group: "Identity", w: SHORT },
  { key: "first_name", label: "First name", group: "Identity", w: TEXT },
  { key: "last_name", label: "Last name", group: "Identity", w: TEXT },
  { key: "title_2", label: "Title (2nd)", group: "Identity", w: SHORT },
  { key: "first_name_2", label: "First name (2nd)", group: "Identity", w: TEXT },
  { key: "last_name_2", label: "Last name (2nd)", group: "Identity", w: TEXT },
  { key: "salutation", label: "Salutation", group: "Identity", w: TEXT },
  { key: "company_name", label: "Company", group: "Identity", w: TEXT },
  {
    key: "customer_type",
    label: "Type",
    group: "Identity",
    w: SHORT,
    cell: (v) => <span>{titleCase(str(v.c.record.customer_type)) ?? "—"}</span>,
  },
  { key: "customer_number", label: "Cust No.", group: "Identity", w: SHORT, kind: "number" },
  { key: "property_type", label: "Property type", group: "Identity", w: TEXT },

  // Contact
  { key: "email", label: "Email", group: "Contact", w: EMAIL },
  { key: "phone", label: "Phone", group: "Contact", w: TEXT },
  { key: "mobile", label: "Mobile", group: "Contact", w: TEXT },
  { key: "mobile_2", label: "Mobile (2nd)", group: "Contact", w: TEXT },
  { key: "home_telephone", label: "Home tel", group: "Contact", w: TEXT },
  { key: "work_telephone", label: "Work tel", group: "Contact", w: TEXT },
  { key: "fax_alt_no", label: "Fax / alt", group: "Contact", w: TEXT },
  { key: "no_whatsapp", label: "No WhatsApp", group: "Contact", w: BOOL, kind: "bool" },

  // Address
  {
    key: "address",
    label: "Installation address",
    group: "Address",
    w: ADDR,
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
  { key: "house_name", label: "House name", group: "Address", w: TEXT },
  { key: "house_number", label: "House number", group: "Address", w: SHORT },
  { key: "street", label: "Street", group: "Address", w: TEXT },
  { key: "locality", label: "Locality", group: "Address", w: TEXT },
  { key: "town", label: "Town", group: "Address", w: TEXT },
  { key: "county", label: "County", group: "Address", w: TEXT },
  { key: "postcode", label: "Postcode", group: "Address", w: SHORT, cellClassName: "font-mono" },
  { key: "what_3_words", label: "what3words", group: "Address", w: TEXT, cellClassName: "font-mono" },
  { key: "directions", label: "Access notes", group: "Address", w: WIDE },
  { key: "business_address", label: "Business address", group: "Address", w: BOOL, kind: "bool" },

  // Marketing
  { key: "email_opt_in", label: "Email consent", group: "Marketing", w: BOOL, kind: "bool" },
  { key: "sms_opt_in", label: "SMS consent", group: "Marketing", w: BOOL, kind: "bool" },
  { key: "phone_opt_in", label: "Phone consent", group: "Marketing", w: BOOL, kind: "bool" },
  { key: "letter_opt_in", label: "Post consent", group: "Marketing", w: BOOL, kind: "bool" },
  { key: "no_email_marketing", label: "No email mktg", group: "Marketing", w: BOOL, kind: "bool" },
  { key: "no_sms_marketing", label: "No SMS mktg", group: "Marketing", w: BOOL, kind: "bool" },
  { key: "no_telephone_marketing", label: "No phone mktg", group: "Marketing", w: BOOL, kind: "bool" },
  { key: "no_postal_marketing", label: "No postal mktg", group: "Marketing", w: BOOL, kind: "bool" },
  { key: "marketing_code", label: "Referral source", group: "Marketing", w: TEXT },
  { key: "opt_in_date", label: "Consent given", group: "Marketing", w: DATE, kind: "date" },
  { key: "opted_in_by", label: "Consent by", group: "Marketing", w: TEXT },

  // Flags
  { key: "do_not_contact", label: "Do not contact", group: "Flags", w: BOOL, kind: "bool" },
  { key: "bad_payer", label: "Payment risk", group: "Flags", w: BOOL, kind: "bool" },
  { key: "customer_moved_away", label: "Moved away", group: "Flags", w: BOOL, kind: "bool" },
  { key: "flash_note", label: "Alert note", group: "Flags", w: WIDE },

  // Account
  { key: "payment_terms", label: "Payment terms", group: "Account", w: TEXT },
  { key: "settlement_disc_pct", label: "Settlement %", group: "Account", w: SHORT, kind: "number" },
  { key: "settlement_disc_terms", label: "Settlement terms", group: "Account", w: TEXT },
  { key: "default_account_reference", label: "Account ref", group: "Account", w: TEXT },
  { key: "vat_no", label: "VAT no.", group: "Account", w: TEXT },
  { key: "cis_reg", label: "CIS reg", group: "Account", w: TEXT },
  { key: "sales_manager", label: "Sales manager", group: "Account", w: TEXT },
  { key: "account_created_in_package", label: "In package", group: "Account", w: BOOL, kind: "bool" },
  { key: "invoice_name", label: "Invoice name", group: "Account", w: TEXT },
  { key: "office_ref_1", label: "Office ref 1", group: "Account", w: TEXT },
  { key: "office_ref_2", label: "Office ref 2", group: "Account", w: TEXT },

  // Activity (computed — not sortable)
  {
    key: "leads",
    label: "Leads",
    group: "Activity",
    w: COUNT,
    cell: (v) => <CountPill total={v.c.leadCount} live={v.c.liveLeadCount} />,
  },
  {
    key: "contracts",
    label: "Contracts",
    group: "Activity",
    w: COUNT,
    cell: (v) => <CountPill total={v.c.contractCount} />,
  },
  {
    key: "activity",
    label: "Last activity",
    group: "Activity",
    w: ACT,
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
  { key: "created", label: "Added", group: "Activity", w: DATE, field: "created_at", kind: "date" },
];

// Real DB-backed columns are sortable by their own field; computed/composite ones
// aren't. (Name is preset to last_name above.)
const NO_SORT = new Set(["address", "leads", "contracts", "activity"]);
for (const c of COLUMNS) {
  if (c.sortField === undefined && !NO_SORT.has(c.key)) c.sortField = c.field ?? c.key;
}

const COLUMN_MAP = new Map(COLUMNS.map((c) => [c.key, c]));
const ALL_KEYS = COLUMNS.map((c) => c.key);
const GROUP_ORDER = ["Identity", "Contact", "Address", "Marketing", "Flags", "Account", "Activity"];
const DEFAULT_VISIBLE = ["name", "address", "phone", "leads", "contracts", "activity"];
const COLUMNS_KEY = "customers_columns";
const MIN_WIDTH = 72;

function renderCell(v: CustomerRowView, col: Column): React.ReactNode {
  if (col.cell) return col.cell(v);
  const val = v.c.record[col.field ?? col.key];
  if (val == null || val === "") return <span className="text-[#a1a1aa]">—</span>;
  if (col.kind === "bool") return val ? "Yes" : "No";
  if (col.kind === "date") return shortDate(String(val));
  return String(val);
}

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

function sanitiseSaved(saved: Record<string, unknown> | null): {
  order: string[] | null;
  widths: Record<string, number>;
} {
  const rawOrder = saved?.order;
  const order =
    Array.isArray(rawOrder) && rawOrder.every((x) => typeof x === "string")
      ? (rawOrder as string[])
      : null;
  const widths: Record<string, number> = {};
  const rawW = saved?.widths;
  if (rawW && typeof rawW === "object") {
    for (const [k, v] of Object.entries(rawW as Record<string, unknown>)) {
      if (typeof v === "number" && v >= MIN_WIDTH && COLUMN_MAP.has(k)) widths[k] = v;
    }
  }
  return { order, widths };
}

// ---------------------------------------------------------------------------
// Shared column state — the "Columns" button and the table both read it.
type ColumnsCtx = {
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
const ColumnsContext = createContext<ColumnsCtx | null>(null);

export function CustomerColumnsProvider({
  saved,
  children,
}: {
  saved: Record<string, unknown> | null;
  children: React.ReactNode;
}) {
  const init = sanitiseSaved(saved);
  const [visible, setVisible] = useState<string[]>(() => reconcileColumns(init.order));
  const [widths, setWidths] = useState<Record<string, number>>(() => init.widths);
  const hidden = ALL_KEYS.filter((k) => !visible.includes(k));

  const save = (order: string[], w: Record<string, number>) =>
    void saveUserPref(COLUMNS_KEY, { order, widths: w });

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
    visible.join(",") !== DEFAULT_VISIBLE.join(",") || Object.keys(widths).length > 0;
  const reset = () => {
    setVisible(DEFAULT_VISIBLE);
    setWidths({});
    void resetUserLayout(COLUMNS_KEY);
  };

  return (
    <ColumnsContext.Provider
      value={{ visible, hidden, widths, toggle, reorder, setWidth, commitWidth, reset, isCustomised }}
    >
      {children}
    </ColumnsContext.Provider>
  );
}

function useColumns(): ColumnsCtx {
  const ctx = useContext(ColumnsContext);
  if (!ctx) throw new Error("useColumns must be used inside CustomerColumnsProvider");
  return ctx;
}

const widthOf = (widths: Record<string, number>, col: Column) => widths[col.key] ?? col.w;

// ---------------------------------------------------------------------------
// Dismissible popover — positioned against the viewport (the CRM standard, so it
// escapes toolbar clipping AND keeps tenant-accent inheritance, unlike a portal).
function Popover({
  label,
  icon,
  badge,
  width = 272,
  children,
}: {
  label: string;
  icon: "columns" | "filters";
  badge?: number;
  width?: number;
  children: () => React.ReactNode;
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
          {children()}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function ColumnsButton() {
  const { visible, hidden, toggle, reorder, reset, isCustomised } = useColumns();
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
  const matches = (k: string) => COLUMN_MAP.get(k)?.label.toLowerCase().includes(q);
  const hiddenByGroup = GROUP_ORDER.map((g) => ({
    group: g,
    keys: hidden.filter((k) => COLUMN_MAP.get(k)?.group === g && (!q || matches(k))),
  })).filter((g) => g.keys.length > 0);

  return (
    <Popover label="Columns" icon="columns" width={264}>
      {() => (
        <div className="flex max-h-[min(70vh,460px)] flex-col">
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

function StaticRow({
  colKey,
  checked,
  onToggle,
}: {
  colKey: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const col = COLUMN_MAP.get(colKey);
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
// Filters — data-driven over the customer fields; all URL-param-driven
// (`f_<key>`), except lead-derived "Has live lead" (`live`).
type FilterDef = { key: string; label: string; group: string; kind: "select" | "bool" };
const FILTERS: FilterDef[] = [
  { key: "customer_type", label: "Customer type", group: "Identity", kind: "select" },
  { key: "property_type", label: "Property type", group: "Identity", kind: "select" },
  { key: "no_whatsapp", label: "No WhatsApp", group: "Contact", kind: "bool" },
  { key: "town", label: "Town", group: "Address", kind: "select" },
  { key: "county", label: "County", group: "Address", kind: "select" },
  { key: "business_address", label: "Business address", group: "Address", kind: "bool" },
  { key: "marketing_code", label: "Referral source", group: "Marketing", kind: "select" },
  { key: "email_opt_in", label: "Email consent", group: "Marketing", kind: "bool" },
  { key: "sms_opt_in", label: "SMS consent", group: "Marketing", kind: "bool" },
  { key: "phone_opt_in", label: "Phone consent", group: "Marketing", kind: "bool" },
  { key: "letter_opt_in", label: "Post consent", group: "Marketing", kind: "bool" },
  { key: "do_not_contact", label: "Do not contact", group: "Flags", kind: "bool" },
  { key: "bad_payer", label: "Payment risk", group: "Flags", kind: "bool" },
  { key: "customer_moved_away", label: "Moved away", group: "Flags", kind: "bool" },
  { key: "payment_terms", label: "Payment terms", group: "Account", kind: "select" },
  { key: "sales_manager", label: "Sales manager", group: "Account", kind: "select" },
];
const FILTER_GROUPS = ["Activity", "Identity", "Contact", "Address", "Marketing", "Flags", "Account"];

export function FiltersButton({ filterOptions }: { filterOptions: Record<string, string[]> }) {
  const { setParams, searchParams } = useSetParams();
  const live = searchParams.get("live") === "1";
  const [openKey, setOpenKey] = useState<string | null>(null);

  const activeCount =
    (live ? 1 : 0) + FILTERS.filter((f) => (searchParams.get(`f_${f.key}`) ?? "") !== "").length;

  const clearAll = () => {
    const updates: Record<string, null> = { live: null };
    for (const f of FILTERS) updates[`f_${f.key}`] = null;
    setParams(updates);
  };

  return (
    <Popover label="Filters" icon="filters" badge={activeCount || undefined} width={276}>
      {() => (
        <div className="flex max-h-[min(76vh,480px)] w-[276px] flex-col">
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
            {FILTER_GROUPS.map((group) => {
              const inGroup = FILTERS.filter((f) => f.group === group);
              const showLead = group === "Activity";
              if (inGroup.length === 0 && !showLead) return null;
              return (
                <div key={group} className="pb-1">
                  <SectionLabel>{group}</SectionLabel>
                  {showLead && (
                    <BoolFilter
                      label="Has live lead"
                      value={live ? "1" : ""}
                      onChange={(v) => setParams({ live: v === "1" ? "1" : null })}
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
  open,
  onOpen,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
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
          {value ?? "Any"}
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
            <RadioRow key={o} label={o} checked={value === o} onClick={() => onChange(o)} />
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
export function CustomerTable({
  views,
  total,
  page,
  pageCount,
  from,
  to,
  sort,
  dir,
}: {
  views: CustomerRowView[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
  sort: string | null;
  dir: "asc" | "desc";
}) {
  const { visible, widths } = useColumns();
  const cols = visible.map((k) => COLUMN_MAP.get(k)).filter((c): c is Column => !!c);
  // Fixed edges: 44px select box · resizable data columns · flexible spacer (so
  // rows fill the width and borders span) · 40px chevron.
  const grid = `44px ${cols.map((c) => `${widthOf(widths, c)}px`).join(" ")} minmax(16px,1fr) 40px`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e7e7ea]">
      <div className="min-h-0 flex-1 overflow-auto">
        <div style={{ minWidth: "min-content" }}>
          <div
            className="sticky top-0 z-10 grid items-stretch border-b border-[#e7e7ea] bg-[#fafafa] text-[12px] font-bold uppercase tracking-[0.04em] text-[#a1a1aa]"
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

          {views.length === 0 ? (
            <EmptyState />
          ) : (
            views.map((v) => <Row key={v.c.id} v={v} cols={cols} grid={grid} />)
          )}
        </div>
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

function HeaderCell({
  col,
  sort,
  dir,
}: {
  col: Column;
  sort: string | null;
  dir: "asc" | "desc";
}) {
  const { widths, setWidth, commitWidth } = useColumns();
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

function Row({ v, cols, grid }: { v: CustomerRowView; cols: Column[]; grid: string }) {
  return (
    <Link
      href={`/customers/${v.c.id}`}
      className="grid items-center border-b border-[#f4f4f5] px-0 py-[11px] text-[13px] transition-colors last:border-b-0 hover:bg-[#fafafa]"
      style={{ gridTemplateColumns: grid }}
    >
      <span className="flex items-center justify-center">
        <span className="inline-block size-[15px] rounded-[4px] border-[1.5px] border-[#d4d4d8]" />
      </span>
      {cols.map((col) =>
        col.cell ? (
          <span key={col.key} className={cn("min-w-0 px-3", col.cellClassName)}>
            {renderCell(v, col)}
          </span>
        ) : (
          <span
            key={col.key}
            className={cn("min-w-0 truncate px-3 text-[#3f3f46]", col.cellClassName)}
          >
            {renderCell(v, col)}
          </span>
        ),
      )}
      <span />
      <span className="text-center text-[#a1a1aa]">›</span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-sm font-semibold text-[#3f3f46]">No customers found</p>
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

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
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
