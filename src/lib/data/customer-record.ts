/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import { isLiveLead } from "@/lib/leads";
import type { CustomerLead, ContractSummary } from "./customers";

// Full customer record for the tabbed detail page. Reads the customer row plus
// its related lists (contacts, account references, custom fields, documents,
// notes). The migration `20260721094000_customer_record_expansion` adds the new
// columns/tables; until `supabase gen types` is re-run these are typed here by
// hand and the raw reads are cast.

export type CustomerContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position_role: string | null;
  is_default: boolean | null;
  no_whatsapp: boolean | null;
};

export type AccountReference = {
  id: string;
  reference: string | null;
  acc_name: string | null;
};

export type CustomFieldEntry = {
  definitionId: number;
  question: string;
  dataType: string;
  required: boolean;
  value: string | null;
  initials: string | null;
};

export type CustomerDoc = {
  id: string;
  name: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  file_url: string;
  category: string | null;
  created_at: string;
};

export type CustomerNote = {
  id: string;
  content: string;
  created_at: string;
};

export type CustomerRelationship = {
  id: string;
  relationshipType: string | null;
  notes: string | null;
  related: {
    id: string;
    name: string;
    customerNumber: number | null;
    contractCount: number;
    liveLeadCount: number;
    lifetimeValue: number;
  } | null;
};

export type TenantOption = { id: string; label: string };

/** A tenant's editable option list (relationship types, etc.). */
export async function getTenantOptions(listKey: string): Promise<TenantOption[]> {
  const supabase = await createClient();
  const db = supabase as unknown as { from(t: string): any };
  const { data } = await db
    .from("tenant_options")
    .select("id, label")
    .eq("list_key", listKey)
    .eq("is_active", true)
    .order("sort_order")
    .order("label");
  return (data ?? []) as TenantOption[];
}

// Every column we display, typed by hand (superset of the generated type).
export type CustomerFields = {
  id: string;
  customer_number: number | null;
  customer_type: string | null;
  title: string | null;
  first_name: string;
  last_name: string;
  company_name: string | null;
  title_2: string | null;
  first_name_2: string | null;
  last_name_2: string | null;
  salutation: string | null;
  business_address: boolean | null;
  office_ref_1: string | null;
  office_ref_2: string | null;
  flash_note: string | null;
  customer_moved_away: boolean | null;
  no_whatsapp: boolean | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  mobile_2: string | null;
  home_telephone: string | null;
  work_telephone: string | null;
  fax_alt_no: string | null;
  house_name: string | null;
  house_number: string | null;
  street: string | null;
  locality: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  what_3_words: string | null;
  directions: string | null;
  notes: string | null;
  property_type: string | null;
  // billing / account
  invoice_name: string | null;
  invoice_address_1: string | null;
  invoice_address_2: string | null;
  invoice_address_3: string | null;
  invoice_address_4: string | null;
  invoice_postcode: string | null;
  invoice_tel: string | null;
  payment_terms: string | null;
  settlement_disc_terms: string | null;
  settlement_disc_pct: number | null;
  calculate_vat_on_reduced: boolean | null;
  account_created_in_package: boolean | null;
  default_account_reference: string | null;
  sales_manager: string | null;
  vat_no: string | null;
  cis_reg: string | null;
  // marketing / consent
  marketing_code: string | null;
  marketing_notes: string | null;
  no_postal_marketing: boolean | null;
  no_email_marketing: boolean | null;
  no_sms_marketing: boolean | null;
  no_telephone_marketing: boolean | null;
  do_not_contact: boolean | null;
  bad_payer: boolean | null;
  opt_in_date: string | null;
  opted_in_by: string | null;
  opt_in_document: string | null;
  phone_opt_in: boolean | null;
  letter_opt_in: boolean | null;
  email_opt_in: boolean | null;
  sms_opt_in: boolean | null;
  created_at: string;
};

export type CustomerRecord = CustomerFields & {
  displayName: string;
  leads: CustomerLead[];
  contracts: ContractSummary[];
  leadCount: number;
  liveLeadCount: number;
  contractCount: number;
  lifetimeValue: number;
  contacts: CustomerContact[];
  accountReferences: AccountReference[];
  customFields: CustomFieldEntry[];
  documents: CustomerDoc[];
  customerNotes: CustomerNote[];
  relationships: CustomerRelationship[];
};

const LEAD_FIELDS =
  "id, lead_number, status, result, gross_value, estimated_value, product_type, product_interest_1, product_interest_2, source, sub_source, salesman, lead_date, quote_date, follow_up_date, result_date, created_at";

