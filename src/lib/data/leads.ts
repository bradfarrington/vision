import { createClient } from "@/lib/supabase/server";
import { LEAD_STAGES, isLiveLead, leadRef } from "@/lib/leads";
import { isCommercial } from "@/lib/format";
import {
  DOCUMENT_SELECT,
  DOCUMENT_SELECT_BASE,
  mapDocumentRow,
  selectWithFallback,
  type DocumentItem,
} from "./documents";
import { NOTE_SELECT, NOTE_SELECT_BASE, mapNoteRow, type NoteItem } from "./notes";

// Lead columns a user may filter the list by, applied server-side so paging and
// counts stay correct. Allowlisted (never interpolated from input) — the value
// is bound by PostgREST. Selects match an exact value; bools match yes/no.
export const SELECT_FILTER_COLUMNS = [
  "status",
  "result",
  "source",
  "sub_source",
  "product_type",
  "salesman",
  "salesperson_type",
  "quote_type",
  "payment_method",
  "priority",
  "sales_area",
  "contract_type",
] as const;

export const BOOL_FILTER_COLUMNS = [
  "supply_only",
  "on_hold",
  "contract_cancelled",
  "site_same_as_customer",
] as const;

// Text lead columns the advanced value-filter builder may query. Allowlisted —
// the column name is never interpolated from input, and the value is bound by
// PostgREST (plus LIKE metacharacters are escaped).
export const VALUE_FILTER_COLUMNS = new Set<string>([
  "status", "result", "result_reason", "priority",
  "source", "sub_source", "product_type", "product_interest_1", "product_interest_2",
  "salesman", "salesperson_type", "quote_type", "payment_method",
  "office_reference", "office_reference_2", "notes",
  "site_house_name", "site_house_number", "site_street",
  "site_locality", "site_town", "site_county",
  "site_postcode", "site_what_3_words",
  "sales_area", "sales_director", "contract_type", "delivery_method",
  "installation_manager", "hold_reason", "cancel_reason",
]);

export type ValueCondition = { f: string; op: string; v: string };

// Escape LIKE metacharacters so a user's % or _ is matched literally.
function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, "\\$&");
}

// Real lead columns the list may be ORDERED by (allowlisted — never an
// interpolated name). Computed/composite columns (customer name, the joined
// address, the stage badge) aren't here.
const SORTABLE_COLUMNS = new Set<string>([
  "lead_number", "status", "result", "result_date", "result_reason", "priority",
  "gross_value", "estimated_value", "window_count",
  "source", "sub_source", "product_type", "product_interest_1", "product_interest_2",
  "salesman", "salesperson_type", "quote_type", "quote_date", "payment_method",
  "lead_date", "follow_up_date", "created_at",
  "office_reference", "office_reference_2",
  "site_house_name", "site_house_number", "site_street",
  "site_locality", "site_town", "site_county",
  "site_postcode",
  "sales_area", "sales_director", "contract_type", "delivery_method",
  "installation_manager", "supply_only", "on_hold", "contract_cancelled",
  "contract_number", "contract_date",
]);

// Chunk size for the list's infinite scroll — big enough to fill a tall
// container on first load, small enough to keep each fetch cheap at scale.
export const LEADS_PAGE_SIZE = 40;

export type LeadRow = {
  id: string;
  ref: string;
  leadNumber: number | null;
  title: string;
  status: string | null;
  value: number | null;
  source: string | null;
  subSource: string | null;
  salesman: string | null;
  leadDate: string | null;
  followUpDate: string | null;
  quoteDate: string | null;
  customerId: string | null;
  customerName: string;
  customerTown: string | null;
  /** SITE address street line — the installation/fitting address (falls back to
   *  the customer's when the lead is marked "same as customer"). */
  addressLine: string | null;
  /** The CUSTOMER's own (main) address street line, regardless of the site. */
  customerAddressLine: string | null;
  live: boolean;
  // Every raw lead column, so the list's configurable columns can render any
  // field without threading each one through a typed property.
  record: Record<string, unknown>;
};

