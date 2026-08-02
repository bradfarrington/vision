import { createClient } from "@/lib/supabase/server";
import { CONTRACT_STAGES, isOpenContract } from "@/lib/contracts";
import { contractRef, leadRef } from "@/lib/leads";
import { isCommercial } from "@/lib/format";
import {
  DOCUMENT_SELECT,
  DOCUMENT_SELECT_BASE,
  mapDocumentRow,
  selectWithFallback,
  type DocumentItem,
} from "./documents";
import { NOTE_SELECT, NOTE_SELECT_BASE, mapNoteRow, type NoteItem } from "./notes";
import type { AddressParts } from "./leads";

// Contract columns a user may filter the list by, applied server-side so paging
// and counts stay correct. Allowlisted (never interpolated from input) — the
// value is bound by PostgREST. Selects match an exact value; bools yes/no.
export const SELECT_FILTER_COLUMNS = [
  "stage",
  "status",
  "contract_type",
  "source",
  "salesman",
  "sales_area",
  "sales_director",
  "installation_manager",
  "delivery_method",
] as const;

export const BOOL_FILTER_COLUMNS = [
  "supply_only",
  "on_hold",
  "contract_cancelled",
  "signboard_left",
  "site_same_as_customer",
  "invoice_same_as_customer",
  "send_letters_to_fitting",
] as const;

// Text contract columns the advanced value-filter builder may query. MUST stay
// mirrored with the client spec's `valueFieldKeys`, or a condition silently
// does nothing.
export const VALUE_FILTER_COLUMNS = new Set<string>([
  "stage", "status", "contract_type", "source", "salesman",
  "sales_area", "sales_director", "installation_manager", "delivery_method",
  "office_reference", "office_reference_2", "notes",
  "site_house_name", "site_house_number", "site_street",
  "site_locality", "site_town", "site_county", "site_postcode", "site_what_3_words",
  "invoice_name", "invoice_house_name", "invoice_house_number", "invoice_street",
  "invoice_locality", "invoice_town", "invoice_county", "invoice_postcode",
  "guarantee_number", "insurance_backed_guarantee_ref",
  "hold_reason", "cancel_reason", "balance_reason", "fitting_directions",
]);

export type ValueCondition = { f: string; op: string; v: string };

// Escape LIKE metacharacters so a user's % or _ is matched literally.
function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, "\\$&");
}

// Real contract columns the list may be ORDERED by (allowlisted — never an
// interpolated name). Computed/composite columns (customer name, the joined
// address, the stage badge) aren't here.
const SORTABLE_COLUMNS = new Set<string>([
  "contract_number", "stage", "status", "contract_date",
  "survey_date", "order_date", "install_start_date", "install_end_date", "completed_date",
  "gross_value", "contract_type", "source", "salesman",
  "sales_area", "sales_director", "installation_manager", "delivery_method",
  "estimated_fitting_days", "supply_only", "on_hold", "contract_cancelled",
  "office_reference", "office_reference_2",
  "site_house_name", "site_house_number", "site_street",
  "site_locality", "site_town", "site_county", "site_postcode",
  "guarantee_number", "guarantee_date", "signboard_left", "signboard_date",
  "cancel_date", "hold_date_on", "hold_date_off", "created_at",
]);

// Chunk size for the list's infinite scroll — same reasoning as the leads list.
export const CONTRACTS_PAGE_SIZE = 40;

export type ContractRow = {
  id: string;
  ref: string;
  contractNumber: number | null;
  title: string;
  stage: string | null;
  value: number | null;
  source: string | null;
  salesman: string | null;
  contractDate: string | null;
  customerId: string | null;
  customerName: string;
  customerTown: string | null;
  /** SITE address street line (falls back to the customer's when same-as). */
  addressLine: string | null;
  /** The CUSTOMER's own (main) address street line, regardless of the site. */
  customerAddressLine: string | null;
  /** The lead this contract was converted from, for the "from L-2103" line. */
  leadId: string | null;
  leadRef: string | null;
  open: boolean;
  // Every raw contract column, so the configurable columns can render any field
  // without threading each one through a typed property.
  record: Record<string, unknown>;
};

