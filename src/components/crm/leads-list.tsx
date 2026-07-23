"use client";

import { RefChip, StageBadge } from "@/components/crm/primitives";
import { leadStage } from "@/lib/leads";
import { loadLeadRows } from "@/app/(app)/leads/actions";
import {
  DataListProvider,
  DataTable,
  shortDate,
  type FilterDef,
  type ListColumn,
  type ListSpec,
} from "@/components/crm/data-list";
import { gbp } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeadFilters, LeadRow } from "@/lib/data/leads";

// The leads list = a ListSpec fed to the shared machinery in `data-list.tsx`
// (columns popover + drag-reorder, resize, server sort, filters, infinite
// scroll). Only what makes this list ABOUT LEADS lives here. Mirrors the
// customers list deliberately — see AGENTS.md § Lists & columns.

type Column = ListColumn<LeadRow>;

// ---------------------------------------------------------------------------
// Column registry — one entry per showable field. Only the select box (left) and
// a trailing chevron are fixed; everything else is a registry column.

// Default widths per shape (px).
const REF = 104;
const TITLE = 212;
const NAME = 200;
const ADDR = 230;
const WIDE = 240;
const TEXT = 158;
const SHORT = 112;
const BOOL = 122;
const DATE = 132;
const MONEY = 118;
const STAGE = 138;

// Name-type fields render bold + near-black, so a person's name reads as one
// identity wherever its parts show — same rule as the customers list.
const NAME_CELL = "font-semibold text-[#0a0a0a]";

const COLUMNS: Column[] = [
  {
    // The ONLY lead-number column: the reference chip, sorted by the underlying
    // lead_number. A second plain-text "Lead no." column showed the same value
    // twice in two formats, which read as a duplicate in the column picker.
    key: "ref",
    label: "Lead No.",
    group: "Lead",
    w: REF,
    sortField: "lead_number",
    cell: (l) => <RefChip>{l.ref}</RefChip>,
  },
  {
    key: "title",
    label: "Product",
    group: "Lead",
    w: TITLE,
    sortField: "product_type",
    cell: (l) => <span className="block min-w-0 truncate font-semibold text-[#0a0a0a]">{l.title}</span>,
  },
  {
    key: "customer",
    label: "Customer",
    group: "Customer",
    w: NAME,
    // The customer's name lives on the embed, not on `leads` — so there is no
    // single lead column to ORDER BY. Sort by the lead's own fields instead.
    cell: (l) => <span className="block min-w-0 truncate font-semibold text-[#0a0a0a]">{l.customerName}</span>,
  },
  {
    key: "stage",
    label: "Stage",
    group: "Lead",
    w: STAGE,
    sortField: "status",
    cell: (l) => <StageBadge status={l.status} />,
  },
  {
    key: "value",
    label: "Value",
    group: "Lead",
    w: MONEY,
    sortField: "gross_value",
    cell: (l) => <span className="font-semibold text-[#0a0a0a]">{gbp(l.value)}</span>,
  },

  // Lead
  { key: "result", label: "Result", group: "Lead", w: SHORT, kind: "label" },
  { key: "result_reason", label: "Result reason", group: "Lead", w: TEXT },
  { key: "result_date", label: "Result date", group: "Lead", w: DATE, kind: "date" },
  { key: "priority", label: "Priority", group: "Lead", w: SHORT, kind: "label" },
  { key: "estimated_value", label: "Estimated value", group: "Lead", w: MONEY, kind: "number" },
  { key: "window_count", label: "Windows", group: "Lead", w: SHORT, kind: "number" },
  { key: "product_interest_1", label: "Interest 1", group: "Lead", w: TEXT },
  { key: "product_interest_2", label: "Interest 2", group: "Lead", w: TEXT },
  { key: "office_reference", label: "Office ref", group: "Lead", w: TEXT },
  { key: "office_reference_2", label: "Office ref 2", group: "Lead", w: TEXT },
  { key: "notes", label: "Notes", group: "Lead", w: WIDE },

  // Source
  { key: "source", label: "Source", group: "Source", w: TEXT },
  { key: "sub_source", label: "Sub-source", group: "Source", w: TEXT },
  { key: "salesman", label: "Salesperson", group: "Source", w: TEXT, cellClassName: NAME_CELL },
  { key: "salesperson_type", label: "Salesperson type", group: "Source", w: TEXT },
  { key: "sales_area", label: "Sales area", group: "Source", w: TEXT },
  { key: "sales_director", label: "Sales director", group: "Source", w: TEXT, cellClassName: NAME_CELL },

  // Customer
  { key: "customer_town", label: "Town", group: "Customer", w: TEXT },
  { key: "customer_postcode", label: "Postcode", group: "Customer", w: SHORT, cellClassName: "font-mono" },
  {
    // Street line only — Town and Postcode are their own columns, so a second
    // address line would just duplicate them and double the row height.
    key: "address",
    label: "Address",
    group: "Customer",
    w: ADDR,
    cell: (l) => <span className="block truncate text-[#3f3f46]">{l.addressLine ?? "—"}</span>,
  },
  { key: "installation_town", label: "Install town", group: "Customer", w: TEXT },
  { key: "installation_postcode", label: "Install postcode", group: "Customer", w: SHORT, cellClassName: "font-mono" },
  { key: "same_as_customer_address", label: "Same as customer", group: "Customer", w: BOOL, kind: "bool" },

  // Quote
  { key: "quote_type", label: "Quote type", group: "Quote", w: TEXT },
  { key: "quote_date", label: "Quote date", group: "Quote", w: DATE, kind: "date" },
  { key: "payment_method", label: "Payment method", group: "Quote", w: TEXT },
  { key: "supply_only", label: "Supply only", group: "Quote", w: BOOL, kind: "bool" },
  { key: "delivery_method", label: "Delivery method", group: "Quote", w: TEXT },
  { key: "contract_type", label: "Contract type", group: "Quote", w: TEXT },
  { key: "contract_number", label: "Contract no.", group: "Quote", w: SHORT, kind: "number" },
  { key: "contract_date", label: "Contract date", group: "Quote", w: DATE, kind: "date" },
  { key: "installation_manager", label: "Install manager", group: "Quote", w: TEXT, cellClassName: NAME_CELL },
  { key: "on_hold", label: "On hold", group: "Quote", w: BOOL, kind: "bool" },
  { key: "hold_reason", label: "Hold reason", group: "Quote", w: WIDE },
  { key: "contract_cancelled", label: "Cancelled", group: "Quote", w: BOOL, kind: "bool" },
  { key: "cancel_reason", label: "Cancel reason", group: "Quote", w: WIDE },

  // Dates — Received and Follow-up are their OWN columns, not one composite.
  // Discrete columns sort, filter and align; a mashed-together pair can't be
  // sorted by either half. (Same rule as the customers list's address.)
  { key: "lead_date", label: "Received", group: "Dates", w: DATE, kind: "date" },
  {
    key: "follow_up_date",
    label: "Follow-up",
    group: "Dates",
    w: DATE,
    // Amber only while it's OUTSTANDING — a follow-up on a won or lost lead is
    // history, not a prompt, so colouring it would cry wolf.
    cell: (l) =>
      l.followUpDate ? (
        <span className={cn("truncate", l.live ? "font-semibold text-[#b86e00]" : "text-[#3f3f46]")}>
          {shortDate(l.followUpDate)}
        </span>
      ) : (
        <span className="text-[#a1a1aa]">—</span>
      ),
  },
  { key: "created_at", label: "Added", group: "Dates", w: DATE, kind: "date" },
];