export type LeadFilters = {
  search?: string;
  stage?: string;
  source?: string;
  page?: number;
  /**
   * Date-range bounds on `lead_date` (when the enquiry arrived — the date the
   * list is ordered by, so it's the one a range means). Resolved from the URL's
   * `range` preset by the page; `dateTo` is EXCLUSIVE (see lib/date-range).
   */
  dateFrom?: string;
  dateTo?: string;
  /** Allowlisted lead-column filters, keyed by column name (see *_FILTER_COLUMNS). */
  columnFilters?: Record<string, string>;
  /** Advanced field/operator/value conditions, ANDed together. */
  valueFilters?: ValueCondition[];
  /** Column to order by (allowlisted; ignored otherwise) and direction. */
  sort?: string;
  dir?: "asc" | "desc";
  /** Rows per page. Defaults to the list's chunk; the board uses its own. */
  pageSize?: number;
  /**
   * Skip the header aggregates (sources / pipeline / filter options). The board
   * runs one query PER COLUMN and needs none of them — without this it would
   * refetch all three six times over.
   */
  skipAggregates?: boolean;
};

export type StageBucket = { key: string; count: number; value: number };

export type LeadListResult = {
  rows: LeadRow[];
  total: number;
  page: number;
  pageCount: number;
  sources: string[];
  pipeline: StageBucket[];
  /** Distinct values per select-filter column, for the Filters popover. */
  filterOptions: Record<string, string[]>;
};

const CUSTOMER_EMBED = `customers(id, first_name, last_name, company_name, customer_type,
  house_name, house_number, street, town, county, postcode)`;

type RawLead = Record<string, unknown> & {
  id: string;
  lead_number: number | null;
  status: string | null;
  gross_value: number | null;
  estimated_value: number | null;
  product_type: string | null;
  product_interest_1: string | null;
  source: string | null;
  sub_source: string | null;
  salesman: string | null;
  lead_date: string | null;
  quote_date: string | null;
  follow_up_date: string | null;
  customer_id: string | null;
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
};

