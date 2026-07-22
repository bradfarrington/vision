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
import { resetUserLayout, saveUserOrder } from "@/app/(app)/preferences/actions";
import { cn } from "@/lib/utils";
import type { ActivityLine, CustomerRow } from "@/lib/data/customers";

// The customer list: column-customisable (per user) + a full Filters popover
// over the customer fields. Columns are a registry so any field can be shown;
// the arrangement saves per user to `user_ui_layouts` (see AGENTS.md
// § Rearrangeable cards / § Lists & columns). Filters stay URL-param-driven so
// the server re-queries and the state is shareable.

export type CustomerRowView = { c: CustomerRow; activity: ActivityLine };

// ---------------------------------------------------------------------------
// Column registry — one entry per showable field. The primary name column and
// the row controls (select box, chevron) are fixed edges and not listed here.
type ColumnKind = "text" | "bool" | "number" | "date";
type Column = {
  key: string;
  label: string;
  group: string;
  width: string;
  /** Record field to read; defaults to `key`. */
  field?: string;
  /** How to format `record[field]` (ignored when `cell` is set). */
  kind?: ColumnKind;
  /** Custom renderer, for composite/computed cells. */
  cell?: (v: CustomerRowView) => React.ReactNode;
  cellClassName?: string;
};

const TEXT = "minmax(110px,1.2fr)";
const SHORT = "minmax(84px,.85fr)";
const BOOL = "minmax(96px,.9fr)";
const DATE = "minmax(104px,1fr)";
const WIDE = "minmax(160px,2.1fr)";

const COLUMNS: Column[] = [
  // Identity
  { key: "title", label: "Title", group: "Identity", width: SHORT },
  { key: "first_name", label: "First name", group: "Identity", width: TEXT },
  { key: "last_name", label: "Last name", group: "Identity", width: TEXT },
  { key: "title_2", label: "Title (2nd)", group: "Identity", width: SHORT },
  { key: "first_name_2", label: "First name (2nd)", group: "Identity", width: TEXT },
  { key: "last_name_2", label: "Last name (2nd)", group: "Identity", width: TEXT },
  { key: "salutation", label: "Salutation", group: "Identity", width: TEXT },
  { key: "company_name", label: "Company", group: "Identity", width: TEXT },
  {
    key: "customer_type",
    label: "Type",
    group: "Identity",
    width: SHORT,
    cell: (v) => <span className="text-[#3f3f46]">{titleCase(str(v.c.record.customer_type)) ?? "—"}</span>,
  },
  { key: "customer_number", label: "Customer no.", group: "Identity", width: SHORT, kind: "number" },
  { key: "property_type", label: "Property type", group: "Identity", width: TEXT },

  // Contact
  { key: "email", label: "Email", group: "Contact", width: "minmax(150px,1.7fr)" },
  { key: "phone", label: "Phone", group: "Contact", width: "minmax(110px,1.3fr)" },
  { key: "mobile", label: "Mobile", group: "Contact", width: TEXT },
  { key: "mobile_2", label: "Mobile (2nd)", group: "Contact", width: TEXT },
  { key: "home_telephone", label: "Home tel", group: "Contact", width: TEXT },
  { key: "work_telephone", label: "Work tel", group: "Contact", width: TEXT },
  { key: "fax_alt_no", label: "Fax / alt", group: "Contact", width: TEXT },
  { key: "no_whatsapp", label: "No WhatsApp", group: "Contact", width: BOOL, kind: "bool" },

  // Address
  {
    key: "address",
    label: "Installation address",
    group: "Address",
    width: WIDE,
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
  { key: "house_name", label: "House name", group: "Address", width: TEXT },
  { key: "house_number", label: "House number", group: "Address", width: SHORT },
  { key: "street", label: "Street", group: "Address", width: TEXT },
  { key: "locality", label: "Locality", group: "Address", width: TEXT },
  { key: "town", label: "Town", group: "Address", width: TEXT },
  { key: "county", label: "County", group: "Address", width: TEXT },
  { key: "postcode", label: "Postcode", group: "Address", width: SHORT, cellClassName: "font-mono" },
  { key: "what_3_words", label: "what3words", group: "Address", width: TEXT, cellClassName: "font-mono" },
  { key: "directions", label: "Access notes", group: "Address", width: WIDE },
  { key: "business_address", label: "Business address", group: "Address", width: BOOL, kind: "bool" },

  // Marketing
  { key: "email_opt_in", label: "Email consent", group: "Marketing", width: BOOL, kind: "bool" },
  { key: "sms_opt_in", label: "SMS consent", group: "Marketing", width: BOOL, kind: "bool" },
  { key: "phone_opt_in", label: "Phone consent", group: "Marketing", width: BOOL, kind: "bool" },
  { key: "letter_opt_in", label: "Post consent", group: "Marketing", width: BOOL, kind: "bool" },
  { key: "no_email_marketing", label: "No email mktg", group: "Marketing", width: BOOL, kind: "bool" },
  { key: "no_sms_marketing", label: "No SMS mktg", group: "Marketing", width: BOOL, kind: "bool" },
  { key: "no_telephone_marketing", label: "No phone mktg", group: "Marketing", width: BOOL, kind: "bool" },
  { key: "no_postal_marketing", label: "No postal mktg", group: "Marketing", width: BOOL, kind: "bool" },
  { key: "marketing_code", label: "Referral source", group: "Marketing", width: TEXT },
  { key: "opt_in_date", label: "Consent given", group: "Marketing", width: DATE, kind: "date" },
  { key: "opted_in_by", label: "Consent by", group: "Marketing", width: TEXT },

  // Flags
  { key: "do_not_contact", label: "Do not contact", group: "Flags", width: BOOL, kind: "bool" },
  { key: "bad_payer", label: "Payment risk", group: "Flags", width: BOOL, kind: "bool" },
  { key: "customer_moved_away", label: "Moved away", group: "Flags", width: BOOL, kind: "bool" },
  { key: "flash_note", label: "Alert note", group: "Flags", width: WIDE },

  // Account
  { key: "payment_terms", label: "Payment terms", group: "Account", width: TEXT },
  { key: "settlement_disc_pct", label: "Settlement %", group: "Account", width: SHORT, kind: "number" },
  { key: "settlement_disc_terms", label: "Settlement terms", group: "Account", width: TEXT },
  { key: "default_account_reference", label: "Account ref", group: "Account", width: TEXT },
  { key: "vat_no", label: "VAT no.", group: "Account", width: TEXT },
  { key: "cis_reg", label: "CIS reg", group: "Account", width: TEXT },
  { key: "sales_manager", label: "Sales manager", group: "Account", width: TEXT },
  { key: "account_created_in_package", label: "In package", group: "Account", width: BOOL, kind: "bool" },
  { key: "invoice_name", label: "Invoice name", group: "Account", width: TEXT },
  { key: "office_ref_1", label: "Office ref 1", group: "Account", width: TEXT },
  { key: "office_ref_2", label: "Office ref 2", group: "Account", width: TEXT },

  // Activity (computed)
  {
    key: "leads",
    label: "Leads",
    group: "Activity",
    width: "minmax(70px,.9fr)",
    cell: (v) => <CountPill total={v.c.leadCount} live={v.c.liveLeadCount} />,
  },
  {
    key: "contracts",
    label: "Contracts",
    group: "Activity",
    width: "minmax(80px,1fr)",
    cell: (v) => <CountPill total={v.c.contractCount} />,
  },
  {
    key: "activity",
    label: "Last activity",
    group: "Activity",
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
    key: "created",
    label: "Added",
    group: "Activity",
    width: DATE,
    field: "created_at",
    kind: "date",
  },
];

const COLUMN_MAP = new Map(COLUMNS.map((c) => [c.key, c]));
const ALL_KEYS = COLUMNS.map((c) => c.key);
const GROUP_ORDER = ["Identity", "Contact", "Address", "Marketing", "Flags", "Account", "Activity"];
const DEFAULT_VISIBLE = ["address", "phone", "leads", "contracts", "activity"];
const COLUMNS_KEY = "customers_columns";

function renderCell(v: CustomerRowView, col: Column): React.ReactNode {
  if (col.cell) return col.cell(v);
  const val = v.c.record[col.field ?? col.key];
  if (val == null || val === "") return <span className="text-[#a1a1aa]">—</span>;
  if (col.kind === "bool") return val ? "Yes" : "No";
  if (col.kind === "date") return shortDate(String(val));
  return String(val);
}

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
            {/* Shown columns are draggable in place — but only when not filtering,
                since a search hides some rows and reordering a partial list is
                meaningless. */}
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
                  <p className="px-2 py-1.5 text-[12px] text-[#a1a1aa]">
                    Only the name shows. Add a field below.
                  </p>
                )}
              </>
            )}

            {q &&
              visible
                .filter((k) => matches(k))
                .map((k) => (
                  <StaticRow key={k} colKey={k} checked onToggle={() => toggle(k)} />
                ))}

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

