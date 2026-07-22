/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import { isLiveLead, contractRef } from "@/lib/leads";
import { isCommercial } from "@/lib/format";
import type { CustomerLead, ContractSummary } from "./customers";
import {
  DOCUMENT_SELECT,
  DOCUMENT_SELECT_BASE,
  mapDocumentRow,
  selectWithFallback,
  type DocumentItem,
} from "./documents";
import { NOTE_SELECT, NOTE_SELECT_BASE, mapNoteRow, type NoteItem } from "./notes";

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
  /** tenant_options list_key when this field is a dropdown; null for free text. */
  listKey: string | null;
  value: string | null;
  initials: string | null;
};

// Documents share the reusable DocumentItem shape (see ./documents) so the same
// panel/viewer render them here and on leads/contracts.
export type CustomerDoc = DocumentItem;

/** A customer-level note (stamped, versioned, optionally linked — see ./notes). */
export type CustomerNote = NoteItem;

export type MarketingNote = {
  id: string;
  content: string;
  created_at: string;
  author: string | null;
};

export type CustomerRelationship = {
  id: string;
  /** How the relationship reads from the customer being viewed. */
  label: string | null;
  /** How it reads from the other customer's side (the reverse wording). */
  labelOtherSide: string | null;
  /** True when the viewed customer is the customer_id / "a" side of the row. */
  viewerIsA: boolean;
  /** Both sides read the same (Family, Neighbour…) → read as "X's neighbour". */
  symmetric: boolean;
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

export type RelationshipType = {
  id: number;
  forwardLabel: string;
  inverseLabel: string;
};

export type ContractLine = {
  id: string;
  contractNumber: number | null;
  ref: string;
  value: number;
  balance: number;
  status: string | null;
  date: string | null;
  type: string | null;
  leadId: string | null;
};

export type CustomerFinancials = {
  lifetimeValue: number;
  outstandingTotal: number;
  outstanding: ContractLine[];
  completed: ContractLine[];
};

export type TenantOption = { id: string; label: string };

/** The tenant's editable relationship-type pairs. */
export async function getRelationshipTypes(): Promise<RelationshipType[]> {
  const supabase = await createClient();
  const db = supabase as unknown as { from(t: string): any };
  const { data } = await db
    .from("relationship_types")
    .select("id, forward_label, inverse_label")
    .eq("is_active", true)
    .order("sort_order")
    .order("forward_label");
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    forwardLabel: r.forward_label,
    inverseLabel: r.inverse_label,
  }));
}

/** Several tenant option lists at once, grouped by list_key. */
export async function getTenantOptionLists(
  keys: string[],
): Promise<Record<string, TenantOption[]>> {
  const supabase = await createClient();
  const db = supabase as unknown as { from(t: string): any };
  const { data } = await db
    .from("tenant_options")
    .select("id, list_key, label")
    .in("list_key", keys)
    .eq("is_active", true)
    .order("sort_order")
    .order("label");
  const out: Record<string, TenantOption[]> = {};
  for (const k of keys) out[k] = [];
  for (const r of (data ?? []) as { id: string; list_key: string; label: string }[]) {
    (out[r.list_key] ??= []).push({ id: r.id, label: r.label });
  }
  return out;
}

