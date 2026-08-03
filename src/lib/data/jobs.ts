import { createClient } from "@/lib/supabase/server";
import { CONTRACT_STAGES, contractStage } from "@/lib/contracts";
import { LEAD_STAGES, leadStage } from "@/lib/leads";
import { contractRef, leadRef } from "@/lib/leads";
import { isCommercial } from "@/lib/format";

// ---------------------------------------------------------------------------
// "Which job is this appointment for?" — one search across CONTRACTS and LEADS.
//
// A booking is nearly always about a specific job: fitting C-1892, surveying
// L-2431. Without the link the appointment is an island — it can't show on the
// contract's Fitting tab, can't name the customer on the diary block, and
// can't be found from the record it belongs to.
//
// It searches BOTH kinds because both get visited: a lead is surveyed before it
// is a contract, and the same diary books both.
//
// SERVER-SIDE SEARCH, not a preloaded option list — deliberately. The customer
// picker that preloaded 500 names was deleted for being silently wrong past the
// cap (AGENTS.md § Capture first, match second), and a firm with 4,000
// contracts would hit exactly that. So this returns the top matches for a query
// and the picker asks again as you type.
// ---------------------------------------------------------------------------

export type JobKind = "contract" | "lead";

export type JobOption = {
  kind: JobKind;
  id: string;
  /** C-1892 / L-2431 — the identity, rendered as a chip in the picker. */
  ref: string;
  /** What the job IS ("Windows & doors", "uPVC Casement Windows"). */
  title: string;
  /** Canonical stage label, so the picker can say Signed / Quoted. */
  stageLabel: string;
  /** Still in flight — the default scope. */
  open: boolean;
  customerId: string | null;
  customerName: string | null;
};

/** Contracts still in flight (everything but complete and cancelled). */
const OPEN_CONTRACT_STAGES = CONTRACT_STAGES.filter((s) => s.open).map((s) => s.key);
/** Leads still in play — the pipeline minus the closed outcomes. */
const OPEN_LEAD_STAGES = LEAD_STAGES.filter((s) => s.key !== "won" && s.key !== "lost").map(
  (s) => s.key,
);

const HOW_MANY = 12;

const CUSTOMER_EMBED = `customers(id, first_name, last_name, company_name, customer_type)`;

/**
 * Jobs matching `query`, newest first, capped per kind.
 *
 * `scope: "open"` (the default) is what you almost always want — a booking is
 * for work still to do. `"all"` reaches back for the finished job that needs a
 * remedial visit, which is a real errand and the reason the toggle exists.
 *
 * FAILS SOFT: a picker that can't reach the database must not stop someone
 * booking the appointment in front of them — they can link it afterwards.
 */
export async function searchJobs({
  query = "",
  scope = "open",
  kinds = ["contract", "lead"],
}: {
  query?: string;
  scope?: "open" | "all";
  kinds?: JobKind[];
} = {}): Promise<JobOption[]> {
  const q = query.trim();
  const [contracts, leads] = await Promise.all([
    kinds.includes("contract") ? searchContracts(q, scope) : Promise.resolve([]),
    kinds.includes("lead") ? searchLeads(q, scope) : Promise.resolve([]),
  ]);

  // Contracts first: a signed job outranks an enquiry when both match, because
  // that's the one with fitters booked against it.
  return [...contracts, ...leads];
}