// A non-draggable row (hidden columns, or search results): checkbox toggles it.
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
// Filters — data-driven over the customer fields. Select filters match an exact
// value; bool filters are Any / Yes / No. All URL-param-driven (`f_<key>`),
// except the lead-derived "Has live lead" (`live`).
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

// Any / Yes / No segmented control. `yesNo=false` gives a single on/off toggle
// (for "Has live lead", where "No live lead" isn't a useful query).
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
        <Check
          checked={value === "1"}
          onClick={() => onChange(value === "1" ? "" : "1")}
          label={label}
        />
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
        <span className={cn("shrink-0 max-w-[120px] truncate text-[12px]", value ? "text-[var(--accent-blue)] font-medium" : "text-[#a1a1aa]")}>
          {value ?? "Any"}
        </span>
        <Icon name="chevron-down" size={11} className={cn("shrink-0 text-[#a1a1aa] transition-transform", open && "rotate-180")} />
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
      <div className="min-h-0 flex-1 overflow-auto">
        <div style={{ minWidth: "min-content" }}>
          <div
            className="sticky top-0 z-10 grid items-center border-b border-[#e7e7ea] bg-[#fafafa] px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]"
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
      {cols.map((col) =>
        col.cell ? (
          <span key={col.key} className={cn("min-w-0", col.cellClassName)}>
            {renderCell(v, col)}
          </span>
        ) : (
          <span
            key={col.key}
            className={cn("min-w-0 truncate text-[#3f3f46]", col.cellClassName)}
          >
            {renderCell(v, col)}
          </span>
        ),
      )}
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
