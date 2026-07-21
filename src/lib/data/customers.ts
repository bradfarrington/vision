import { createClient } from "@/lib/supabase/server";
import { isLiveLead } from "@/lib/leads";
import { isCommercial } from "@/lib/format";

export const CUSTOMERS_PAGE_SIZE = 9;

export type CustomerLead = {
  id: string;
  lead_number: number | null;
  status: string | null;
  result: string | null;
  gross_value: number | null;
  estimated_value: number | null;
  product_type: string | null;
  product_interest_1: string | null;
  product_interest_2: string | null;
  source: string | null;
  sub_source: string | null;
  salesman: string | null;
  lead_date: string | null;
  quote_date: string | null;
  follow_up_date: string | null;
  result_date: string | null;
  created_at: string;
};

export type CustomerRow = {
  id: string;
  displayName: string;
  initials: string;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  town: string | null;
  postcode: string | null;
  customerType: string | null;
  createdAt: string;
  leads: CustomerLead[];
  leadCount: number;
  liveLeadCount: number;
  contractCount: number;
};

export type CustomerFilters = {
  search?: string;
  town?: string;
  hasLiveLead?: boolean;
  page?: number;
};

export type CustomerListResult = {
  rows: CustomerRow[];
  total: number;
  page: number;
  pageCount: number;
  towns: string[];
};

const LEAD_FIELDS =
  "id, lead_number, status, result, gross_value, estimated_value, product_type, product_interest_1, product_interest_2, source, sub_source, salesman, lead_date, quote_date, follow_up_date, result_date, created_at";

/**
 * Paginated, filtered customers for the list screen. RLS scopes every read to
 * the caller's tenant, so no company_id filter is needed here (defence in depth
 * still lives in the policies). Lead + contract counts are embedded so the list
 * renders in a single round-trip.
 */
export async function getCustomers(
  filters: CustomerFilters = {},
): Promise<CustomerListResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * CUSTOMERS_PAGE_SIZE;
  const to = from + CUSTOMERS_PAGE_SIZE - 1;

  let query = supabase
    .from("customers")
    .select(
      `id, customer_type, title, first_name, last_name, company_name, email, phone, mobile,
       house_name, house_number, street, locality, town, county, postcode, created_at,
       leads(${LEAD_FIELDS}),
       contracts(id)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const q = filters.search?.trim();
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      [
        `first_name.ilike.${like}`,
        `last_name.ilike.${like}`,
        `company_name.ilike.${like}`,
        `email.ilike.${like}`,
        `phone.ilike.${like}`,
        `mobile.ilike.${like}`,
        `postcode.ilike.${like}`,
        `town.ilike.${like}`,
      ].join(","),
    );
  }
  if (filters.town) query = query.eq("town", filters.town);

  const { data, count, error } = await query;
  if (error) throw new Error(`getCustomers: ${error.message}`);

  let rows = ((data ?? []) as unknown as RawCustomer[]).map(toCustomerRow);
  if (filters.hasLiveLead) rows = rows.filter((r) => r.liveLeadCount > 0);

  const towns = await getCustomerTowns(supabase);

  const total = count ?? rows.length;
  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE)),
    towns,
  };
}

export type CustomerOption = { id: string; name: string };

/** Minimal customer list for pickers (New Lead form). */
export async function getCustomerOptions(): Promise<CustomerOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name, customer_type")
    .order("last_name")
    .limit(500);
  if (error) throw new Error(`getCustomerOptions: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id,
    name:
      isCommercial(c.customer_type) && c.company_name
        ? c.company_name
        : [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
          c.company_name ||
          "Unnamed",
  }));
}

export type ContractSummary = {
  id: string;
  contract_number: number | null;
  gross_value: number | null;
  status: string | null;
  contract_date: string | null;
  contract_type: string | null;
  lead_id: string | null;
};

export type CustomerDetail = CustomerRow & {
  title: string | null;
  firstName: string;
  lastName: string;
  companyName: string | null;
  mobile: string | null;
  homeTelephone: string | null;
  workTelephone: string | null;
  houseName: string | null;
  houseNumber: string | null;
  street: string | null;
  locality: string | null;
  county: string | null;
  whatThreeWords: string | null;
  notes: string | null;
  contracts: ContractSummary[];
};

