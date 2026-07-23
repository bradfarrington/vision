"use client";

import { CountPill } from "@/components/crm/primitives";
import { loadCustomerRows } from "@/app/(app)/customers/actions";
import {
  DataListProvider,
  DataTable,
  type FilterDef,
  type ListColumn,
  type ListSpec,
} from "@/components/crm/data-list";
import { cn } from "@/lib/utils";
import type { ActivityLine, CustomerFilters, CustomerRow } from "@/lib/data/customers";

// The customer list = a ListSpec fed to the shared machinery in `data-list.tsx`
// (columns popover + drag-reorder, resize, server sort, filters, infinite
// scroll). Only what makes this list ABOUT CUSTOMERS lives here: which fields
// exist, how they render, and where a row goes. See AGENTS.md § Lists & columns.

export type CustomerRowView = { c: CustomerRow; activity: ActivityLine };

type Column = ListColumn<CustomerRowView>;

// ---------------------------------------------------------------------------
// Column registry — one entry per showable field. Only the select box (left) and
// a trailing chevron are fixed; everything else is a registry column.
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

// Name-type fields render bold + near-black, matching the Name column, so a
// person's name reads as one identity wherever its parts are shown.
const NAME_CELL = "font-semibold text-[#0a0a0a]";

const COLUMNS: Column[] = [
  {
    key: "name",
    label: "Name",
    group: "Identity",
    w: NAME,
    sortField: "last_name",
    cell: (v) => (
      <span className="block min-w-0 truncate font-semibold text-[#0a0a0a]">{v.c.displayName}</span>
    ),
  },

  // Identity
  { key: "title", label: "Title", group: "Identity", w: SHORT, cellClassName: NAME_CELL },
  { key: "first_name", label: "First name", group: "Identity", w: TEXT, cellClassName: NAME_CELL },
  { key: "last_name", label: "Last name", group: "Identity", w: TEXT, cellClassName: NAME_CELL },
  { key: "title_2", label: "Title (2nd)", group: "Identity", w: SHORT, cellClassName: NAME_CELL },
  { key: "first_name_2", label: "First name (2nd)", group: "Identity", w: TEXT, cellClassName: NAME_CELL },
  { key: "last_name_2", label: "Last name (2nd)", group: "Identity", w: TEXT, cellClassName: NAME_CELL },
  { key: "salutation", label: "Salutation", group: "Identity", w: TEXT, cellClassName: NAME_CELL },
  { key: "company_name", label: "Company", group: "Identity", w: TEXT, cellClassName: NAME_CELL },
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
  { key: "mobile", label: "Mobile", group: "Contact", w: TEXT },
  { key: "mobile_2", label: "Mobile (2nd)", group: "Contact", w: TEXT },
  { key: "home_telephone", label: "Home", group: "Contact", w: TEXT },
  { key: "work_telephone", label: "Work", group: "Contact", w: TEXT },
  { key: "fax_alt_no", label: "Fax / alt", group: "Contact", w: TEXT },
  { key: "no_whatsapp", label: "No WhatsApp", group: "Contact", w: BOOL, kind: "bool" },

  // Address
  {
    // Just the street line — Town and Postcode are their own columns, so the
    // second line here only duplicated them and doubled the row height.
    key: "address",
    label: "Address",
    group: "Address",
    w: ADDR,
    cell: (v) => <span className="block truncate text-[#3f3f46]">{v.c.addressLine ?? "—"}</span>,
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
    // One line: primary then the muted date, so this cell doesn't force a
    // two-line row height.
    cell: (v) => (
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span
          className={cn(
            "truncate",
            v.activity.amber ? "font-semibold text-[#b86e00]" : "font-medium text-[#3f3f46]",
          )}
        >
          {v.activity.primary}
        </span>
        <span className="shrink-0 text-[11.5px] text-[#a1a1aa]">{v.activity.secondary}</span>
      </span>
    ),
  },
  { key: "created", label: "Added", group: "Activity", w: DATE, field: "created_at", kind: "date" },
];

// ---------------------------------------------------------------------------
// Filters — data-driven over the customer fields; all URL-param-driven
// (`f_<key>`), except lead-derived "Has live lead" (`live`).
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

// Advanced value-filter builder — field + operator + value, ANDed. Field list
// mirrors the server's VALUE_FILTER_COLUMNS allowlist; labels come from the
// column registry so they read the same as the headers.
const VALUE_FIELD_KEYS = [
  "first_name", "last_name", "company_name", "salutation",
  "email", "mobile", "mobile_2", "home_telephone", "work_telephone", "fax_alt_no",
  "house_name", "house_number", "street", "locality", "town", "county", "postcode", "what_3_words",
  "customer_type", "property_type", "payment_terms", "sales_manager", "marketing_code",
  "vat_no", "cis_reg", "default_account_reference", "invoice_name", "office_ref_1", "office_ref_2",
  "directions", "flash_note", "opted_in_by",
];

const GROUP_ORDER = ["Identity", "Contact", "Address", "Marketing", "Flags", "Account", "Activity"];
// New columns default HIDDEN — a release must not force a column into everyone's view.
const DEFAULT_VISIBLE = ["name", "address", "town", "postcode", "mobile", "leads", "contracts", "activity"];

const CUSTOMERS_SPEC: ListSpec<CustomerRowView, CustomerFilters> = {
  name: "customers",
  layoutKey: "customers_columns",
  columns: COLUMNS,
  groupOrder: GROUP_ORDER,
  defaultVisible: DEFAULT_VISIBLE,
  // Computed/composite — no single DB column to ORDER BY. (Name is preset to
  // last_name in the registry above.)
  noSort: ["address", "leads", "contracts", "activity"],
  filters: FILTERS,
  filterGroups: FILTER_GROUPS,
  valueFieldKeys: VALUE_FIELD_KEYS,
  // Lead-derived, so it can't be a `customers` predicate without an inner join
  // — it stays a post-filter, with the known caveat that the total reflects the
  // pre-filter set.
  extraBoolFilter: { param: "live", label: "Has live lead" },
  noun: { one: "customer", many: "customers" },
  rowId: (v) => v.c.id,
  rowHref: (v) => `/customers/${v.c.id}`,
  record: (v) => v.c.record,
  loadRows: loadCustomerRows,
};

export function CustomerColumnsProvider({
  saved,
  children,
}: {
  saved: Record<string, unknown> | null;
  children: React.ReactNode;
}) {
  return (
    <DataListProvider spec={CUSTOMERS_SPEC} saved={saved}>
      {children}
    </DataListProvider>
  );
}

export function CustomerTable(props: {
  initialViews: CustomerRowView[];
  total: number;
  filters: CustomerFilters;
  sort: string | null;
  dir: "asc" | "desc";
}) {
  return <DataTable {...props} />;
}

export { ColumnsButton, FiltersButton } from "@/components/crm/data-list";

// ---------------------------------------------------------------------------
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function titleCase(v: string | null): string | null {
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1);
}
