"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { LEAD_STAGES } from "@/lib/leads";
import { addNote } from "@/app/(app)/notes/actions";
import { insertCustomer } from "@/lib/data/customer-write";
import { matchCustomers, type CustomerMatch, type MatchCriteria } from "@/lib/data/customer-match";
import {
  LEADS_PAGE_SIZE,
  getBoardColumn,
  getLeads,
  type LeadFilters,
  type LeadRow,
} from "@/lib/data/leads";
import type { Database } from "@/lib/supabase/types";

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];

export type LeadFormState = { error?: string };

/**
 * Load one more chunk of lead rows for the list's infinite scroll. Same
 * allowlisted filter/sort path as the initial server render, so paging stays
 * correct and injection-safe.
 */
export async function loadLeadRows(
  filters: LeadFilters,
  page: number,
): Promise<{ views: LeadRow[]; total: number; hasMore: boolean }> {
  const { rows, total } = await getLeads({ ...filters, page });
  return { views: rows, total, hasMore: page * LEADS_PAGE_SIZE < total };
}

/** One more page of a single board column, for its own infinite scroll. */
export async function loadBoardColumn(
  filters: LeadFilters,
  stage: string,
  page: number,
): Promise<{ cards: LeadRow[]; total: number; hasMore: boolean }> {
  return getBoardColumn(filters, stage, page);
}

/**
 * Move a lead to a stage from the board's drag-and-drop.
 *
 * Unlike `setLeadStage` (which throws, because its caller is a fire-and-forget
 * click), this RETURNS the error: the board moves the card optimistically, so
 * it needs to know whether to keep the move or put the card back.
 */
export async function moveLeadToStage(
  leadId: string,
  status: string,
): Promise<{ error?: string }> {
  if (!LEAD_STAGES.some((s) => s.key === status)) {
    return { error: `"${status}" is not a lead stage.` };
  }
  try {
    await setLeadStage(leadId, status);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not move the lead." };
  }
}

const TEXT_FIELDS = [
  "source",
  "sub_source",
  "product_type",
  "product_interest_1",
  "product_interest_2",
  "salesman",
  "salesperson_type",
  "status",
  "priority",
  "quote_type",
  "payment_method",
  "notes",
] as const;

/** Submitted as text, stored as a number. */
const NUMERIC_FIELDS = ["gross_value", "estimated_value", "window_count"] as const;

/**
 * Candidate customers for the details captured so far. Called (debounced) from
 * the New Lead capture step as the taker types — it only ever SUGGESTS; the
 * link itself is always an explicit click in the UI.
 */
export async function findCustomerMatches(criteria: MatchCriteria): Promise<CustomerMatch[]> {
  try {
    return await matchCustomers(criteria);
  } catch {
    // Matching is an assist, not a gate: a failed lookup must never stop someone
    // logging the enquiry in front of them.
    return [];
  }
}

// The customer fields the lead capture collects. `c_`-prefixed in the form so
// they can't collide with the lead's own columns (both have `notes`, `source`…).
const CAPTURE_FIELDS = [
  "customer_type", "title", "first_name", "last_name", "company_name",
  "email", "mobile", "home_telephone",
  "house_name", "house_number", "street", "locality", "town", "county",
  "postcode", "what_3_words",
] as const;

/**
 * Fields a lead capture may write back onto an EXISTING customer. Deliberately
 * contact + address only: a name is the customer's identity, and correcting one
 * from a lead capture is a different, deliberate act on the record itself.
 */
const PATCHABLE_ON_LINK = new Set<string>([
  "email", "mobile", "home_telephone",
  "house_name", "house_number", "street", "locality", "town", "county",
  "postcode", "what_3_words",
]);

/** The lead's own site address, when the work isn't at the customer's address. */
const SITE_FIELDS = [
  "house_name", "house_number", "street", "locality", "town", "county",
  "postcode", "what_3_words",
] as const;

