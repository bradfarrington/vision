"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { LEAD_STAGES } from "@/lib/leads";
import { addNote } from "@/app/(app)/notes/actions";
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
  "customer_id",
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

  const customerId = get("customer_id");
  if (!customerId) return { error: "Choose the customer this lead is for." };

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
  // The date the enquiry arrived — defaults to now, but the wizard lets it be
  // backdated for a lead being entered after the fact.
  data.lead_date = get("lead_date") ?? new Date().toISOString();

  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session. Please sign in again." };

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
  if (customerId) revalidatePath(`/customers/${customerId}`);
  redirect(`/leads/${inserted.id}`);
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