function toLeadRow(l: RawLead): LeadRow {
  const { customers: c, ...rest } = l;
  const customerName = c
    ? isCommercial(c.customer_type) && c.company_name
      ? c.company_name
      : [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
        c.company_name ||
        "Unknown"
    : "Unknown customer";

  // The SITE address (where the work happens) is the lead's own unless it
  // mirrors the customer's. The customer (main) address is always the
  // customer's own.
  const useCustomerAddr = l.site_same_as_customer !== false;
  const street = useCustomerAddr && c
    ? [c.house_name, c.house_number, c.street]
    : [l.site_house_name, l.site_house_number, l.site_street];
  const customerStreet = c
    ? [c.house_name, c.house_number, c.street].filter(Boolean).join(" ").trim() || null
    : null;

  // The list's generic columns read from `record`, so the customer-derived
  // values are folded in under their own keys rather than left on the embed.
  const record: Record<string, unknown> = {
    ...rest,
    customer_name: customerName,
    customer_town: useCustomerAddr ? (c?.town ?? null) : (rest.site_town ?? null),
    customer_postcode: useCustomerAddr ? (c?.postcode ?? null) : (rest.site_postcode ?? null),
  };

  return {
    id: l.id,
    ref: leadRef(l.lead_number),
    leadNumber: l.lead_number,
    title: l.product_type ?? l.product_interest_1 ?? "Lead",
    status: l.status,
    value: l.gross_value ?? l.estimated_value,
    source: l.source,
    subSource: l.sub_source,
    salesman: l.salesman,
    leadDate: l.lead_date,
    followUpDate: l.follow_up_date,
    quoteDate: l.quote_date,
    customerId: l.customer_id,
    customerName,
    customerTown: (record.customer_town as string | null) ?? null,
    addressLine: street.filter(Boolean).join(" ").trim() || null,
    customerAddressLine: customerStreet,
    live: isLiveLead(l.status),
    record,
  };
}

/**
 * Paginated, filtered leads for the list screen, plus pipeline aggregates. RLS
 * scopes every read to the caller's tenant. Selects `*` so the configurable
 * columns can render any lead field without a per-column query change.
 */
/**
 * Resolve the free-text term into the pieces a query needs. The customer id
 * lookup is async, so it happens ONCE here rather than inside the filter
 * application — which both getLeads and getLeadPipeline call.
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
 * Apply every filter to a leads query. THE one place this happens — the list,
 * the board's columns and the pipeline aggregates all go through here, so a
 * stage tile can never count a different set than the rows beneath it.
 *
 * Every column name is allowlisted and never interpolated; every value is
 * PostgREST-bound.
 */
function applyLeadFilters<Q>(
  query: Q,
  filters: LeadFilters,
  search: { term: string; customerIds: string[] } | null,
): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;

  // The pipeline strip's stage selection, kept as its own param so the strip
  // stays a one-click filter independent of the Filters popover.
  if (filters.stage) q = q.eq("status", filters.stage);
  if (filters.source) q = q.eq("source", filters.source);

  // Date range on lead_date. Applied at the DB so paging and the exact count
  // stay correct. `lt` (not `lte`) on the upper bound: it is the first instant
  // AFTER the last day, so the whole final day is included.
  if (filters.dateFrom) q = q.gte("lead_date", filters.dateFrom);
  if (filters.dateTo) q = q.lt("lead_date", filters.dateTo);

  if (search) {
    const like = orValue(`%${search.term}%`);
    // Numeric lead ref search when the query is a number ("L-2431" or "2431").
    const asNumber = Number(search.term.replace(/^l-?/i, ""));
    const parts = [
      `product_type.ilike.${like}`,
      `product_interest_1.ilike.${like}`,
      `product_interest_2.ilike.${like}`,
      `source.ilike.${like}`,
      `sub_source.ilike.${like}`,
      `salesman.ilike.${like}`,
      `site_house_name.ilike.${like}`,
      `site_street.ilike.${like}`,
      `site_town.ilike.${like}`,
      `site_postcode.ilike.${like}`,
      `office_reference.ilike.${like}`,
      `office_reference_2.ilike.${like}`,
    ];
    if (Number.isFinite(asNumber)) parts.push(`lead_number.eq.${asNumber}`);
    // The customer's NAME and ADDRESS live on the embedded `customers` row, and
    // PostgREST can't OR an embedded column against the parent's in one query,
    // so their ids were resolved up front (see resolveSearch).
    if (search.customerIds.length) parts.push(`customer_id.in.(${search.customerIds.join(",")})`);
    q = q.or(parts.join(","));
  }

  // Allowlisted lead-column filters.
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

export async function getLeads(filters: LeadFilters = {}): Promise<LeadListResult> {
  const supabase = await createClient();
  const size = filters.pageSize ?? LEADS_PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * size;
  const to = from + size - 1;

  const search = await resolveSearch(supabase, filters.search);

  let query = supabase.from("leads").select(`*, ${CUSTOMER_EMBED}`, { count: "exact" });

  // Sort: an allowlisted column asc/desc, else lead number ascending — the same
  // default the list screen sends, so every caller agrees on "unsorted". A
  // stable secondary key (id) keeps paging deterministic when the column ties.
  if (filters.sort && SORTABLE_COLUMNS.has(filters.sort)) {
    query = query
      .order(filters.sort, { ascending: filters.dir !== "desc", nullsFirst: false })
      .order("id", { ascending: true });
  } else {
    query = query.order("lead_number", { ascending: true, nullsFirst: false }).order("id", { ascending: true });
  }
  query = query.range(from, to);
  query = applyLeadFilters(query, filters, search);

  const { data, count, error } = await query;
  if (error) throw new Error(`getLeads: ${error.message}`);

  const rows = ((data ?? []) as unknown as RawLead[]).map(toLeadRow);
  const total = count ?? rows.length;

  // The board asks for one column at a time and needs none of these; fetching
  // them per column would run all three six times for one screen.
  if (filters.skipAggregates) {
    return {
      rows,
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / size)),
      sources: [],
      pipeline: [],
      filterOptions: {},
    };
  }

  const [sources, pipeline, filterOptions] = await Promise.all([
    getLeadSources(supabase),
    getLeadPipeline(supabase, filters, search),
    getFilterOptions(supabase),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / size)),
    sources,
    pipeline,
    filterOptions,
  };
}


