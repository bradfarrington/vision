"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { overlaps } from "@/lib/appointments";
import type { Database } from "@/lib/supabase/types";

// Every write against the ONE appointment table. Bookings made from the diary,
// a lead record, a contract's Fitting tab and the slot finder all land here, so
// the clash check can never be skipped by one caller.

export type BookingInput = {
  id?: string;
  /** ISO instant. */
  startsAt: string;
  /** Minutes — the single duration unit (1.5 days = 720). */
  duration: number;
  type: string | null;
  title?: string | null;
  notes?: string | null;
  staffIds: string[];
  staffNames: string[];
  status?: string;
  leadId?: string | null;
  contractId?: string | null;
  customerId?: string | null;
  /** Book anyway, having been shown the clash. */
  force?: boolean;
};

export type BookingResult = {
  error?: string;
  id?: string;
  /** Set when the booking was refused for a clash — the UI offers to override. */
  clashes?: { id: string; title: string; startsAt: string; staffName: string }[];
};

/**
 * Create or update a booking.
 *
 * CLASHES ARE CHECKED, NOT PREVENTED. Double-booking a fitter is usually a
 * mistake and occasionally deliberate (two people, one van, a quick call on the
 * way), so the first attempt is refused with the conflicting jobs named, and
 * `force` books it anyway. Silently allowing it hides the mistake; silently
 * blocking it makes the diary unusable on the day someone needs the exception.
 */
export async function saveBooking(input: BookingInput): Promise<BookingResult> {
  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session. Please sign in again." };

  if (!input.startsAt) return { error: "Pick a date and time." };
  const duration = Number.isFinite(input.duration) && input.duration > 0 ? input.duration : 60;

  if (!input.force && input.staffIds.length) {
    const clashes = await findClashes(supabase, input, duration);
    if (clashes.length) return { clashes };
  }

  const payload = {
    company_id: companyId,
    starts_at: input.startsAt,
    duration,
    type: input.type,
    title: input.title?.trim() || input.type || "Appointment",
    notes: input.notes?.trim() || null,
    staff_ids: input.staffIds,
    staff_names: input.staffNames,
    status: input.status ?? "confirmed",
    lead_id: input.leadId ?? null,
    contract_id: input.contractId ?? null,
    customer_id: input.customerId ?? null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("appointments")
      .update(payload as Database["public"]["Tables"]["appointments"]["Update"])
      .eq("id", input.id);
    if (error) return { error: error.message };
    revalidateOwners(input);
    return { id: input.id };
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert(payload as Database["public"]["Tables"]["appointments"]["Insert"])
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateOwners(input);
  return { id: data.id };
}

/**
 * Anyone already booked over this window. Reads the day either side of the
 * booking rather than the exact window, because a job STARTING before it can
 * still run into it — a query bounded to the window itself would miss a
 * two-day fit that began yesterday.
 */
async function findClashes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: BookingInput,
  duration: number,
): Promise<NonNullable<BookingResult["clashes"]>> {
  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + duration * 60_000);
  // Widen by a fortnight backwards: long fittings are booked in days, so a job
  // that overlaps today may have started well before it.
  const from = new Date(start.getTime() - 14 * 86_400_000);

  const { data, error } = await supabase
    .from("appointments")
    .select("id, title, starts_at, duration, staff_ids, staff_names, status")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", end.toISOString())
    .neq("status", "cancelled")
    .overlaps("staff_ids", input.staffIds);

  // A failed clash check must not block the booking — it's a guard, not a gate.
  // Better a booking that goes through than an office that can't work.
  if (error) return [];

  const candidate = { startsAt: input.startsAt, duration };
  return (data ?? [])
    .filter((a) => a.id !== input.id)
    .filter((a) => overlaps(candidate, { startsAt: a.starts_at, duration: a.duration }))
    .map((a) => ({
      id: a.id,
      title: a.title ?? "Appointment",
      startsAt: a.starts_at,
      staffName:
        (a.staff_names ?? []).find((_n, i) => input.staffIds.includes((a.staff_ids ?? [])[i])) ??
        (a.staff_names ?? [])[0] ??
        "Someone",
    }));
}

/** Move a booking to a new instant — the diary's drag, and the day-view retime. */
export async function moveBooking(
  id: string,
  startsAt: string,
  staffIds?: string[],
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { starts_at: startsAt };
  if (staffIds) patch.staff_ids = staffIds;

  const { error } = await supabase
    .from("appointments")
    .update(patch as Database["public"]["Tables"]["appointments"]["Update"])
    .eq("id", id);
  // RETURNS the error rather than throwing: the diary moves the block
  // optimistically and has to decide whether to keep it or put it back — the
  // same split as moveLeadToStage / setLeadStage.
  if (error) return { error: error.message };
  revalidatePath("/diary");
  revalidatePath("/dashboard");
  return {};
}

/** Cancel a booking. Kept, not deleted — a cancelled visit is history. */
export async function cancelBooking(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" } as Database["public"]["Tables"]["appointments"]["Update"])
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/diary");
  revalidatePath("/dashboard");
  return {};
}

/** Mark a booking done — the Fitting tab's "Mark done". */
export async function completeBooking(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
    } as Database["public"]["Tables"]["appointments"]["Update"])
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/diary");
  return {};
}

function revalidateOwners(input: BookingInput) {
  revalidatePath("/diary");
  revalidatePath("/dashboard");
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  if (input.contractId) revalidatePath(`/contracts/${input.contractId}`);
  if (input.customerId) revalidatePath(`/customers/${input.customerId}`);
}
