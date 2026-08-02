"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { CONTRACT_STAGES } from "@/lib/contracts";
import { addNote } from "@/app/(app)/notes/actions";
import {
  CONTRACTS_PAGE_SIZE,
  getBoardColumn,
  getContracts,
  type ContractFilters,
  type ContractRow,
} from "@/lib/data/contracts";

/**
 * Load one more chunk of contract rows for the list's infinite scroll. Same
 * allowlisted filter/sort path as the initial server render, so paging stays
 * correct and injection-safe.
 */
export async function loadContractRows(
  filters: ContractFilters,
  page: number,
): Promise<{ views: ContractRow[]; total: number; hasMore: boolean }> {
  const { rows, total } = await getContracts({ ...filters, page });
  return { views: rows, total, hasMore: page * CONTRACTS_PAGE_SIZE < total };
}

/** One more page of a single board column, for its own infinite scroll. */
export async function loadContractBoardColumn(
  filters: ContractFilters,
  stage: string,
  page: number,
): Promise<{ cards: ContractRow[]; total: number; hasMore: boolean }> {
  return getBoardColumn(filters, stage, page);
}

/**
 * Move a contract to a stage from the board's drag-and-drop.
 *
 * RETURNS the error rather than throwing: the board moves the card
 * optimistically, so it needs to decide whether to keep the move or put the
 * card back. (Same split as moveLeadToStage / setLeadStage.)
 */
export async function moveContractToStage(
  contractId: string,
  stage: string,
): Promise<{ error?: string }> {
  if (!CONTRACT_STAGES.some((s) => s.key === stage)) {
    return { error: `"${stage}" is not a contract stage.` };
  }
  try {
    await setContractStage(contractId, stage);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not move the contract." };
  }
}

/**
 * Set a contract's stage, stamping the date that stage was reached if it has a
 * date column and doesn't already carry one. Re-visiting a stage does NOT
 * overwrite the original date — when it was first surveyed is a fact, and
 * dragging a card back and forth must not rewrite history.
 */
export async function setContractStage(contractId: string, stage: string): Promise<void> {
  const def = CONTRACT_STAGES.find((s) => s.key === stage);
  if (!def) return;

  const supabase = await createClient();
  const patch: Record<string, unknown> = { stage };

  if (def.dateColumn && def.dateColumn !== "contract_date" && def.dateColumn !== "cancel_date") {
    // Read first so an existing date is left alone.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as { from(t: string): any };
    const { data } = await db
      .from("contracts")
      .select(def.dateColumn)
      .eq("id", contractId)
      .maybeSingle();
    if (data && !data[def.dateColumn]) patch[def.dateColumn] = new Date().toISOString();
  }

  // The cancelled stage carries the cancellation flags with it, so the closed
  // state and the stage can't disagree.
  if (stage === "cancelled") {
    patch.contract_cancelled = true;
    patch.cancel_date = new Date().toISOString();
  } else {
    patch.contract_cancelled = false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from(t: string): any };
  const { error } = await db.from("contracts").update(patch).eq("id", contractId);
  if (error) throw new Error(`setContractStage: ${error.message}`);

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
}

// ---------------------------------------------------------------------------
// Inline editing

const EDITABLE_CONTRACT_FIELDS = new Set<string>([
  "contract_type", "contract_date", "source", "salesman", "sales_area", "sales_director",
  "installation_manager", "estimated_fitting_days", "delivery_method",
  "office_reference", "office_reference_2", "notes",
  "guarantee_number", "guarantee_date", "insurance_backed_guarantee_ref",
  "signboard_left", "signboard_date", "supply_only", "on_hold", "hold_reason",
  "gross_value", "fitting_directions", "invoice_name",
  "survey_date", "order_date", "install_start_date", "install_end_date", "completed_date",
]);

const NUMERIC_CONTRACT_FIELDS = new Set(["gross_value", "estimated_fitting_days"]);