// ---------------------------------------------------------------------------
// Kanban board
//
// The board is the same query as the list, run once PER STAGE. Grouping one
// flat page client-side was the alternative and it's wrong: a first page
// dominated by "New" would leave "Quoted" looking empty when it isn't. Per
// stage, each column gets its own top-N and its own true total.

/** Cards loaded per column at a time. A column scrolls for the rest. */
export const BOARD_COLUMN_SIZE = 25;

export type BoardColumn = {
  key: string;
  label: string;
  /** Every lead in this stage matching the filters, not just the loaded ones. */
  total: number;
  /** Summed value of ALL of them, from the pipeline aggregate. */
  value: number;
  cards: LeadRow[];
  hasMore: boolean;
};

/**
 * One page of one stage's cards. Reuses `getLeads` wholesale — same allowlisted
 * filter/sort/search path — with the stage pinned, so a board column can never
 * drift from what the list would show for that stage.
 */
export async function getBoardColumn(
  filters: LeadFilters,
  stage: string,
  page = 1,
): Promise<{ cards: LeadRow[]; total: number; hasMore: boolean }> {
  const { rows, total } = await getLeads({
    ...filters,
    stage,
    page,
    pageSize: BOARD_COLUMN_SIZE,
    skipAggregates: true,
  });
  return { cards: rows, total, hasMore: page * BOARD_COLUMN_SIZE < total };
}

/**
 * Every column's first page, in pipeline order, plus the aggregates the page
 * header needs — returned in the SAME shape the list returns them, so one
 * summary component serves both views.
 */