export type ContractFilters = {
  search?: string;
  stage?: string;
  page?: number;
  /**
   * Date-range bounds on `contract_date` (when the contract was signed — the
   * column the list is ordered by, so it's the one a range is about).
   * `dateTo` is EXCLUSIVE (see lib/date-range).
   */
  dateFrom?: string;
  dateTo?: string;
  /** Allowlisted contract-column filters, keyed by column name. */
  columnFilters?: Record<string, string>;
  /** Advanced field/operator/value conditions, ANDed together. */
  valueFilters?: ValueCondition[];
  /** Column to order by (allowlisted; ignored otherwise) and direction. */
  sort?: string;
  dir?: "asc" | "desc";
  /** Rows per page. Defaults to the list's chunk; the board uses its own. */
  pageSize?: number;
  /** Skip the header aggregates — the board runs one query PER COLUMN. */
  skipAggregates?: boolean;
};

export type StageBucket = { key: string; count: number; value: number };

export type ContractListResult = {
  rows: ContractRow[];
  total: number;
  page: number;
  pageCount: number;
  pipeline: StageBucket[];
  /** Distinct values per select-filter column, for the Filters popover. */
  filterOptions: Record<string, string[]>;
};

const CUSTOMER_EMBED = `customers(id, first_name, last_name, company_name, customer_type,
  house_name, house_number, street, town, county, postcode)`;

const LEAD_EMBED = `leads(id, lead_number, product_type, product_interest_1)`;

type RawContract = Record<string, unknown> & {
  id: string;
  contract_number: number | null;
  stage: string | null;
  gross_value: number | null;
  contract_type: string | null;
  source: string | null;
  salesman: string | null;
  contract_date: string | null;
  customer_id: string | null;
  lead_id: string | null;
  site_same_as_customer: boolean | null;
  site_house_name: string | null;
  site_house_number: string | null;
  site_street: string | null;
  customers: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    customer_type: string | null;
    house_name: string | null;
    house_number: string | null;
    street: string | null;
    town: string | null;
    county: string | null;
    postcode: string | null;
  } | null;
  leads: {
    id: string;
    lead_number: number | null;
    product_type: string | null;
    product_interest_1: string | null;
  } | null;
};

function toContractRow(ct: RawContract): ContractRow {
  const { customers: c, leads: l, ...rest } = ct;
  const customerName = c
    ? isCommercial(c.customer_type) && c.company_name
      ? c.company_name
      : [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
        c.company_name ||
        "Unknown"
    : "Unknown customer";

  // The SITE address (where the work happens) is the contract's own unless it
  // mirrors the customer's. The contract OWNS its copy — see AGENTS.md § Site
  // address: a later edit to the lead must not rewrite a signed contract.
  const useCustomerAddr = ct.site_same_as_customer !== false;
  const street = useCustomerAddr && c
    ? [c.house_name, c.house_number, c.street]
    : [ct.site_house_name, ct.site_house_number, ct.site_street];
  const customerStreet = c
    ? [c.house_name, c.house_number, c.street].filter(Boolean).join(" ").trim() || null
    : null;

  // The list's generic columns read from `record`, so customer- and lead-derived
  // values are folded in under their own keys rather than left on the embeds.
  const record: Record<string, unknown> = {
    ...rest,
    customer_name: customerName,
    customer_town: useCustomerAddr ? (c?.town ?? null) : (rest.site_town ?? null),
    customer_postcode: useCustomerAddr ? (c?.postcode ?? null) : (rest.site_postcode ?? null),
    lead_ref: l?.lead_number != null ? leadRef(l.lead_number) : null,
  };

  return {
    id: ct.id,
    ref: contractRef(ct.contract_number),
    contractNumber: ct.contract_number,
    // A contract has no title column of its own: its subject is what was sold,
    // which is the contract type, falling back to the originating lead's
    // product so a contract raised before a type was set still reads sensibly.
    title: ct.contract_type ?? l?.product_type ?? l?.product_interest_1 ?? "Contract",
    stage: ct.stage,
    value: ct.gross_value,
    source: ct.source,
    salesman: ct.salesman,
    contractDate: ct.contract_date,
    customerId: ct.customer_id,
    customerName,
    customerTown: (record.customer_town as string | null) ?? null,
    addressLine: street.filter(Boolean).join(" ").trim() || null,
    customerAddressLine: customerStreet,
    leadId: ct.lead_id,
    leadRef: l?.lead_number != null ? leadRef(l.lead_number) : null,
    open: isOpenContract(ct.stage),
    record,
  };
}

/**
 * Resolve the free-text term into the pieces a query needs. The customer id
 * lookup is async, so it happens ONCE here rather than inside the filter
 * application — which both getContracts and getContractPipeline call.
 */
async function resolveSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  term: string | undefined,
): Promise<{ term: string; customerIds: string[] } | null> {
  const q = term?.trim();
  if (!q) return null;
  return { term: q, customerIds: await searchCustomerIds(supabase, q) };
}