/** Update a single contract field from the inline editor. */
export async function updateContractField(
  id: string,
  field: string,
  value: string | number | boolean | null,
): Promise<{ error?: string }> {
  if (!EDITABLE_CONTRACT_FIELDS.has(field)) {
    return { error: `Field "${field}" is not editable.` };
  }
  // "" from a combo means CLEARED — store null, never an empty string, or the
  // field reads blank but isn't (see AGENTS.md § Lookup dropdowns).
  let normalised: string | number | boolean | null =
    typeof value === "string" && value.trim() === "" ? null : value;
  if (NUMERIC_CONTRACT_FIELDS.has(field) && normalised != null) {
    const n = Number(String(normalised).replace(/[^0-9.]/g, ""));
    normalised = Number.isFinite(n) ? n : null;
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from(t: string): any };
  const { error } = await db.from("contracts").update({ [field]: normalised }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/contracts/${id}`);
  revalidatePath("/contracts");
  return {};
}

/**
 * Add a note to a contract. Goes through the shared note pipeline so it is
 * stamped (author + date/time) and versioned like every other note.
 */
export async function addContractNote(contractId: string, content: string): Promise<void> {
  const res = await addNote({ contractId, content });
  if (res.error) throw new Error(`addContractNote: ${res.error}`);
}

/** Toggle a contract checklist item between complete and pending. */
export async function toggleContractChecklistItem(
  itemId: number,
  contractId: string,
  done: boolean,
): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from(t: string): any };
  const { error } = await db
    .from("contract_checklist_items")
    .update({
      status: done ? "complete" : "pending",
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", itemId);
  if (error) throw new Error(`toggleContractChecklistItem: ${error.message}`);
  revalidatePath(`/contracts/${contractId}`);
}

// ---------------------------------------------------------------------------
// Conversion — lead → contract

export type ConvertResult = { error?: string; contractId?: string };

/**
 * Convert a lead into a contract.
 *
 * THE lead's data carries across (AGENTS.md § Contracts got the same
 * treatment): a contract is raised from a lead and the lead IS the exact job
 * being quoted, so the site address, customer, salesperson, source and value
 * all come with it rather than being retyped. After this the contract OWNS its
 * copy — a later edit to the lead must not rewrite a signed contract, which is
 * why these are separate columns and not a read-through.
 *
 * Only what conversion itself decides is asked for: contract date, type,
 * install manager, estimated fitting days.
 */
export async function convertLeadToContract(
  leadId: string,
  input: {
    contractDate?: string | null;
    contractType?: string | null;
    installationManager?: string | null;
    estimatedFittingDays?: string | null;
    grossValue?: string | null;
  },
): Promise<ConvertResult> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from(t: string): any; rpc(fn: string, args: object): any };

  const { data: lead, error: leadError } = await db
    .from("leads")
    .select(
      `id, customer_id, gross_value, estimated_value, source, salesman, sales_area,
       sales_director, product_type, contract_type, delivery_method, supply_only,
       office_reference, office_reference_2, installation_manager,
       estimated_fitting_days, fitting_directions, send_letters_to_fitting,
       site_same_as_customer, site_house_name, site_house_number, site_street,
       site_locality, site_town, site_county, site_postcode, site_what_3_words,
       invoice_same_as_customer`,
    )
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) return { error: leadError.message };
  if (!lead) return { error: "That lead no longer exists." };

  // One contract per lead. Converting twice would split one job's history in
  // two, and there is no way back once payments are recorded against both.
  const { data: existing } = await db
    .from("contracts")
    .select("id")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (existing) {
    return { error: "This lead has already been converted to a contract." };
  }

  // Per-tenant, gap-tolerant reference — the same counter leads and customers
  // use. Derives the tenant from the JWT, so it can only ever advance our own.
  const { data: number, error: refError } = await db.rpc("next_reference", {
    p_name: "contract",
  });
  if (refError) return { error: `Could not allocate a contract number: ${refError.message}` };

  const days = input.estimatedFittingDays?.trim()
    ? Number(input.estimatedFittingDays.replace(/[^0-9.]/g, ""))
    : lead.estimated_fitting_days;
  const value = input.grossValue?.trim()
    ? Number(input.grossValue.replace(/[^0-9.]/g, ""))
    : (lead.gross_value ?? lead.estimated_value);

  const payload = {
    company_id: await getCompanyId(),
    contract_number: number,
    lead_id: leadId,
    customer_id: lead.customer_id,
    contract_date: input.contractDate || new Date().toISOString(),
    stage: "signed",
    status: "active",
    // Asked for at conversion, falling back to whatever the lead already knew.
    contract_type: input.contractType || lead.contract_type || lead.product_type,
    installation_manager: input.installationManager || lead.installation_manager,
    estimated_fitting_days: Number.isFinite(days as number) ? days : null,
    gross_value: Number.isFinite(value as number) ? value : null,
    // Carried straight across from the lead.
    source: lead.source,
    salesman: lead.salesman,
    sales_area: lead.sales_area,
    sales_director: lead.sales_director,
    delivery_method: lead.delivery_method,
    supply_only: lead.supply_only,
    office_reference: lead.office_reference,
    office_reference_2: lead.office_reference_2,
    fitting_directions: lead.fitting_directions,
    send_letters_to_fitting: lead.send_letters_to_fitting,
    // The SITE address, copied so the contract owns it.
    site_same_as_customer: lead.site_same_as_customer,
    site_house_name: lead.site_house_name,
    site_house_number: lead.site_house_number,
    site_street: lead.site_street,
    site_locality: lead.site_locality,
    site_town: lead.site_town,
    site_county: lead.site_county,
    site_postcode: lead.site_postcode,
    site_what_3_words: lead.site_what_3_words,
    invoice_same_as_customer: lead.invoice_same_as_customer,
  };

  const { data: created, error } = await db
    .from("contracts")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { error: error.message };

  // The lead is won BY the conversion — recording it here keeps the two facts
  // from disagreeing, rather than relying on someone also dragging the card.
  await db
    .from("leads")
    .update({ status: "won", result: "won", result_date: new Date().toISOString() })
    .eq("id", leadId);

  revalidatePath("/contracts");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  if (lead.customer_id) revalidatePath(`/customers/${lead.customer_id}`);

  // Returns rather than redirecting, so the client owns the navigation — the
  // same shape createLead settled on.
  return { contractId: created.id as string };
}