/** Create a lead. Reference number comes from the tenant counter (RPC). */
export async function createLead(
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const get = (k: string) => {
    const v = formData.get(k);
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" ? null : s;
  };

  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session. Please sign in again." };

  // --- Who is it for: an existing customer, or one created from the capture ---
  const capture: Record<string, string | null> = {};
  for (const f of CAPTURE_FIELDS) capture[f] = get(`c_${f}`);

  let customerId = get("customer_id");

  if (customerId) {
    const patch = await patchLinkedCustomer(supabase, customerId, capture, formData);
    if (patch.error) return { error: patch.error };
  } else {
    if (!capture.first_name || !capture.last_name) {
      return { error: "Enter the customer's first and last name, or link an existing customer." };
    }
    const commercial = (capture.customer_type ?? "").toLowerCase() === "commercial";
    if (commercial && !capture.company_name) {
      return { error: "Company name is required for a commercial customer." };
    }
    const created = await insertCustomer({ ...capture, customer_type: capture.customer_type ?? "residential" });
    if (created.error || !created.id) {
      return { error: created.error ?? "Could not create the customer." };
    }
    customerId = created.id;
  }

  const data: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) data[f] = get(f);

  for (const f of NUMERIC_FIELDS) {
    const raw = get(f);
    if (raw == null) continue;
    const n = Number(raw.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n)) data[f] = n;
  }
  const followUp = get("follow_up_date");
  if (followUp) data.follow_up_date = followUp;
  const quoteDate = get("quote_date");
  if (quoteDate) data.quote_date = quoteDate;

  data.status ??= "new";
  data.priority ??= "medium";
  data.customer_id = customerId;
  // The date the enquiry arrived — defaults to now, but the wizard lets it be
  // backdated for a lead being entered after the fact.
  data.lead_date = get("lead_date") ?? new Date().toISOString();

  // --- Where the work is ----------------------------------------------------
  // A site address that is blank, or identical to the customer's, IS the
  // customer's — recorded as site_same_as_customer so the lead record keeps
  // rendering the live customer address rather than a frozen copy of it.
  const site: Record<string, string | null> = {};
  for (const f of SITE_FIELDS) site[f] = get(`site_${f}`);
  const siteDiffers =
    SITE_FIELDS.some((f) => site[f]) &&
    SITE_FIELDS.some((f) => norm(site[f]) !== norm(capture[f]));
  if (siteDiffers) {
    data.site_same_as_customer = false;
    for (const f of SITE_FIELDS) data[`site_${f}`] = site[f];
  } else {
    data.site_same_as_customer = true;
  }

  // Per-tenant human reference (atomic, derives tenant from the JWT).
  const { data: leadNumber, error: refError } = await supabase.rpc("next_reference", {
    p_name: "lead",
  });
  if (refError) return { error: refError.message };

  const { data: inserted, error } = await supabase
    .from("leads")
    .insert({
      ...data,
      company_id: companyId,
      lead_number: Number(leadNumber),
    } as LeadInsert)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/leads");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/leads/${inserted.id}`);
}

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/**
 * Reconcile the captured details against the customer they were linked to.
 *
 * Two rules, decided 2026-07-23:
 *   - A field the customer has BLANK is filled from the capture. Nothing is
 *     lost, nothing is overwritten — an enquiry that yields the first email
 *     address on a ten-year-old record should record it.
 *   - A field that already has a DIFFERENT value is only changed if the user
 *     explicitly ticked it on Review (`apply_updates`). Otherwise the record
 *     wins: a mistyped number must never silently replace a good one.
 *
 * Names are not patchable at all (see PATCHABLE_ON_LINK) — they identify the
 * customer, and correcting one belongs on the record.
 */