/**
 * Apply every filter to a contracts query. THE one place this happens — the
 * list, the board's columns and the pipeline aggregates all go through here, so
 * a stage tile can never count a different set than the rows beneath it. (Same
 * rule, and the same reason, as applyLeadFilters.)
 *
 * Every column name is allowlisted and never interpolated; every value is
 * PostgREST-bound.
 */
function applyContractFilters<Q>(
  query: Q,
  filters: ContractFilters,
  search: { term: string; customerIds: string[] } | null,
): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;

  if (filters.stage) q = q.eq("stage", filters.stage);

  // Date range on contract_date. Applied at the DB so paging and the exact
  // count stay correct. `lt` (not `lte`) on the upper bound: it is the first
  // instant AFTER the last day, so the whole final day is included.
  if (filters.dateFrom) q = q.gte("contract_date", filters.dateFrom);
  if (filters.dateTo) q = q.lt("contract_date", filters.dateTo);

  if (search) {
    const like = orValue(`%${search.term}%`);
    // Numeric contract ref search when the query is a number ("C-1892"/"1892").
    const asNumber = Number(search.term.replace(/^c-?/i, ""));
    const parts = [
      `contract_type.ilike.${like}`,
      `source.ilike.${like}`,
      `salesman.ilike.${like}`,
      `installation_manager.ilike.${like}`,
      `site_house_name.ilike.${like}`,
      `site_street.ilike.${like}`,
      `site_town.ilike.${like}`,
      `site_postcode.ilike.${like}`,
      `office_reference.ilike.${like}`,
      `office_reference_2.ilike.${like}`,
      `guarantee_number.ilike.${like}`,
    ];
    if (Number.isFinite(asNumber)) parts.push(`contract_number.eq.${asNumber}`);
    // The customer's NAME and ADDRESS live on the embedded `customers` row, and
    // PostgREST can't OR an embedded column against the parent's in one query,
    // so their ids were resolved up front (see resolveSearch).
    if (search.customerIds.length) parts.push(`customer_id.in.(${search.customerIds.join(",")})`);
    q = q.or(parts.join(","));
  }

  // Allowlisted contract-column filters.
  const cf = filters.columnFilters ?? {};
  for (const col of SELECT_FILTER_COLUMNS) {
    const v = cf[col];
    if (v) q = q.eq(col, v);
  }
  for (const col of BOOL_FILTER_COLUMNS) {
    const v = cf[col];
    if (v === "1" || v === "0") q = q.eq(col, v === "1");
  }

  // Advanced field/operator/value conditions — each ANDs onto the query.
  for (const c of filters.valueFilters ?? []) {
    if (!VALUE_FILTER_COLUMNS.has(c.f)) continue;
    const v = (c.v ?? "").trim();
    switch (c.op) {
      case "contains": if (v) q = q.ilike(c.f, `%${escapeLike(v)}%`); break;
      case "equals": if (v) q = q.ilike(c.f, escapeLike(v)); break;
      case "begins": if (v) q = q.ilike(c.f, `${escapeLike(v)}%`); break;
      case "ends": if (v) q = q.ilike(c.f, `%${escapeLike(v)}`); break;
      case "empty": q = q.is(c.f, null); break;
      case "notempty": q = q.not(c.f, "is", null); break;
    }
  }

  return q as Q;
}

