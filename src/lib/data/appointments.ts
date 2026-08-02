import { createClient } from "@/lib/supabase/server";
import { isCommercial } from "@/lib/format";
import { contractRef, leadRef } from "@/lib/leads";
import { workCategory, type WorkCategory } from "@/lib/appointments";

// The diary's data layer. ONE table backs every booking (see AGENTS.md § One
// appointment table), so a single range query serves the day, week and month
// views AND the availability engine — which is the whole point of the merge:
// "is Dave free on Tuesday?" must never have to ask two tables and remember to
// union them.

/** A booking, resolved for the diary with everything a block needs to render. */
export type DiaryEvent = {
  id: string;
  title: string;
  /** The tenant's own appointment_type ("Survey", "Measure up", …). */
  type: string | null;
  workType: string | null;
  /** Colour band, derived from the type words — see workCategory(). */
  category: WorkCategory;
  startsAt: string;
  /** Minutes. The single duration unit. */
  duration: number | null;
  travelMinutes: number | null;
  status: string;
  provisional: boolean;
  notes: string | null;
  description: string | null;
  location: string | null;
  staffIds: string[];
  staffNames: string[];
  /** Free-text single assignee from before multi-staff — still shown if set. */
  assignedTo: string | null;
  customerId: string | null;
  customerName: string | null;
  customerAddress: string | null;
  leadId: string | null;
  leadRef: string | null;
  contractId: string | null;
  contractRef: string | null;
};

export type DiaryFilters = {
  /** Inclusive lower bound. */
  from: string;
  /** EXCLUSIVE upper bound — the first instant after the window, like the
   *  list's date range. A `<=` bound silently drops the last day's bookings. */
  to: string;
  /** Only these staff (matched against staff_ids). Empty = everyone. */
  staffIds?: string[];
  /** Only these colour bands. Empty = all. */
  categories?: WorkCategory[];
};

const SELECT = `id, title, type, work_type, description, starts_at, duration, travel_minutes,
  status, locked, notes, location, staff_ids, staff_names, assigned_to,
  customer_id, lead_id, contract_id,
  customers(id, first_name, last_name, company_name, customer_type,
    house_name, house_number, street, town, postcode),
  leads(id, lead_number),
  contracts(id, contract_number)`;

/**
 * Every booking in a window. RLS scopes it to the tenant.
 *
 * The staff and category filters are applied HERE rather than by each view, so
 * the day, week and month views can never disagree about which jobs exist —
 * the same rule `applyLeadFilters` encodes for the leads list.
 */
export async function getDiary(filters: DiaryFilters): Promise<DiaryEvent[]> {
  const supabase = await createClient();

  let q = supabase
    .from("appointments")
    .select(SELECT)
    .gte("starts_at", filters.from)
    .lt("starts_at", filters.to)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true });

  // Array containment: the row's staff_ids must overlap the requested set.
  if (filters.staffIds?.length) q = q.overlaps("staff_ids", filters.staffIds);

  const { data, error } = await q;
  if (error) throw new Error(`getDiary: ${error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data ?? []) as any[]).map(toDiaryEvent);
  // Category is derived from free text, so it can't be a DB predicate — it is
  // the ONE post-filter here, and it's safe because the window is already
  // bounded by date (no paging to get wrong).
  if (!filters.categories?.length) return rows;
  const wanted = new Set(filters.categories);
  return rows.filter((e) => wanted.has(e.category));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDiaryEvent(a: any): DiaryEvent {
  const c = a.customers;
  const customerName = c
    ? isCommercial(c.customer_type) && c.company_name
      ? c.company_name
      : [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.company_name || "Unknown"
    : null;
  const address = c
    ? [
        [c.house_name, c.house_number, c.street].filter(Boolean).join(" ").trim(),
        c.town,
        c.postcode,
      ]
        .filter(Boolean)
        .join(", ") || null
    : null;

  return {
    id: a.id,
    title: a.title ?? "Appointment",
    type: a.type ?? null,
    workType: a.work_type ?? null,
    category: workCategory(a.type, a.work_type).key,
    startsAt: a.starts_at,
    duration: a.duration ?? null,
    travelMinutes: a.travel_minutes ?? null,
    status: a.status ?? "confirmed",
    provisional: a.status === "provisional",
    notes: a.notes ?? null,
    description: a.description ?? null,
    location: a.location ?? null,
    staffIds: a.staff_ids ?? [],
    staffNames: a.staff_names ?? [],
    assignedTo: a.assigned_to ?? null,
    customerId: a.customer_id ?? null,
    customerName,
    customerAddress: address,
    leadId: a.lead_id ?? null,
    leadRef: a.leads?.lead_number != null ? leadRef(a.leads.lead_number) : null,
    contractId: a.contract_id ?? null,
    contractRef: a.contracts?.contract_number != null ? contractRef(a.contracts.contract_number) : null,
  };
}

/** Every booking against one lead or contract, for its record's panel/tab. */
export async function getAppointmentsFor(
  owner: { leadId?: string; contractId?: string },
): Promise<DiaryEvent[]> {
  const supabase = await createClient();
  let q = supabase.from("appointments").select(SELECT).order("starts_at", { ascending: true });
  if (owner.leadId) q = q.eq("lead_id", owner.leadId);
  else if (owner.contractId) q = q.eq("contract_id", owner.contractId);
  else return [];

  const { data, error } = await q;
  if (error) throw new Error(`getAppointmentsFor: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(toDiaryEvent);
}