async function patchLinkedCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  capture: Record<string, string | null>,
  formData: FormData,
): Promise<{ error?: string }> {
  const applyRaw = formData.get("apply_updates");
  let apply: string[] = [];
  try {
    const parsed = typeof applyRaw === "string" && applyRaw ? JSON.parse(applyRaw) : [];
    if (Array.isArray(parsed)) apply = parsed.filter((f): f is string => typeof f === "string");
  } catch {
    apply = [];
  }

  const cols = [...PATCHABLE_ON_LINK];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: existing, error: readError } = await db
    .from("customers")
    .select(cols.join(", "))
    .eq("id", customerId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!existing) return { error: "That customer no longer exists." };

  const patch: Record<string, string> = {};
  for (const col of cols) {
    const typed = capture[col];
    if (!typed) continue;
    const current = (existing as Record<string, unknown>)[col];
    const currentStr = typeof current === "string" ? current.trim() : "";
    if (!currentStr) {
      patch[col] = typed; // blank on the record — fill it
    } else if (norm(currentStr) !== norm(typed) && apply.includes(col)) {
      patch[col] = typed; // conflicting, and the user chose the new value
    }
  }

  if (Object.keys(patch).length === 0) return {};
  const { error } = await db.from("customers").update(patch).eq("id", customerId);
  if (error) return { error: error.message };
  return {};
}

/** Move a lead to a new pipeline stage. Called from the lead detail header. */
export async function setLeadStage(leadId: string, status: string): Promise<void> {
  const valid = LEAD_STAGES.some((s) => s.key === status);
  if (!valid) return;

  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  // Record the outcome + date when a lead closes.
  if (status === "won") {
    patch.result = "won";
    patch.result_date = new Date().toISOString();
  } else if (status === "lost") {
    patch.result = "lost";
    patch.result_date = new Date().toISOString();
  } else {
    patch.result = "alive";
    patch.result_date = null;
  }
  if (status === "quoted") patch.quote_date = new Date().toISOString();

  const { error } = await supabase
    .from("leads")
    .update(patch as Database["public"]["Tables"]["leads"]["Update"])
    .eq("id", leadId);
  if (error) throw new Error(`setLeadStage: ${error.message}`);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

const EDITABLE_LEAD_FIELDS = new Set<string>([
  "salesman", "salesperson_type", "source", "sub_source", "product_type",
  "product_interest_1", "product_interest_2", "window_count", "gross_value",
  "estimated_value", "priority", "follow_up_date", "notes",
  "quote_type", "quote_date", "payment_method", "result_reason", "lead_date",
]);

const NUMERIC_LEAD_FIELDS = new Set(["window_count", "gross_value", "estimated_value"]);

/** Update a single lead field from the inline editor. */
export async function updateLeadField(
  id: string,
  field: string,
  value: string | number | boolean | null,
): Promise<{ error?: string }> {
  if (!EDITABLE_LEAD_FIELDS.has(field)) {
    return { error: `Field "${field}" is not editable.` };
  }
  let normalised: string | number | boolean | null =
    typeof value === "string" && value.trim() === "" ? null : value;
  if (NUMERIC_LEAD_FIELDS.has(field) && normalised != null) {
    const n = Number(String(normalised).replace(/[^0-9.]/g, ""));
    normalised = Number.isFinite(n) ? n : null;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ [field]: normalised } as Database["public"]["Tables"]["leads"]["Update"])
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  return {};
}

/**
 * Add a note to a lead's timeline. Goes through the shared note pipeline so it
 * is stamped (author + date/time) and versioned like every other note.
 */
export async function addLeadNote(leadId: string, content: string): Promise<void> {
  const res = await addNote({ leadId, content });
  if (res.error) throw new Error(`addLeadNote: ${res.error}`);
}

/** Toggle a checklist item between complete and pending. */
export async function toggleChecklistItem(
  itemId: number,
  leadId: string,
  done: boolean,
): Promise<void> {
  const supabase = await createClient();
  const patch = done
    ? { status: "completed", completed_at: new Date().toISOString() }
    : { status: "pending", completed_at: null };
  const { error } = await supabase
    .from("lead_checklist_items")
    .update(patch as Database["public"]["Tables"]["lead_checklist_items"]["Update"])
    .eq("id", itemId);
  if (error) throw new Error(`toggleChecklistItem: ${error.message}`);
  revalidatePath(`/leads/${leadId}`);
}