/** The full customer record for the detail screen. */
export async function getCustomerRecord(id: string): Promise<CustomerRecord | null> {
  const supabase = await createClient();

  // Loosely-typed accessor for tables/columns added by the expansion migration
  // but not yet in the generated types. Re-run `supabase gen types` to restore
  // full typing; runtime is unaffected.
  const db = supabase as unknown as { from(table: string): any };

  const { data, error } = await db
    .from("customers")
    .select(`*, leads(${LEAD_FIELDS}), contracts(id, contract_number, gross_value, status, contract_date, contract_type, lead_id)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getCustomerRecord: ${error.message}`);
  if (!data) return null;

  const c = data as any;

  // Related lists — separate reads (avoids relying on freshly-added embed
  // relationships before the PostgREST schema cache reloads).
  const [contactsRes, refsRes, defsRes, valsRes, docsRes, notesRes, relsRes] = await Promise.all([
    db.from("customer_contacts").select("id, name, email, phone, position_role, is_default, no_whatsapp").eq("customer_id", id).order("is_default", { ascending: false }),
    db.from("customer_account_references").select("id, reference, acc_name").eq("customer_id", id),
    db.from("custom_field_definitions").select("id, question, data_type, required, sort_order").eq("entity", "customer").eq("is_active", true).order("sort_order"),
    db.from("custom_field_values").select("definition_id, value, initials").eq("customer_id", id),
    db.from("documents").select("id, name, file_name, file_type, file_size, file_url, category, created_at").eq("customer_id", id).order("created_at", { ascending: false }),
    db.from("lead_notes").select("id, content, created_at").eq("customer_id", id).is("lead_id", null).order("created_at", { ascending: false }),
    db.from("customer_relationships").select("id, customer_id, related_customer_id, relationship_type, notes").or(`customer_id.eq.${id},related_customer_id.eq.${id}`).order("created_at"),
  ]);

  // Relationships are bidirectional — one row is visible from both customers.
  // The "other party" is whichever side isn't this customer.
  const relRows = (relsRes.data ?? []) as { id: string; customer_id: string; related_customer_id: string; relationship_type: string | null; notes: string | null }[];
  const otherOf = (r: { customer_id: string; related_customer_id: string }) =>
    r.customer_id === id ? r.related_customer_id : r.customer_id;
  const relatedById = new Map<string, any>();
  if (relRows.length) {
    const relatedIds = [...new Set(relRows.map(otherOf))];
    const { data: relCustomers } = await db
      .from("customers")
      .select(`id, first_name, last_name, company_name, customer_type, customer_number, leads(status, gross_value), contracts(id)`)
      .in("id", relatedIds);
    for (const rc of relCustomers ?? []) relatedById.set(rc.id, rc);
  }
  const relationships: CustomerRelationship[] = relRows.map((r) => {
    const rc = relatedById.get(otherOf(r));
    const relLeads = (rc?.leads ?? []) as { status: string | null; gross_value: number | null }[];
    return {
      id: r.id,
      relationshipType: r.relationship_type,
      notes: r.notes,
      related: rc
        ? {
            id: rc.id,
            name: displayName(rc),
            customerNumber: rc.customer_number ?? null,
            contractCount: (rc.contracts ?? []).length,
            liveLeadCount: relLeads.filter((l) => isLiveLead(l.status)).length,
            lifetimeValue: relLeads
              .filter((l) => l.status === "won")
              .reduce((s, l) => s + Number(l.gross_value ?? 0), 0),
          }
        : null,
    };
  });

  const leads = ((c.leads ?? []) as CustomerLead[]).slice().sort(
    (a, b) => leadDate(b) - leadDate(a),
  );
  const contracts = (c.contracts ?? []) as ContractSummary[];
  const liveLeadCount = leads.filter((l) => isLiveLead(l.status)).length;
  const lifetimeValue = leads
    .filter((l) => l.status === "won")
    .reduce((sum, l) => sum + Number(l.gross_value ?? 0), 0);

  // Merge custom-field definitions with any stored values.
  const valueByDef = new Map<number, any>();
  for (const v of (valsRes.data ?? []) as { definition_id: number; value: string | null; initials: string | null }[]) {
    valueByDef.set(v.definition_id, v);
  }
  const customFields: CustomFieldEntry[] = (
    (defsRes.data ?? []) as { id: number; question: string; data_type: string; required: boolean | null }[]
  ).map((d) => ({
    definitionId: d.id,
    question: d.question,
    dataType: d.data_type,
    required: !!d.required,
    value: valueByDef.get(d.id)?.value ?? null,
    initials: valueByDef.get(d.id)?.initials ?? null,
  }));

  return {
    ...(c as CustomerFields),
    displayName: displayName(c),
    leads,
    contracts,
    leadCount: leads.length,
    liveLeadCount,
    contractCount: contracts.length,
    lifetimeValue,
    contacts: (contactsRes.data ?? []) as CustomerContact[],
    accountReferences: (refsRes.data ?? []) as AccountReference[],
    customFields,
    documents: (docsRes.data ?? []) as CustomerDoc[],
    customerNotes: (notesRes.data ?? []) as CustomerNote[],
    relationships,
  };
}

/** Lightweight customer search for the relationship picker. */
export async function searchCustomersForLink(
  query: string,
  excludeId: string,
): Promise<{ id: string; name: string; customerNumber: number | null; town: string | null }[]> {
  const supabase = await createClient();
  const db = supabase as unknown as { from(t: string): any };
  let q = db
    .from("customers")
    .select("id, first_name, last_name, company_name, customer_type, customer_number, town")
    .neq("id", excludeId)
    .limit(10);
  const term = query.trim();
  if (term) {
    const like = `%${term}%`;
    q = q.or(`first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like},town.ilike.${like},postcode.ilike.${like}`);
  } else {
    q = q.order("created_at", { ascending: false });
  }
  const { data } = await q;
  return ((data ?? []) as any[]).map((c) => ({
    id: c.id,
    name: displayName(c),
    customerNumber: c.customer_number ?? null,
    town: c.town ?? null,
  }));
}

function displayName(c: CustomerFields): string {
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return c.customer_type === "commercial"
    ? c.company_name || person || "Unnamed customer"
    : person || "Unnamed customer";
}

function leadDate(l: CustomerLead): number {
  const d = l.lead_date ?? l.created_at;
  const t = d ? new Date(d).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}