const GROUP_ORDER = ["Lead", "Customer", "Source", "Quote", "Dates"];
// New columns default HIDDEN — a release must not force a column into everyone's view.
const DEFAULT_VISIBLE = ["ref", "title", "customer", "stage", "value", "source", "lead_date", "follow_up_date"];

// ---------------------------------------------------------------------------
const FILTERS: FilterDef[] = [
  // The stage registry owns these labels ("Survey booked"), so the filter
  // shows exactly what the badges and board columns show.
  { key: "status", label: "Stage", group: "Lead", kind: "select", formatOption: (v) => leadStage(v).label },
  { key: "result", label: "Result", group: "Lead", kind: "select" },
  { key: "priority", label: "Priority", group: "Lead", kind: "select" },
  { key: "product_type", label: "Product type", group: "Lead", kind: "select" },
  { key: "source", label: "Source", group: "Source", kind: "select" },
  { key: "sub_source", label: "Sub-source", group: "Source", kind: "select" },
  { key: "salesman", label: "Salesperson", group: "Source", kind: "select" },
  { key: "salesperson_type", label: "Salesperson type", group: "Source", kind: "select" },
  { key: "sales_area", label: "Sales area", group: "Source", kind: "select" },
  { key: "quote_type", label: "Quote type", group: "Quote", kind: "select" },
  { key: "payment_method", label: "Payment method", group: "Quote", kind: "select" },
  { key: "contract_type", label: "Contract type", group: "Quote", kind: "select" },
  { key: "supply_only", label: "Supply only", group: "Quote", kind: "bool" },
  { key: "on_hold", label: "On hold", group: "Quote", kind: "bool" },
  { key: "contract_cancelled", label: "Cancelled", group: "Quote", kind: "bool" },
  { key: "same_as_customer_address", label: "Same as customer", group: "Customer", kind: "bool" },
];
const FILTER_GROUPS = ["Lead", "Customer", "Source", "Quote"];

// Mirrors the server's VALUE_FILTER_COLUMNS allowlist; labels come from the
// column registry so they read the same as the headers.
const VALUE_FIELD_KEYS = [
  "status", "result", "result_reason", "priority",
  "source", "sub_source", "product_type", "product_interest_1", "product_interest_2",
  "salesman", "salesperson_type", "quote_type", "payment_method",
  "office_reference", "office_reference_2", "notes",
  "installation_town", "installation_postcode", "installation_street",
  "sales_area", "sales_director", "contract_type", "delivery_method",
  "installation_manager", "hold_reason", "cancel_reason",
];

const LEADS_SPEC: ListSpec<LeadRow, LeadFilters> = {
  name: "leads",
  layoutKey: "leads_columns",
  columns: COLUMNS,
  groupOrder: GROUP_ORDER,
  defaultVisible: DEFAULT_VISIBLE,
  // Customer name lives on the embed and the composite cells span several
  // fields — no single lead column to ORDER BY.
  noSort: ["customer", "address", "customer_town", "customer_postcode"],
  filters: FILTERS,
  filterGroups: FILTER_GROUPS,
  valueFieldKeys: VALUE_FIELD_KEYS,
  noun: "leads",
  rowId: (l) => l.id,
  rowHref: (l) => `/leads/${l.id}`,
  record: (l) => l.record,
  loadRows: loadLeadRows,
};

export function LeadColumnsProvider({
  saved,
  persist = true,
  children,
}: {
  saved: Record<string, unknown> | null;
  /** False while a saved view owns the columns — see DataListProvider. */
  persist?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DataListProvider persist={persist} spec={LEADS_SPEC} saved={saved}>
      {children}
    </DataListProvider>
  );
}

export function LeadTable(props: {
  initialViews: LeadRow[];
  total: number;
  filters: LeadFilters;
  sort: string | null;
  dir: "asc" | "desc";
}) {
  return <DataTable {...props} />;
}

export { ColumnsButton, FiltersButton } from "@/components/crm/data-list";
