import { createClient } from "@/lib/supabase/server";
import { isLiveLead, leadRef } from "@/lib/leads";

export const LEADS_PAGE_SIZE = 12;

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
  live: boolean;
};

export type LeadFilters = {
  search?: string;
  stage?: string;
  source?: string;
  page?: number;
};

export type StageBucket = { key: string; count: number; value: number };

export type LeadListResult = {
  rows: LeadRow[];
  total: number;
  page: number;
  pageCount: number;
  sources: string[];
  pipeline: StageBucket[];
};

const SELECT = `id, lead_number, status, result, gross_value, estimated_value, product_type,
  product_interest_1, source, sub_source, salesman, lead_date, quote_date, follow_up_date,
  customer_id, customers(id, first_name, last_name, company_name, customer_type, town)`;

type RawLead = {
  id: string;
  lead_number: number | null;
  status: string | null;
  result: string | null;
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
  customers: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    customer_type: string | null;
    town: string | null;
  } | null;
};

function toLeadRow(l: RawLead): LeadRow {
  const c = l.customers;
  const customerName = c
    ? c.customer_type === "commercial" && c.company_name
      ? c.company_name
      : [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
        c.company_name ||
        "Unknown"
    : "Unknown customer";

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
    customerTown: c?.town ?? null,
    live: isLiveLead(l.status),
  };
}

/** Paginated, filtered leads for the list screen, plus pipeline aggregates. */
export async function getLeads(filters: LeadFilters = {}): Promise<LeadListResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * LEADS_PAGE_SIZE;
  const to = from + LEADS_PAGE_SIZE - 1;

  let query = supabase
    .from("leads")
    .select(SELECT, { count: "exact" })
    .order("lead_date", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (filters.stage) query = query.eq("status", filters.stage);
  if (filters.source) query = query.eq("source", filters.source);

  const q = filters.search?.trim();
  if (q) {
    const like = `%${q}%`;
    // Numeric lead ref search when the query is a number.
    const asNumber = Number(q.replace(/^l-?/i, ""));
    const parts = [
      `product_type.ilike.${like}`,
      `product_interest_1.ilike.${like}`,
      `source.ilike.${like}`,
      `salesman.ilike.${like}`,
    ];
    if (Number.isFinite(asNumber)) parts.push(`lead_number.eq.${asNumber}`);
    query = query.or(parts.join(","));
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`getLeads: ${error.message}`);

  const rows = ((data ?? []) as unknown as RawLead[]).map(toLeadRow);
  const [sources, pipeline] = await Promise.all([
    getLeadSources(supabase),
    getLeadPipeline(supabase),
  ]);

  const total = count ?? rows.length;
  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE)),
    sources,
    pipeline,
  };
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
  productType: string | null;
  productInterest1: string | null;
  productInterest2: string | null;
  windowCount: number | null;
  leadDate: string | null;
  quoteDate: string | null;
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
};

export type AddressParts = {
  line1: string | null;
  line2: string | null;
  postcode: string | null;
  whatThreeWords: string | null;
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
       source, sub_source, salesman, lead_date, quote_date, follow_up_date, notes,
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
  const customerName = c
    ? c.customer_type === "commercial" && c.company_name
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
    productType: l.product_type,
    productInterest1: l.product_interest_1,
    productInterest2: l.product_interest_2,
    windowCount: l.window_count,
    leadDate: l.lead_date,
    quoteDate: l.quote_date,
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