async function searchContracts(q: string, scope: "open" | "all"): Promise<JobOption[]> {
  try {
    const supabase = await createClient();
    let sel = supabase
      .from("contracts")
      .select(
        `id, contract_number, contract_type, stage, customer_id, ${CUSTOMER_EMBED},
         leads(product_type, product_interest_1)`,
      )
      .order("contract_number", { ascending: false, nullsFirst: false })
      .limit(HOW_MANY);

    if (scope === "open") sel = sel.in("stage", OPEN_CONTRACT_STAGES);
    if (q) {
      const ids = await matchingCustomerIds(supabase, q);
      sel = sel.or(orFilter(q, "contract_number", ["contract_type"], ids));
    }

    const { data, error } = await sel;
    if (error) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data ?? []) as any[]).map((ct) => {
      const stage = contractStage(ct.stage);
      return {
        kind: "contract" as const,
        id: ct.id,
        ref: contractRef(ct.contract_number),
        // A contract has no title column: its subject is what was sold, falling
        // back to the originating lead's product — the same rule the list uses.
        title:
          ct.contract_type ??
          ct.leads?.product_type ??
          ct.leads?.product_interest_1 ??
          "Contract",
        stageLabel: stage.label,
        open: stage.open,
        customerId: ct.customer_id ?? null,
        customerName: nameOf(ct.customers),
      };
    });
  } catch {
    return [];
  }
}

async function searchLeads(q: string, scope: "open" | "all"): Promise<JobOption[]> {
  try {
    const supabase = await createClient();
    let sel = supabase
      .from("leads")
      .select(
        `id, lead_number, product_type, product_interest_1, status, customer_id, ${CUSTOMER_EMBED}`,
      )
      .order("lead_number", { ascending: false, nullsFirst: false })
      .limit(HOW_MANY);

    if (scope === "open") sel = sel.in("status", OPEN_LEAD_STAGES);
    if (q) {
      const ids = await matchingCustomerIds(supabase, q);
      sel = sel.or(orFilter(q, "lead_number", ["product_type", "product_interest_1"], ids));
    }

    const { data, error } = await sel;
    if (error) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data ?? []) as any[]).map((l) => ({
      kind: "lead" as const,
      id: l.id,
      ref: leadRef(l.lead_number),
      title: l.product_type ?? l.product_interest_1 ?? "Lead",
      stageLabel: leadStage(l.status).label,
      open: l.status !== "won" && l.status !== "lost",
      customerId: l.customer_id ?? null,
      customerName: nameOf(l.customers),
    }));
  } catch {
    return [];
  }
}

/**
 * One PostgREST `or()` covering the reference number, the job's own text and
 * the customer. Values are QUOTED (`orValue`) — the filter string is comma- and
 * paren-delimited, so an unquoted "Smith, J" builds a malformed filter. Column
 * names are literals here, never interpolated from input.
 */
function orFilter(q: string, numberColumn: string, textColumns: string[], customerIds: string[]) {
  const like = orValue(`%${escapeLike(q)}%`);
  const parts = textColumns.map((c) => `${c}.ilike.${like}`);

  // "1892" and "C-1892" should both find contract 1892.
  const asNumber = Number(q.replace(/^[a-z]+-?/i, ""));
  if (Number.isFinite(asNumber) && asNumber > 0) parts.push(`${numberColumn}.eq.${asNumber}`);
  if (customerIds.length) parts.push(`customer_id.in.(${customerIds.join(",")})`);

  return parts.join(",");
}

/**
 * Customers matching the query, so "Ellison" finds her contract. PostgREST
 * can't OR an embedded column against the parent's, so the ids are resolved
 * first and folded into the same filter — the pattern `getLeads` already uses.
 */
async function matchingCustomerIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  q: string,
): Promise<string[]> {
  const like = orValue(`%${escapeLike(q)}%`);
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .or(
      ["first_name", "last_name", "company_name", "town", "postcode"]
        .map((c) => `${c}.ilike.${like}`)
        .join(","),
    )
    .limit(200);
  // Fails soft: the reference/title half of the search still works.
  if (error) return [];
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nameOf(c: any): string | null {
  if (!c) return null;
  if (isCommercial(c.customer_type) && c.company_name) return c.company_name;
  return (
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.company_name || null
  );
}

function orValue(v: string): string {
  return `"${v.replace(/[\\"]/g, "\\$&")}"`;
}

function escapeLike(v: string): string {
  return v.replace(/[%_]/g, "\\$&");
}