/**
 * Paginated, filtered contracts for the list screen, plus stage aggregates. RLS
 * scopes every read to the caller's tenant. Selects `*` so the configurable
 * columns can render any contract field without a per-column query change.
 */
export async function getContracts(filters: ContractFilters = {}): Promise<ContractListResult> {
  const supabase = await createClient();
  const size = filters.pageSize ?? CONTRACTS_PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * size;
  const to = from + size - 1;

  const search = await resolveSearch(supabase, filters.search);

  let query = supabase
    .from("contracts")
    .select(`*, ${CUSTOMER_EMBED}, ${LEAD_EMBED}`, { count: "exact" });

  // Sort: an allowlisted column asc/desc, else contract number ascending — the
  // same default the list screen sends, so every caller agrees on "unsorted". A
  // stable secondary key (id) keeps paging deterministic when the column ties.
  if (filters.sort && SORTABLE_COLUMNS.has(filters.sort)) {
    query = query
      .order(filters.sort, { ascending: filters.dir !== "desc", nullsFirst: false })
      .order("id", { ascending: true });
  } else {
    query = query
      .order("contract_number", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });
  }
  query = query.range(from, to);
  query = applyContractFilters(query, filters, search);

  const { data, count, error } = await query;
  if (error) throw new Error(`getContracts: ${error.message}`);

  const rows = ((data ?? []) as unknown as RawContract[]).map(toContractRow);
  const total = count ?? rows.length;

  // The board asks for one column at a time and needs none of these; fetching
  // them per column would run them all seven times for one screen.
  if (filters.skipAggregates) {
    return {
      rows,
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / size)),
      pipeline: [],
      filterOptions: {},
    };
  }

  const [pipeline, filterOptions] = await Promise.all([
    getContractPipeline(supabase, filters, search),
    getFilterOptions(supabase),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / size)),
    pipeline,
    filterOptions,
  };
}

// ---------------------------------------------------------------------------
// Kanban board
//
// The board is the same query as the list, run once PER STAGE — the same shape
// as the leads board, and for the same reason: a first page dominated by
// "Signed" would leave "Installation" looking empty when it isn't.

/** Cards loaded per column at a time. A column scrolls for the rest. */
export const BOARD_COLUMN_SIZE = 25;

export type BoardColumn = {
  key: string;
  label: string;
  /** Every contract in this stage matching the filters, not just the loaded. */
  total: number;
  /** Summed value of ALL of them, from the pipeline aggregate. */
  value: number;
  cards: ContractRow[];
  hasMore: boolean;
};

/**
 * One page of one stage's cards. Reuses `getContracts` wholesale — same
 * allowlisted filter/sort/search path — with the stage pinned, so a board
 * column can never drift from what the list would show for that stage.
 */
export async function getBoardColumn(
  filters: ContractFilters,
  stage: string,
  page = 1,
): Promise<{ cards: ContractRow[]; total: number; hasMore: boolean }> {
  const { rows, total } = await getContracts({
    ...filters,
    stage,
    page,
    pageSize: BOARD_COLUMN_SIZE,
    skipAggregates: true,
  });
  return { cards: rows, total, hasMore: page * BOARD_COLUMN_SIZE < total };
}

/**
 * Every column's first page, in stepper order, plus the aggregates the page
 * header needs — returned in the SAME shape the list returns them, so one
 * summary component serves both views.
 */
