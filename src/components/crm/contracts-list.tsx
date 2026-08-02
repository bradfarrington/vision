"use client";

import { RefChip, StageBadge } from "@/components/crm/primitives";
import { contractStage } from "@/lib/contracts";
import { loadContractRows } from "@/app/(app)/contracts/actions";
import {
  DataListProvider,
  DataTable,
  type FilterDef,
  type ListColumn,
  type ListSpec,
} from "@/components/crm/data-list";
import { CardFieldsProvider, type CardFieldsSpec } from "@/components/crm/card-fields";
import { gbp } from "@/lib/format";
import type { ContractFilters, ContractRow } from "@/lib/data/contracts";

// The contracts list = a ListSpec fed to the shared machinery in `data-list.tsx`
// (columns popover + drag-reorder, resize, server sort, filters, infinite
// scroll). Only what makes this list ABOUT CONTRACTS lives here — the third
// consumer of the module, after customers and leads.

type Column = ListColumn<ContractRow>;

// Default widths per shape (px).
const REF = 116;
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
// identity wherever its parts show — same rule as the other two lists.
const NAME_CELL = "font-semibold text-[#0a0a0a]";

const COLUMNS: Column[] = [
  {
    // The ONLY contract-number column: the reference chip, sorted by the
    // underlying contract_number. Never a second plain-integer column showing
    // the same identity in another format.
    key: "ref",
    label: "Contract No.",
    group: "Contract",
    w: REF,
    sortField: "contract_number",
    cell: (ct) => <RefChip>{ct.ref}</RefChip>,
    cardHeader: true,
    cardCell: (ct) => <RefChip className="!px-1.5 !py-0.5 !text-[10.5px]">{ct.ref}</RefChip>,
  },
  {
    key: "title",
    label: "Type",
    group: "Contract",
    w: TITLE,
    sortField: "contract_type",
    cell: (ct) => (
      <span className="block min-w-0 truncate font-semibold text-[#0a0a0a]">{ct.title}</span>
    ),
    cardBare: true,
    cardCell: (ct) => (
      <span className="block truncate text-[12.5px] font-semibold text-[#0a0a0a]">{ct.title}</span>
    ),
  },
  {
    key: "customer",
    label: "Customer",
    group: "Customer",
    w: NAME,
    // The customer's name lives on the embed, not on `contracts` — so there is
    // no single contract column to ORDER BY.
    cell: (ct) => (
      <span className="block min-w-0 truncate font-semibold text-[#0a0a0a]">{ct.customerName}</span>
    ),
    cardBare: true,
    cardCell: (ct) => <span className="block truncate text-[12px] text-[#3f3f46]">{ct.customerName}</span>,
  },
  {
    key: "stage",
    label: "Stage",
    group: "Contract",
    w: STAGE,
    sortField: "stage",
    // The CONTRACT stage registry, not the lead one — same badge geometry.
    cell: (ct) => <StageBadge status={ct.stage} resolve={contractStage} />,
    // Off cards by default: a card's COLUMN already says its stage.
    cardBare: true,
    cardCell: (ct) => <StageBadge status={ct.stage} resolve={contractStage} />,
  },
  {
    key: "value",
    label: "Value",
    group: "Financials",
    w: MONEY,
    sortField: "gross_value",
    cell: (ct) => <span className="font-semibold text-[#0a0a0a]">{gbp(ct.value)}</span>,
    cardHeader: true,
    cardCell: (ct) => <span className="text-[12.5px] font-bold text-[#0a0a0a]">{gbp(ct.value)}</span>,
  },
  {
    // Where the contract came from. A computed row prop, so it needs its own
    // cardCell — the card renderer does NOT fall back to the table `cell`.
    key: "lead_ref",
    label: "From lead",
    group: "Contract",
    w: SHORT,
    cell: (ct) =>
      ct.leadRef ? <RefChip>{ct.leadRef}</RefChip> : <span className="text-[#a1a1aa]">—</span>,
    cardCell: (ct) =>
      ct.leadRef ? <RefChip className="!px-1.5 !py-0.5 !text-[10.5px]">{ct.leadRef}</RefChip> : null,
  },

  // Contract
  { key: "status", label: "Status", group: "Contract", w: SHORT, kind: "label" },
  { key: "office_reference", label: "Office ref", group: "Contract", w: TEXT },
  { key: "office_reference_2", label: "Office ref 2", group: "Contract", w: TEXT },
  { key: "supply_only", label: "Supply only", group: "Contract", w: BOOL, kind: "bool" },
  { key: "delivery_method", label: "Delivery method", group: "Contract", w: TEXT },
  { key: "notes", label: "Notes", group: "Contract", w: WIDE },
  { key: "on_hold", label: "On hold", group: "Contract", w: BOOL, kind: "bool" },
  { key: "hold_reason", label: "Hold reason", group: "Contract", w: WIDE },
  { key: "contract_cancelled", label: "Cancelled", group: "Contract", w: BOOL, kind: "bool" },
  { key: "cancel_reason", label: "Cancel reason", group: "Contract", w: WIDE },

  // Source
  { key: "source", label: "Source", group: "Source", w: TEXT },
  { key: "salesman", label: "Salesperson", group: "Source", w: TEXT, cellClassName: NAME_CELL },
  { key: "sales_area", label: "Sales area", group: "Source", w: TEXT },
  { key: "sales_director", label: "Sales director", group: "Source", w: TEXT, cellClassName: NAME_CELL },

  // Customer
  { key: "customer_town", label: "Town", group: "Customer", w: TEXT },
  { key: "customer_postcode", label: "Postcode", group: "Customer", w: SHORT, cellClassName: "font-mono" },
  {
    // The CUSTOMER's own (main) address — street line only, since Town and
    // Postcode are their own columns.
    key: "customer_address",
    label: "Address",
    group: "Customer",
    w: ADDR,
    cell: (ct) => <span className="block truncate text-[#3f3f46]">{ct.customerAddressLine ?? "—"}</span>,
    cardCell: (ct) => ct.customerAddressLine ?? null,
  },
  {
    // The SITE address (where the work happens) — the same as the customer's
    // when the contract mirrors it.
    key: "address",
    label: "Site address",
    group: "Customer",
    w: ADDR,
    cell: (ct) => <span className="block truncate text-[#3f3f46]">{ct.addressLine ?? "—"}</span>,
    cardCell: (ct) => ct.addressLine ?? null,
  },
  { key: "site_town", label: "Site town", group: "Customer", w: TEXT },
  { key: "site_postcode", label: "Site postcode", group: "Customer", w: SHORT, cellClassName: "font-mono" },
  { key: "site_same_as_customer", label: "Same as customer", group: "Customer", w: BOOL, kind: "bool" },
  { key: "invoice_name", label: "Invoice name", group: "Customer", w: TEXT, cellClassName: NAME_CELL },
  { key: "invoice_same_as_customer", label: "Invoice same as customer", group: "Customer", w: BOOL, kind: "bool" },

  // Fitting
  { key: "installation_manager", label: "Install manager", group: "Fitting", w: TEXT, cellClassName: NAME_CELL },
  { key: "estimated_fitting_days", label: "Est. fitting days", group: "Fitting", w: SHORT, kind: "number" },
  { key: "installation_completed", label: "Install completed", group: "Fitting", w: TEXT },
  { key: "send_letters_to_fitting", label: "Letters to site", group: "Fitting", w: BOOL, kind: "bool" },
  { key: "fitting_directions", label: "Site directions", group: "Fitting", w: WIDE },
  { key: "signboard_left", label: "Signboard left", group: "Fitting", w: BOOL, kind: "bool" },
  { key: "signboard_date", label: "Signboard date", group: "Fitting", w: DATE },
  { key: "guarantee_number", label: "Guarantee no.", group: "Fitting", w: TEXT },
  { key: "guarantee_date", label: "Guarantee date", group: "Fitting", w: DATE },
  { key: "insurance_backed_guarantee_ref", label: "IBG ref", group: "Fitting", w: TEXT },

  // Dates — one column per step of the stepper, each sortable in its own right.
  { key: "contract_date", label: "Signed", group: "Dates", w: DATE, kind: "date" },
  { key: "survey_date", label: "Survey", group: "Dates", w: DATE, kind: "date" },
  { key: "order_date", label: "Ordered", group: "Dates", w: DATE, kind: "date" },
  { key: "install_start_date", label: "Install from", group: "Dates", w: DATE, kind: "date" },
  { key: "install_end_date", label: "Install to", group: "Dates", w: DATE, kind: "date" },
  { key: "completed_date", label: "Completed", group: "Dates", w: DATE, kind: "date" },
  { key: "cancel_date", label: "Cancelled on", group: "Dates", w: DATE, kind: "date" },
  { key: "hold_date_on", label: "Held from", group: "Dates", w: DATE, kind: "date" },
  { key: "hold_date_off", label: "Held to", group: "Dates", w: DATE, kind: "date" },
  { key: "created_at", label: "Added", group: "Dates", w: DATE, kind: "date" },
];