/** One customer with its leads + full contracts, for the detail screen. */
export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      `id, customer_type, title, first_name, last_name, company_name, email, phone, mobile,
       home_telephone, work_telephone, house_name, house_number, street, locality, town, county,
       postcode, what_3_words, notes, created_at,
       leads(${LEAD_FIELDS}),
       contracts(id, contract_number, gross_value, status, contract_date, contract_type, lead_id)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getCustomer: ${error.message}`);
  if (!data) return null;

  const raw = data as unknown as Omit<RawCustomer, "contracts"> & {
    title: string | null;
    mobile: string | null;
    home_telephone: string | null;
    work_telephone: string | null;
    house_name: string | null;
    house_number: string | null;
    street: string | null;
    locality: string | null;
    county: string | null;
    what_3_words: string | null;
    notes: string | null;
    contracts: ContractSummary[] | null;
  };
  const base = toCustomerRow(raw);

  return {
    ...base,
    title: raw.title,
    firstName: raw.first_name,
    lastName: raw.last_name,
    companyName: raw.company_name,
    mobile: raw.mobile,
    homeTelephone: raw.home_telephone,
    workTelephone: raw.work_telephone,
    houseName: raw.house_name,
    houseNumber: raw.house_number,
    street: raw.street,
    locality: raw.locality,
    county: raw.county,
    whatThreeWords: raw.what_3_words,
    notes: raw.notes,
    contracts: (raw.contracts ?? []).slice(),
  };
}

type RawCustomer = {
  id: string;
  customer_type: string | null;
  title: string | null;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  house_name: string | null;
  house_number: string | null;
  street: string | null;
  locality: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  created_at: string;
  leads: CustomerLead[] | null;
  contracts: { id: string }[] | null;
};

function toCustomerRow(c: RawCustomer): CustomerRow {
  const personName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  // Residential customers are always shown by their person name — a company name
  // is only a commercial concept and must never surface for a residential row.
  const displayName =
    isCommercial(c.customer_type)
      ? c.company_name || personName || "Unnamed customer"
      : personName || "Unnamed customer";

  const leads = (c.leads ?? [])
    .slice()
    .sort((a, b) => dateVal(b) - dateVal(a));
  const liveLeadCount = leads.filter((l) => isLiveLead(l.status)).length;

  return {
    id: c.id,
    displayName,
    initials: initials(displayName),
    email: c.email,
    phone: c.phone ?? c.mobile,
    addressLine: [c.house_name, c.house_number, c.street]
      .filter(Boolean)
      .join(" ")
      .trim() || null,
    town: c.town,
    postcode: c.postcode,
    customerType: c.customer_type,
    createdAt: c.created_at,
    leads,
    leadCount: leads.length,
    liveLeadCount,
    contractCount: (c.contracts ?? []).length,
  };
}

function dateVal(l: CustomerLead): number {
  const d = l.lead_date ?? l.created_at;
  const t = d ? new Date(d).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

function initials(name: string): string {
  const parts = name.trim().split(/[\s&]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type ActivityLine = {
  primary: string;
  secondary: string;
  /** Amber styling for an outstanding/overdue prompt (e.g. follow-up due). */
  amber?: boolean;
};

/**
 * Derive the "last activity" cell for a customer from their most recent lead.
 * A dedicated activity feed lands in a later phase; until then this reads the
 * lead's own state, which is meaningful and always present.
 */
export function latestLeadActivity(row: CustomerRow): ActivityLine {
  const lead = row.leads[0];
  if (!lead) {
    return { primary: "No leads yet", secondary: relative(row.createdAt) };
  }
  const value = lead.gross_value ?? lead.estimated_value;
  const money = value != null ? ` · £${Number(value).toLocaleString("en-GB")}` : "";
  const product = lead.product_type ?? lead.product_interest_1 ?? "enquiry";

  // An open follow-up in the future is the most actionable signal.
  if (lead.follow_up_date && new Date(lead.follow_up_date) >= startOfToday()) {
    return {
      primary: "Follow-up due",
      secondary: shortish(lead.follow_up_date),
      amber: true,
    };
  }

  switch (lead.status) {
    case "won":
      return { primary: `Won${money}`, secondary: relative(lead.result_date ?? lead.created_at) };
    case "lost":
      return { primary: "Lost", secondary: `closed ${shortish(lead.result_date)}` };
    case "quoted":
      return { primary: `Quote sent${money}`, secondary: relative(lead.quote_date ?? lead.created_at) };
    case "survey_booked":
      return { primary: "Survey booked", secondary: relative(lead.created_at) };
    default:
      return { primary: `New lead · ${product}`, secondary: relative(lead.lead_date ?? lead.created_at) };
  }
}

function startOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function relative(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.floor((startOfToday().getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return shortish(value);
}

function shortish(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function getCustomerTowns(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string[]> {
  const { data } = await supabase
    .from("customers")
    .select("town")
    .not("town", "is", null)
    .order("town");
  const set = new Set<string>();
  for (const r of data ?? []) if (r.town) set.add(r.town);
  return [...set];
}