export async function getContractBoard(filters: ContractFilters): Promise<{
  columns: BoardColumn[];
  filterOptions: Record<string, string[]>;
  pipeline: StageBucket[];
  total: number;
}> {
  const supabase = await createClient();
  const search = await resolveSearch(supabase, filters.search);

  const [pipeline, filterOptions, ...pages] = await Promise.all([
    // Values per stage come from the aggregate, so a column header states the
    // whole stage's worth — not just the 25 cards that happen to be loaded.
    getContractPipeline(supabase, filters, search),
    getFilterOptions(supabase),
    // The BOARD iterates every stage including cancelled: a kanban must have
    // somewhere to drop each state, even one the stepper leaves out.
    ...CONTRACT_STAGES.map((s) => getBoardColumn(filters, s.key)),
  ]);

  const valueOf = new Map(pipeline.map((b) => [b.key, b.value]));
  const columns = CONTRACT_STAGES.map((s, i) => {
    const page = pages[i] as { cards: ContractRow[]; total: number; hasMore: boolean };
    return {
      key: s.key,
      label: s.label,
      total: page.total,
      value: valueOf.get(s.key) ?? 0,
      cards: page.cards,
      hasMore: page.hasMore,
    };
  });

  return {
    columns,
    filterOptions,
    pipeline,
    total: columns.reduce((n, c) => n + c.total, 0),
  };
}

/** Per-stage contract counts + summed value, honouring the current filters. */
export async function getContractPipeline(
  supabase?: Awaited<ReturnType<typeof createClient>>,
  filters: ContractFilters = {},
  search?: { term: string; customerIds: string[] } | null,
): Promise<StageBucket[]> {
  const client = supabase ?? (await createClient());
  // The tiles must agree with the rows beneath them. So this runs through the
  // SAME applyContractFilters as the rows, with ONE exception: the stage
  // selection is dropped, because the board pins stage per column and applying
  // it would make every column report the same one.
  const { stage: _stage, ...rest } = filters;
  void _stage;
  const resolved =
    search !== undefined ? search : await resolveSearch(client, filters.search);
  const q = applyContractFilters(
    client.from("contracts").select("stage, gross_value"),
    rest,
    resolved,
  );
  const { data, error } = await q;
  if (error) throw new Error(`getContractPipeline: ${error.message}`);

  const buckets = new Map<string, StageBucket>();
  for (const row of data ?? []) {
    const key = row.stage ?? "signed";
    const value = Number(row.gross_value ?? 0);
    const b = buckets.get(key) ?? { key, count: 0, value: 0 };
    b.count += 1;
    b.value += value;
    buckets.set(key, b);
  }
  return [...buckets.values()];
}

/**
 * Quote a value for a PostgREST `or()` term. The filter string is comma- and
 * paren-delimited, so an unquoted search for "Smith, J" or "Unit 4 (rear)"
 * silently produces a malformed filter.
 */
function orValue(v: string): string {
  return `"${v.replace(/[\\"]/g, "\\$&")}"`;
}

/** Customer columns a contract search matches on — the person and where they live. */
const CUSTOMER_SEARCH_COLUMNS = [
  "first_name", "last_name", "first_name_2", "last_name_2", "company_name",
  "house_name", "house_number", "street", "locality", "town", "county", "postcode",
  "email", "mobile", "home_telephone",
];

/**
 * Ids of customers matching a free-text term, for folding into the search.
 * CAPPED, and FAILS SOFT — a failure here must not take the whole list down.
 */
const CUSTOMER_SEARCH_CAP = 2000;

async function searchCustomerIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  term: string,
): Promise<string[]> {
  const like = orValue(`%${term}%`);
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .or(CUSTOMER_SEARCH_COLUMNS.map((c) => `${c}.ilike.${like}`).join(","))
    .limit(CUSTOMER_SEARCH_CAP);
  if (error) return [];
  return (data ?? []).map((r) => r.id);
}