/** A tenant's editable option list (generic pick-lists). */
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
  /** The default contact (or first) — shown as the overview "Main" contact. */
  mainContact: CustomerContact | null;
  accountReferences: AccountReference[];
  customFields: CustomFieldEntry[];
  documents: CustomerDoc[];
  customerNotes: CustomerNote[];
  marketingNotes: MarketingNote[];
  relationships: CustomerRelationship[];
  financials: CustomerFinancials;
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
  const [contactsRes, refsRes, defsRes, valsRes, docsRes, notesRes, relsRes, mktgNotesRes] = await Promise.all([
    db.from("customer_contacts").select("id, name, email, phone, position_role, is_default, no_whatsapp").eq("customer_id", id).order("is_default", { ascending: false }),
    db.from("customer_account_references").select("id, reference, acc_name").eq("customer_id", id),
    db.from("custom_field_definitions").select("id, question, data_type, required, sort_order, list_key").eq("entity", "customer").eq("is_active", true).order("sort_order"),
    db.from("custom_field_values").select("definition_id, value, initials").eq("customer_id", id),
    selectWithFallback(
      () => db.from("documents").select(DOCUMENT_SELECT).eq("customer_id", id).order("created_at", { ascending: false }),
      () => db.from("documents").select(DOCUMENT_SELECT_BASE).eq("customer_id", id).order("created_at", { ascending: false }),
    ),
    // Every non-marketing note on this customer — including ones pinned to a
    // lead or contract, so the Notes tab is the customer's full picture.
    selectWithFallback(
      () => db.from("lead_notes").select(NOTE_SELECT).eq("customer_id", id).or("category.is.null,category.neq.marketing").order("created_at", { ascending: false }),
      () => db.from("lead_notes").select(NOTE_SELECT_BASE).eq("customer_id", id).or("category.is.null,category.neq.marketing").order("created_at", { ascending: false }),
    ),
    db.from("customer_relationships").select("id, customer_id, related_customer_id, label_a, label_b, notes").or(`customer_id.eq.${id},related_customer_id.eq.${id}`).order("created_at"),
    db.from("lead_notes").select("id, content, created_at, users:created_by(first_name, last_name)").eq("customer_id", id).eq("category", "marketing").order("created_at", { ascending: false }),
  ]);
  const marketingNotes: MarketingNote[] = ((mktgNotesRes.data ?? []) as any[]).map((n) => ({
    id: n.id,
    content: n.content,
    created_at: n.created_at,
    author: n.users
      ? [n.users.first_name, n.users.last_name].filter(Boolean).join(" ").trim() || null
      : null,
  }));

  // Relationships are bidirectional — one row is visible from both customers,
  // worded per side (label_a = customer_id's side, label_b = related's side).
  const relRows = (relsRes.data ?? []) as { id: string; customer_id: string; related_customer_id: string; label_a: string | null; label_b: string | null; notes: string | null }[];
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
    const viewerIsA = r.customer_id === id;
    return {
      id: r.id,
      label: viewerIsA ? r.label_a : r.label_b,
      labelOtherSide: viewerIsA ? r.label_b : r.label_a,
      viewerIsA,
      symmetric: r.label_a != null && r.label_a === r.label_b,
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
    (defsRes.data ?? []) as { id: number; question: string; data_type: string; required: boolean | null; list_key: string | null }[]
  ).map((d) => ({
    definitionId: d.id,
    question: d.question,
    dataType: d.data_type,
    required: !!d.required,
    listKey: d.list_key ?? null,
    value: valueByDef.get(d.id)?.value ?? null,
    initials: valueByDef.get(d.id)?.initials ?? null,
  }));

  const contactList = (contactsRes.data ?? []) as CustomerContact[];

  // Contract financials — balance = contract value minus payments recorded on
  // finance_lines, grouped into outstanding vs completed & paid.
  const contractIds = contracts.map((ct) => ct.id);
  const paidByContract = new Map<string, number>();
  if (contractIds.length) {
    const { data: finLines } = await db
      .from("finance_lines")
      .select("contract_id, payment_amount")
      .in("contract_id", contractIds);
    for (const fl of finLines ?? []) {
      if (!fl.contract_id) continue;
      paidByContract.set(
        fl.contract_id,
        (paidByContract.get(fl.contract_id) ?? 0) + Number(fl.payment_amount ?? 0),
      );
    }
  }
  const contractLines: ContractLine[] = contracts.map((ct) => {
    const value = Number(ct.gross_value ?? 0);
    const paid = paidByContract.get(ct.id) ?? 0;
    return {
      id: ct.id,
      contractNumber: ct.contract_number,
      ref: contractRef(ct.contract_number),
      value,
      balance: Math.round((value - paid) * 100) / 100,
      status: ct.status,
      date: ct.contract_date,
      type: ct.contract_type,
      leadId: ct.lead_id,
    };
  });
  const cancelled = (s: string | null) => (s ?? "").toLowerCase() === "cancelled";
  const outstanding = contractLines.filter((l) => l.balance > 0.005 && !cancelled(l.status));
  const completed = contractLines.filter((l) => l.balance <= 0.005 || cancelled(l.status));
  const financials: CustomerFinancials = {
    lifetimeValue: contractLines.reduce((s, l) => s + l.value, 0),
    outstandingTotal: outstanding.reduce((s, l) => s + l.balance, 0),
    outstanding,
    completed,
  };

  return {
    ...(c as CustomerFields),
    displayName: displayName(c),
    leads,
    contracts,
    leadCount: leads.length,
    liveLeadCount,
    contractCount: contracts.length,
    lifetimeValue,
    contacts: contactList,
    mainContact: contactList.find((ct) => ct.is_default) ?? contactList[0] ?? null,
    accountReferences: (refsRes.data ?? []) as AccountReference[],
    customFields,
    documents: ((docsRes.data ?? []) as any[]).map(mapDocumentRow),
    customerNotes: ((notesRes.data ?? []) as any[]).map(mapNoteRow),
    marketingNotes,
    relationships,
    financials,
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
  return isCommercial(c.customer_type)
    ? c.company_name || person || "Unnamed customer"
    : person || "Unnamed customer";
}

function leadDate(l: CustomerLead): number {
  const d = l.lead_date ?? l.created_at;
  const t = d ? new Date(d).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}