const GROUP_ORDER = ["Contract", "Customer", "Source", "Fitting", "Financials", "Dates"];
// New columns default HIDDEN — a release must not force a column into everyone's view.
const DEFAULT_VISIBLE = ["ref", "title", "customer", "stage", "value", "contract_date"];

// The fields a BOARD CARD shows by default: reference + value on the header
// line, the type, the customer, then the town. Stage is off by default (the
// card's column already says its stage).
const DEFAULT_CARD_FIELDS = ["ref", "value", "title", "customer", "customer_town"];

// ---------------------------------------------------------------------------
const FILTERS: FilterDef[] = [
  // The stage registry owns these labels, so the filter shows exactly what the
  // badges and board columns show.
  { key: "stage", label: "Stage", group: "Contract", kind: "select", formatOption: (v) => contractStage(v).label },
  { key: "status", label: "Status", group: "Contract", kind: "select" },
  { key: "contract_type", label: "Type", group: "Contract", kind: "select" },
  { key: "delivery_method", label: "Delivery method", group: "Contract", kind: "select" },
  { key: "supply_only", label: "Supply only", group: "Contract", kind: "bool" },
  { key: "on_hold", label: "On hold", group: "Contract", kind: "bool" },
  { key: "contract_cancelled", label: "Cancelled", group: "Contract", kind: "bool" },
  { key: "source", label: "Source", group: "Source", kind: "select" },
  { key: "salesman", label: "Salesperson", group: "Source", kind: "select" },
  { key: "sales_area", label: "Sales area", group: "Source", kind: "select" },
  { key: "sales_director", label: "Sales director", group: "Source", kind: "select" },
  { key: "installation_manager", label: "Install manager", group: "Fitting", kind: "select" },
  { key: "signboard_left", label: "Signboard left", group: "Fitting", kind: "bool" },
  { key: "send_letters_to_fitting", label: "Letters to site", group: "Fitting", kind: "bool" },
  { key: "site_same_as_customer", label: "Same as customer", group: "Customer", kind: "bool" },
  { key: "invoice_same_as_customer", label: "Invoice same as customer", group: "Customer", kind: "bool" },
];
const FILTER_GROUPS = ["Contract", "Customer", "Source", "Fitting"];