/**
 * Distinct values for each select-filter column, so the Filters popover can
 * offer real choices. One capped read rather than a query per column.
 */
async function getFilterOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Record<string, string[]>> {
  const cols = SELECT_FILTER_COLUMNS.join(", ");
  const { data } = await supabase.from("contracts").select(cols).limit(5000);

  const sets: Record<string, Set<string>> = {};
  for (const col of SELECT_FILTER_COLUMNS) sets[col] = new Set();
  for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
    for (const col of SELECT_FILTER_COLUMNS) {
      const v = r[col];
      if (typeof v === "string" && v.trim()) sets[col].add(v);
    }
  }
  return Object.fromEntries(
    SELECT_FILTER_COLUMNS.map((c) => [c, [...sets[c]].sort((a, b) => a.localeCompare(b))]),
  );
}

// ---------------------------------------------------------------------------
// The record

export type ContractProduct = {
  id: string;
  name: string;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
};

export type ContractChecklistItem = {
  id: number;
  action_name: string;
  status: string | null;
  due_date: string | null;
  priority: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
};

export type FinanceLine = {
  id: string;
  lineType: string;
  chargeAmount: number | null;
  paymentAmount: number | null;
  paymentMethod: string | null;
  invoiceNumber: string | null;
  invoiceDetails: string | null;
  paymentDate: string | null;
  notes: string | null;
};

export type ContractDetail = {
  id: string;
  contractNumber: number | null;
  ref: string;
  stage: string | null;
  status: string | null;
  title: string;
  value: number | null;
  contractDate: string | null;
  contractType: string | null;
  source: string | null;
  salesman: string | null;
  salesArea: string | null;
  salesDirector: string | null;
  installationManager: string | null;
  estimatedFittingDays: number | null;
  installationCompleted: string | null;
  deliveryMethod: string | null;
  supplyOnly: boolean;
  onHold: boolean;
  holdReason: string | null;
  cancelled: boolean;
  cancelReason: string | null;
  guaranteeNumber: string | null;
  guaranteeDate: string | null;
  insuranceBackedGuaranteeRef: string | null;
  signboardLeft: boolean;
  signboardDate: string | null;
  officeReference: string | null;
  officeReference2: string | null;
  notes: string | null;
  /** Stage dates, for the stepper. */
  surveyDate: string | null;
  orderDate: string | null;
  installStartDate: string | null;
  installEndDate: string | null;
  completedDate: string | null;
  /** Site address — where the work happens. Owned by the contract. */
  site: AddressParts;
  siteSameAsCustomer: boolean;
  siteDirections: string | null;
  invoiceSameAsCustomer: boolean;
  invoice: AddressParts;
  invoiceName: string | null;
  customer: {
    id: string;
    name: string;
    address: AddressParts;
    whatThreeWords: string | null;
    email: string | null;
    mobile: string | null;
    home: string | null;
  } | null;
  /** The lead this was converted from — the record's provenance line. */
  lead: { id: string; ref: string; leadNumber: number | null } | null;
  products: ContractProduct[];
  financeLines: FinanceLine[];
  /** Contract value minus everything recorded as paid. */
  paid: number;
  balance: number;
  checklist: ContractChecklistItem[];
  noteThread: NoteItem[];
  /**
   * Documents reachable from this contract: its own plus the owning customer's,
   * so an existing file can be attached instead of re-uploaded (the same
   * duplicate-free path the lead and customer records offer).
   */
  documents: DocumentItem[];
};

function addr(parts: {
  house_name?: string | null;
  house_number?: string | null;
  street?: string | null;
  locality?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
  what_3_words?: string | null;
}): AddressParts {
  const line1 = [parts.house_name, parts.house_number, parts.street].filter(Boolean).join(" ").trim();
  const line2 = [parts.locality, parts.town, parts.county].filter(Boolean).join(", ");
  return {
    line1: line1 || null,
    line2: line2 || null,
    postcode: parts.postcode ?? null,
    whatThreeWords: parts.what_3_words ?? null,
    fields: {
      houseName: parts.house_name ?? null,
      houseNumber: parts.house_number ?? null,
      street: parts.street ?? null,
      locality: parts.locality ?? null,
      town: parts.town ?? null,
      county: parts.county ?? null,
      postcode: parts.postcode ?? null,
    },
  };
}