export async function getLeadBoard(filters: LeadFilters): Promise<{
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
    getLeadPipeline(supabase, filters, search),
    getFilterOptions(supabase),
    ...LEAD_STAGES.map((s) => getBoardColumn(filters, s.key)),
  ]);

  const valueOf = new Map(pipeline.map((b) => [b.key, b.value]));
  const columns = LEAD_STAGES.map((s, i) => {
    const page = pages[i] as { cards: LeadRow[]; total: number; hasMore: boolean };
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

/**
 * Quote a value for a PostgREST `or()` term. The filter string is comma- and
 * paren-delimited, so an unquoted search for "Smith, J" or "Unit 4 (rear)"
 * silently produces a malformed filter. Double quotes make it one literal;
 * inside them `\` escapes `"` and `\`.
 */
function orValue(v: string): string {
  return `"${v.replace(/[\\"]/g, "\\$&")}"`;
}

/** Customer columns a lead search matches on — the person and where they live. */
const CUSTOMER_SEARCH_COLUMNS = [
  "first_name", "last_name", "first_name_2", "last_name_2", "company_name",
  "house_name", "house_number", "street", "locality", "town", "county", "postcode",
  "email", "mobile", "home_telephone",
];

/**
 * Ids of customers matching a free-text term, for folding into the lead search.
 *
 * CAPPED: a term matching more customers than this narrows further than the
 * user asked. The cap is deliberately generous — a search specific enough to be
 * useful matches far fewer — but it IS a cap, so don't quietly lower it.
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
  // A failure here must not take the whole list down — the lead-column half of
  // the search still works, so degrade to that rather than throwing.
  if (error) return [];
  return (data ?? []).map((r) => r.id);
}

/**
 * Distinct values for each select-filter column, so the Filters popover can
 * offer real choices. One capped read rather than a query per column — same
 * approach and same scale caveat as the customers list.
 */
async function getFilterOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Record<string, string[]>> {
  const cols = SELECT_FILTER_COLUMNS.join(", ");
  const { data } = await supabase.from("leads").select(cols).limit(5000);

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


export type LeadNote = {
  id: string;
  content: string;
  created_at: string;
};

export type LeadChecklistItem = {
  id: number;
  action_name: string;
  status: string | null;
  due_date: string | null;
  priority: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
};

export type LeadActivity = {
  id: string;
  type: string;
  description: string;
  created_at: string;
};

export type LeadDetail = {
  id: string;
  leadNumber: number | null;
  ref: string;
  status: string | null;
  result: string | null;
  priority: string | null;
  title: string;
  value: number | null;
  source: string | null;
  subSource: string | null;
  salesman: string | null;
  salespersonType: string | null;
  productType: string | null;
  productInterest1: string | null;
  productInterest2: string | null;
  windowCount: number | null;
  leadDate: string | null;
  quoteDate: string | null;
  quoteType: string | null;
  paymentMethod: string | null;
  resultReason: string | null;
  followUpDate: string | null;
  notes: string | null;
  // Site address — where the work happens (falls back to customer address).
  // Installation and fitting are the same place, so there is ONE site address.
  site: AddressParts;
  siteSameAsCustomer: boolean;
  invoiceSameAsCustomer: boolean;
  siteDirections: string | null;
  customer: {
    id: string;
    name: string;
    address: AddressParts;
    whatThreeWords: string | null;
    email: string | null;
    mobile: string | null;
    home: string | null;
  } | null;
  leadNotes: LeadNote[];
  checklist: LeadChecklistItem[];
  activities: LeadActivity[];
  /**
   * The lead's note thread, in the shared stamped/versioned NoteItem shape.
   * Distinct from `notes` above, which is the lead row's own free-text column.
   */
  noteThread: NoteItem[];
  /**
   * Documents reachable from this lead: its own plus the owning customer's, so
   * the tab can attach an existing file instead of re-uploading it (the same
   * duplicate-free path the customer record offers).
   */
  documents: DocumentItem[];
};

export type AddressParts = {
  line1: string | null;
  line2: string | null;
  postcode: string | null;
  whatThreeWords: string | null;
  /**
   * The address as loose fields, for AddressMap — it geocodes the FULL address
   * to land the pin on the building, so it needs house number / street / town
   * discretely, not the joined display lines. See AGENTS.md § Maps & geocoding.
   */
  fields: AddressFields;
};

export type AddressFields = {
  houseName: string | null;
  houseNumber: string | null;
  street: string | null;
  locality: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
};

function addr(
  parts: {
    house_name?: string | null;
    house_number?: string | null;
    street?: string | null;
    locality?: string | null;
    town?: string | null;
    county?: string | null;
    postcode?: string | null;
    what_3_words?: string | null;
  },
): AddressParts {
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

/** One lead with everything the detail screen needs. */
export async function getLead(id: string): Promise<LeadDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      `id, lead_number, status, result, priority, gross_value, estimated_value,
       product_type, product_interest_1, product_interest_2, window_count,
       source, sub_source, salesman, salesperson_type, lead_date, quote_date, quote_type,
       payment_method, result_reason, follow_up_date, notes,
       site_same_as_customer, invoice_same_as_customer,
       site_house_name, site_house_number, site_street,
       site_locality, site_town, site_county, site_postcode,
       site_what_3_words, fitting_directions,
       customer_id,
       customers(id, first_name, last_name, company_name, customer_type, house_name, house_number,
         street, locality, town, county, postcode, what_3_words,
         email, mobile, home_telephone),
       lead_notes(id, content, created_at),
       lead_checklist_items(id, action_name, status, due_date, priority, completed_at, completed_by_name),
       activities(id, type, description, created_at)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getLead: ${error.message}`);
  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l = data as any;
  const c = l.customers;

  // Notes + documents are separate reads because they need the shared
  // stamped/versioned selects (with their author joins and their
  // pending-migration fallbacks), which don't compose into the embed above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from(t: string): any };
  const [notesRes, docsRes] = await Promise.all([
    selectWithFallback(
      () => db.from("lead_notes").select(NOTE_SELECT).eq("lead_id", id).or("category.is.null,category.neq.marketing").order("created_at", { ascending: false }),
      () => db.from("lead_notes").select(NOTE_SELECT_BASE).eq("lead_id", id).or("category.is.null,category.neq.marketing").order("created_at", { ascending: false }),
    ),
    // The owning customer's documents when there is one, so an existing file
    // can be attached rather than uploaded twice; otherwise just the lead's.
    c?.id
      ? selectWithFallback(
          () => db.from("documents").select(DOCUMENT_SELECT).or(`customer_id.eq.${c.id},lead_id.eq.${id}`).order("created_at", { ascending: false }),
          () => db.from("documents").select(DOCUMENT_SELECT_BASE).or(`customer_id.eq.${c.id},lead_id.eq.${id}`).order("created_at", { ascending: false }),
        )
      : selectWithFallback(
          () => db.from("documents").select(DOCUMENT_SELECT).eq("lead_id", id).order("created_at", { ascending: false }),
          () => db.from("documents").select(DOCUMENT_SELECT_BASE).eq("lead_id", id).order("created_at", { ascending: false }),
        ),
  ]);
  const customerName = c
    ? isCommercial(c.customer_type) && c.company_name
      ? c.company_name
      : [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.company_name || "Unknown"
    : "Unknown";

  const site = l.site_same_as_customer && c
    ? addr(c)
    : addr({
        house_name: l.site_house_name,
        house_number: l.site_house_number,
        street: l.site_street,
        locality: l.site_locality,
        town: l.site_town,
        county: l.site_county,
        postcode: l.site_postcode,
        what_3_words: l.site_what_3_words,
      });

  return {
    id: l.id,
    leadNumber: l.lead_number,
    ref: leadRef(l.lead_number),
    status: l.status,
    result: l.result,
    priority: l.priority,
    title: l.product_type ?? l.product_interest_1 ?? "Lead",
    value: l.gross_value ?? l.estimated_value,
    source: l.source,
    subSource: l.sub_source,
    salesman: l.salesman,
    salespersonType: l.salesperson_type,
    productType: l.product_type,
    productInterest1: l.product_interest_1,
    productInterest2: l.product_interest_2,
    windowCount: l.window_count,
    leadDate: l.lead_date,
    quoteDate: l.quote_date,
    quoteType: l.quote_type,
    paymentMethod: l.payment_method,
    resultReason: l.result_reason,
    followUpDate: l.follow_up_date,
    notes: l.notes,
    site,
    siteSameAsCustomer: !!l.site_same_as_customer,
    invoiceSameAsCustomer: !!l.invoice_same_as_customer,
    siteDirections: l.fitting_directions,
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
    leadNotes: (l.lead_notes ?? []).sort(
      (a: LeadNote, b: LeadNote) => +new Date(b.created_at) - +new Date(a.created_at),
    ),
    checklist: (l.lead_checklist_items ?? []).sort(
      (a: LeadChecklistItem, b: LeadChecklistItem) => (a.id ?? 0) - (b.id ?? 0),
    ),
    activities: (l.activities ?? []).sort(
      (a: LeadActivity, b: LeadActivity) => +new Date(b.created_at) - +new Date(a.created_at),
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    noteThread: ((notesRes.data ?? []) as any[]).map(mapNoteRow),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documents: ((docsRes.data ?? []) as any[]).map(mapDocumentRow),
  };
}

/** Per-stage lead counts + summed value, across the whole tenant. */
export async function getLeadPipeline(
  supabase?: Awaited<ReturnType<typeof createClient>>,
  filters: LeadFilters = {},
  search?: { term: string; customerIds: string[] } | null,
): Promise<StageBucket[]> {
  const client = supabase ?? (await createClient());
  // The strip must agree with the rows beneath it — tiles counting a different
  // set than the table shows reads as a bug. So it runs through the SAME
  // applyLeadFilters as the rows, with ONE exception: the stage selection is
  // dropped, because the strip is how you switch stage and narrowing it to the
  // selected one would leave no way back.
  const { stage: _stage, ...rest } = filters;
  void _stage;
  const resolved =
    search !== undefined ? search : await resolveSearch(client, filters.search);
  const q = applyLeadFilters(
    client.from("leads").select("status, gross_value, estimated_value"),
    rest,
    resolved,
  );
  const { data, error } = await q;
  if (error) throw new Error(`getLeadPipeline: ${error.message}`);

  const buckets = new Map<string, StageBucket>();
  for (const row of data ?? []) {
    const key = row.status ?? "new";
    const value = Number(row.gross_value ?? row.estimated_value ?? 0);
    const b = buckets.get(key) ?? { key, count: 0, value: 0 };
    b.count += 1;
    b.value += value;
    buckets.set(key, b);
  }
  return [...buckets.values()];
}

async function getLeadSources(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string[]> {
  const { data } = await supabase.from("leads").select("source").not("source", "is", null);
  const set = new Set<string>();
  for (const r of data ?? []) if (r.source) set.add(r.source);
  return [...set].sort();
}