// MUST mirror the server's VALUE_FILTER_COLUMNS allowlist in lib/data/contracts
// — a key here that the server doesn't allow silently does nothing.
const VALUE_FIELD_KEYS = [
  "stage", "status", "contract_type", "source", "salesman",
  "sales_area", "sales_director", "installation_manager", "delivery_method",
  "office_reference", "office_reference_2", "notes",
  "site_town", "site_postcode", "site_street",
  "invoice_name", "invoice_town", "invoice_postcode",
  "guarantee_number", "insurance_backed_guarantee_ref",
  "hold_reason", "cancel_reason", "fitting_directions",
];

const CONTRACTS_SPEC: ListSpec<ContractRow, ContractFilters> = {
  name: "contracts",
  layoutKey: "contracts_columns",
  columns: COLUMNS,
  groupOrder: GROUP_ORDER,
  defaultVisible: DEFAULT_VISIBLE,
  // Customer name lives on the embed and the composite cells span several
  // fields — no single contract column to ORDER BY.
  noSort: ["customer", "address", "customer_address", "customer_town", "customer_postcode", "lead_ref"],
  filters: FILTERS,
  filterGroups: FILTER_GROUPS,
  valueFieldKeys: VALUE_FIELD_KEYS,
  noun: "contracts",
  rowId: (ct) => ct.id,
  rowHref: (ct) => `/contracts/${ct.id}`,
  record: (ct) => ct.record,
  loadRows: loadContractRows,
};

export function ContractColumnsProvider({
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
    <DataListProvider persist={persist} spec={CONTRACTS_SPEC} saved={saved}>
      {children}
    </DataListProvider>
  );
}

// The board reuses the same column registry as the field catalogue — the card
// hints (cardCell/cardHeader/cardBare) already live on those columns.
const CONTRACTS_CARD_SPEC: CardFieldsSpec<ContractRow> = {
  name: "contracts",
  layoutKey: "contracts_card_fields",
  fields: COLUMNS,
  groupOrder: GROUP_ORDER,
  defaultVisible: DEFAULT_CARD_FIELDS,
  record: (ct) => ct.record,
};

export function ContractCardFieldsProvider({
  saved,
  children,
}: {
  saved: Record<string, unknown> | null;
  children: React.ReactNode;
}) {
  return (
    <CardFieldsProvider spec={CONTRACTS_CARD_SPEC} saved={saved}>
      {children}
    </CardFieldsProvider>
  );
}

export function ContractTable(props: {
  initialViews: ContractRow[];
  total: number;
  filters: ContractFilters;
  sort: string | null;
  dir: "asc" | "desc";
}) {
  return <DataTable {...props} />;
}

export { ColumnsButton, FiltersButton } from "@/components/crm/data-list";
export { CardFieldsButton } from "@/components/crm/card-fields";