/** One contract with everything the detail screen needs. */
export async function getContract(id: string): Promise<ContractDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(
      `id, contract_number, stage, status, contract_date, contract_type, gross_value,
       source, salesman, sales_area, sales_director, installation_manager,
       estimated_fitting_days, installation_completed, delivery_method,
       supply_only, on_hold, hold_reason, contract_cancelled, cancel_reason,
       guarantee_number, guarantee_date, insurance_backed_guarantee_ref,
       signboard_left, signboard_date, office_reference, office_reference_2, notes,
       survey_date, order_date, install_start_date, install_end_date, completed_date,
       site_same_as_customer, site_house_name, site_house_number, site_street,
       site_locality, site_town, site_county, site_postcode, site_what_3_words,
       fitting_directions,
       invoice_same_as_customer, invoice_name, invoice_house_name, invoice_house_number,
       invoice_street, invoice_locality, invoice_town, invoice_county, invoice_postcode,
       customer_id, lead_id,
       customers(id, first_name, last_name, company_name, customer_type, house_name,
         house_number, street, locality, town, county, postcode, what_3_words,
         email, mobile, home_telephone),
       leads(id, lead_number),
       contract_products(id, product_name, description, quantity, unit_price, total_price),
       contract_checklist_items(id, action_name, status, due_date, priority,
         completed_at, completed_by_name),
       finance_lines(id, line_type, charge_amount, payment_amount, payment_method,
         invoice_number, invoice_details, payment_date, notes)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getContract: ${error.message}`);
  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ct = data as any;
  const c = ct.customers;
  const l = ct.leads;

  // Notes + documents are separate reads because they need the shared
  // stamped/versioned selects (with their author joins and their
  // pending-migration fallbacks), which don't compose into the embed above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from(t: string): any };
  const [notesRes, docsRes] = await Promise.all([
    selectWithFallback(
      () => db.from("lead_notes").select(NOTE_SELECT).eq("contract_id", id).or("category.is.null,category.neq.marketing").order("created_at", { ascending: false }),
      () => db.from("lead_notes").select(NOTE_SELECT_BASE).eq("contract_id", id).or("category.is.null,category.neq.marketing").order("created_at", { ascending: false }),
    ),
    c?.id
      ? selectWithFallback(
          () => db.from("documents").select(DOCUMENT_SELECT).or(`customer_id.eq.${c.id},contract_id.eq.${id}`).order("created_at", { ascending: false }),
          () => db.from("documents").select(DOCUMENT_SELECT_BASE).or(`customer_id.eq.${c.id},contract_id.eq.${id}`).order("created_at", { ascending: false }),
        )
      : selectWithFallback(
          () => db.from("documents").select(DOCUMENT_SELECT).eq("contract_id", id).order("created_at", { ascending: false }),
          () => db.from("documents").select(DOCUMENT_SELECT_BASE).eq("contract_id", id).order("created_at", { ascending: false }),
        ),
  ]);

  const customerName = c
    ? isCommercial(c.customer_type) && c.company_name
      ? c.company_name
      : [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.company_name || "Unknown"
    : "Unknown";

  const site = ct.site_same_as_customer && c
    ? addr(c)
    : addr({
        house_name: ct.site_house_name,
        house_number: ct.site_house_number,
        street: ct.site_street,
        locality: ct.site_locality,
        town: ct.site_town,
        county: ct.site_county,
        postcode: ct.site_postcode,
        what_3_words: ct.site_what_3_words,
      });

  const invoice = ct.invoice_same_as_customer && c
    ? addr(c)
    : addr({
        house_name: ct.invoice_house_name,
        house_number: ct.invoice_house_number,
        street: ct.invoice_street,
        locality: ct.invoice_locality,
        town: ct.invoice_town,
        county: ct.invoice_county,
        postcode: ct.invoice_postcode,
      });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const financeLines = ((ct.finance_lines ?? []) as any[]).map((f) => ({
    id: f.id,
    lineType: f.line_type,
    chargeAmount: f.charge_amount == null ? null : Number(f.charge_amount),
    paymentAmount: f.payment_amount == null ? null : Number(f.payment_amount),
    paymentMethod: f.payment_method ?? null,
    invoiceNumber: f.invoice_number ?? null,
    invoiceDetails: f.invoice_details ?? null,
    paymentDate: f.payment_date ?? null,
    notes: f.notes ?? null,
  }));
  // Balance is the contract value minus everything recorded as paid — the same
  // computation the customer record's Financials panel already does.
  const paid = financeLines.reduce((n, f) => n + (f.paymentAmount ?? 0), 0);
  const value = ct.gross_value == null ? null : Number(ct.gross_value);

  return {
    id: ct.id,
    contractNumber: ct.contract_number,
    ref: contractRef(ct.contract_number),
    stage: ct.stage,
    status: ct.status,
    title: ct.contract_type ?? "Contract",
    value,
    contractDate: ct.contract_date,
    contractType: ct.contract_type,
    source: ct.source,
    salesman: ct.salesman,
    salesArea: ct.sales_area,
    salesDirector: ct.sales_director,
    installationManager: ct.installation_manager,
    estimatedFittingDays: ct.estimated_fitting_days == null ? null : Number(ct.estimated_fitting_days),
    installationCompleted: ct.installation_completed,
    deliveryMethod: ct.delivery_method,
    supplyOnly: !!ct.supply_only,
    onHold: !!ct.on_hold,
    holdReason: ct.hold_reason,
    cancelled: !!ct.contract_cancelled,
    cancelReason: ct.cancel_reason,
    guaranteeNumber: ct.guarantee_number,
    guaranteeDate: ct.guarantee_date,
    insuranceBackedGuaranteeRef: ct.insurance_backed_guarantee_ref,
    signboardLeft: !!ct.signboard_left,
    signboardDate: ct.signboard_date,
    officeReference: ct.office_reference,
    officeReference2: ct.office_reference_2,
    notes: ct.notes,
    surveyDate: ct.survey_date,
    orderDate: ct.order_date,
    installStartDate: ct.install_start_date,
    installEndDate: ct.install_end_date,
    completedDate: ct.completed_date,
    site,
    siteSameAsCustomer: !!ct.site_same_as_customer,
    siteDirections: ct.fitting_directions,
    invoiceSameAsCustomer: !!ct.invoice_same_as_customer,
    invoice,
    invoiceName: ct.invoice_name,
    customer: c
      ? {
          id: c.id,
          name: customerName,
          address: addr(c),
          whatThreeWords: c.what_3_words ?? null,
          email: c.email ?? null,
          mobile: c.mobile ?? null,
          home: c.home_telephone ?? null,
        }
      : null,
    lead: l ? { id: l.id, ref: leadRef(l.lead_number), leadNumber: l.lead_number } : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: ((ct.contract_products ?? []) as any[]).map((p) => ({
      id: p.id,
      name: p.product_name,
      description: p.description ?? null,
      quantity: p.quantity ?? null,
      unitPrice: p.unit_price == null ? null : Number(p.unit_price),
      totalPrice: p.total_price == null ? null : Number(p.total_price),
    })),
    financeLines,
    paid,
    balance: (value ?? 0) - paid,
    checklist: ((ct.contract_checklist_items ?? []) as ContractChecklistItem[]).sort(
      (a, b) => (a.id ?? 0) - (b.id ?? 0),
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    noteThread: ((notesRes.data ?? []) as any[]).map(mapNoteRow),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documents: ((docsRes.data ?? []) as any[]).map(mapDocumentRow),
  };
}
