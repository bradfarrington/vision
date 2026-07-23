import { createClient } from "@/lib/supabase/server";
import { isLiveLead, leadRef } from "@/lib/leads";
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
  "same_as_customer_address",
] as const;

// Text lead columns the advanced value-filter builder may query. Allowlisted —
// the column name is never interpolated from input, and the value is bound by
// PostgREST (plus LIKE metacharacters are escaped).
export const VALUE_FILTER_COLUMNS = new Set<string>([
  "status", "result", "result_reason", "priority",
  "source", "sub_source", "product_type", "product_interest_1", "product_interest_2",
  "salesman", "salesperson_type", "quote_type", "payment_method",
  "office_reference", "office_reference_2", "notes",
  "installation_house_name", "installation_house_number", "installation_street",
  "installation_locality", "installation_town", "installation_county",
  "installation_postcode", "installation_what_3_words",
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
  "installation_house_name", "installation_house_number", "installation_street",
  "installation_locality", "installation_town", "installation_county",
  "installation_postcode",
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
  /** Installation address street line (falls back to the customer's). */
  addressLine: string | null;
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
  /** Allowlisted lead-column filters, keyed by column name (see *_FILTER_COLUMNS). */
  columnFilters?: Record<string, string>;
  /** Advanced field/operator/value conditions, ANDed together. */
  valueFilters?: ValueCondition[];
  /** Column to order by (allowlisted; ignored otherwise) and direction. */
  sort?: string;
  dir?: "asc" | "desc";
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
  same_as_customer_address: boolean | null;
  installation_house_name: string | null;
  installation_house_number: string | null;
  installation_street: string | null;
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

  // The installation address is the lead's own unless it mirrors the customer's.
  const useCustomerAddr = l.same_as_customer_address !== false;
  const street = useCustomerAddr && c
    ? [c.house_name, c.house_number, c.street]
    : [l.installation_house_name, l.installation_house_number, l.installation_street];

  // The list's generic columns read from `record`, so the customer-derived
  // values are folded in under their own keys rather than left on the embed.
  const record: Record<string, unknown> = {
    ...rest,
    customer_name: customerName,
    customer_town: useCustomerAddr ? (c?.town ?? null) : (rest.installation_town ?? null),
    customer_postcode: useCustomerAddr ? (c?.postcode ?? null) : (rest.installation_postcode ?? null),
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
    live: isLiveLead(l.status),
    record,
  };
}

/**
 * Paginated, filtered leads for the list screen, plus pipeline aggregates. RLS
 * scopes every read to the caller's tenant. Selects `*` so the configurable
 * columns can render any lead field without a per-column query change.
 */
export async function getLeads(filters: LeadFilters = {}): Promise<LeadListResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * LEADS_PAGE_SIZE;
  const to = from + LEADS_PAGE_SIZE - 1;

  let query = supabase
    .from("leads")
    .select(`*, ${CUSTOMER_EMBED}`, { count: "exact" });

  // Sort: an allowlisted column asc/desc, else newest lead first. A stable
  // secondary key (id) keeps paging deterministic when the sort column ties.
  if (filters.sort && SORTABLE_COLUMNS.has(filters.sort)) {
    query = query
      .order(filters.sort, { ascending: filters.dir !== "desc", nullsFirst: false })
      .order("id", { ascending: true });
  } else {
    query = query.order("lead_date", { ascending: false, nullsFirst: false });
  }
  query = query.range(from, to);

  // The pipeline strip's stage selection, kept as its own param so the strip
  // stays a one-click filter independent of the Filters popover.
  if (filters.stage) query = query.eq("status", filters.stage);
  if (filters.source) query = query.eq("source", filters.source);

  const q = filters.search?.trim();
  if (q) {
    const like = `%${q}%`;
    // Numeric lead ref search when the query is a number ("L-2431" or "2431").
    const asNumber = Number(q.replace(/^l-?/i, ""));
    const parts = [
      `product_type.ilike.${like}`,
      `product_interest_1.ilike.${like}`,
      `source.ilike.${like}`,
      `salesman.ilike.${like}`,
      `installation_town.ilike.${like}`,
      `installation_postcode.ilike.${like}`,
      `office_reference.ilike.${like}`,
    ];
    if (Number.isFinite(asNumber)) parts.push(`lead_number.eq.${asNumber}`);
    query = query.or(parts.join(","));
  }

  // Allowlisted lead-column filters — applied at the DB so paging/counts stay
  // correct at any number of rows.
  const cf = filters.columnFilters ?? {};
  for (const col of SELECT_FILTER_COLUMNS) {
    const v = cf[col];
    if (v) query = query.eq(col, v);
  }
  for (const col of BOOL_FILTER_COLUMNS) {
    const v = cf[col];
    if (v === "1" || v === "0") query = query.eq(col, v === "1");
  }

  // Advanced field/operator/value conditions — each ANDs onto the query.
  for (const c of filters.valueFilters ?? []) {
    if (!VALUE_FILTER_COLUMNS.has(c.f)) continue;
    const v = (c.v ?? "").trim();
    switch (c.op) {
      case "contains": if (v) query = query.ilike(c.f, `%${escapeLike(v)}%`); break;
      case "equals": if (v) query = query.ilike(c.f, escapeLike(v)); break;
      case "begins": if (v) query = query.ilike(c.f, `${escapeLike(v)}%`); break;
      case "ends": if (v) query = query.ilike(c.f, `%${escapeLike(v)}`); break;
      case "empty": query = query.is(c.f, null); break;
      case "notempty": query = query.not(c.f, "is", null); break;
    }
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`getLeads: ${error.message}`);

  const rows = ((data ?? []) as unknown as RawLead[]).map(toLeadRow);
  const [sources, pipeline, filterOptions] = await Promise.all([
    getLeadSources(supabase),
    getLeadPipeline(supabase),
    getFilterOptions(supabase),
  ]);

  const total = count ?? rows.length;
  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE)),
    sources,
    pipeline,
    filterOptions,
  };
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
  // Installation address (falls back to customer address).
  install: AddressParts;
  sameAsCustomer: boolean;
  fittingSameAsCustomer: boolean;
  invoiceSameAsCustomer: boolean;
  fitting: AddressParts;
  fittingDirections: string | null;
  customer: {
    id: string;
    name: string;
    address: AddressParts;
    whatThreeWords: string | null;
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
       same_as_customer_address, invoice_same_as_customer, fitting_same_as_customer,
       installation_house_name, installation_house_number, installation_street,
       installation_locality, installation_town, installation_county, installation_postcode,
       installation_what_3_words,
       fitting_house_name, fitting_house_number, fitting_street, fitting_locality,
       fitting_town, fitting_county, fitting_postcode, fitting_what_3_words, fitting_directions,
       customer_id,
       customers(id, first_name, last_name, company_name, customer_type, house_name, house_number,
         street, locality, town, county, postcode, what_3_words),
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

  const install = l.same_as_customer_address && c
    ? addr(c)
    : addr({
        house_name: l.installation_house_name,
        house_number: l.installation_house_number,
        street: l.installation_street,
        locality: l.installation_locality,
        town: l.installation_town,
        county: l.installation_county,
        postcode: l.installation_postcode,
        what_3_words: l.installation_what_3_words,
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
    install,
    sameAsCustomer: !!l.same_as_customer_address,
    fittingSameAsCustomer: !!l.fitting_same_as_customer,
    invoiceSameAsCustomer: !!l.invoice_same_as_customer,
    fitting: addr({
      house_name: l.fitting_house_name,
      house_number: l.fitting_house_number,
      street: l.fitting_street,
      locality: l.fitting_locality,
      town: l.fitting_town,
      county: l.fitting_county,
      postcode: l.fitting_postcode,
      what_3_words: l.fitting_what_3_words,
    }),
    fittingDirections: l.fitting_directions,
    customer: c
      ? { id: c.id, name: customerName, address: addr(c), whatThreeWords: c.what_3_words ?? null }
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
): Promise<StageBucket[]> {
  const client = supabase ?? (await createClient());
  const { data, error } = await client.from("leads").select("status, gross_value, estimated_value");
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
