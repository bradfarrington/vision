import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

// ---------------------------------------------------------------------------
// Creating a customer, in ONE place.
//
// Two screens now mint customers — the New Customer wizard and the New Lead
// capture (when the caller turns out not to be on the book) — and both must get
// the same thing: the per-tenant customer number from the shared counter, the
// derived salutation, and the mirrored primary contact. A second copy of this
// is how a customer created from a lead would quietly end up without its
// CUST- reference or its "Main" contact card.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

export type CustomerWriteValues = Record<string, string | boolean | null>;

/**
 * Insert a customer into the caller's tenant and return its id.
 * `company_id` comes from the verified JWT claim, never from the caller.
 */
export async function insertCustomer(
  values: CustomerWriteValues,
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session. Please sign in again." };

  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  const data: CustomerWriteValues = { ...values };
  // How we address them — Title + surname, same rule as the record's editor.
  data.salutation =
    [str(data.title), str(data.last_name)].filter(Boolean).join(" ").trim() || null;

  // Per-tenant customer number. The counter starts at 0 for every tenant, so the
  // first customer is 0001 (displayed zero-padded); next_reference derives the
  // tenant from the JWT and increments atomically.
  const { data: customerNumber } = await supabase.rpc("next_reference", { p_name: "customer" });

  const { data: inserted, error } = await (supabase as any)
    .from("customers")
    .insert({
      ...data,
      company_id: companyId,
      customer_number: customerNumber != null ? Number(customerNumber) : null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await syncPersonContact(
    supabase as any,
    companyId,
    inserted.id,
    "primary",
    str(data.first_name),
    str(data.last_name),
    { email: str(data.email), phone: str(data.phone) ?? str(data.mobile) },
  );

  return { id: inserted.id };
}

/**
 * Mirror the primary/secondary person on a customer into a linked contact, kept
 * in sync by `origin`. The default contact drives the overview "Main" card.
 */
export async function syncPersonContact(
  db: any,
  companyId: string,
  customerId: string,
  origin: "primary" | "secondary",
  first: string | null,
  last: string | null,
  seed?: { email?: string | null; phone?: string | null },
) {
  const name = [first, last].filter(Boolean).join(" ").trim();
  const existing = (
    await db
      .from("customer_contacts")
      .select("id")
      .eq("customer_id", customerId)
      .eq("origin", origin)
      .limit(1)
  ).data?.[0];

  // Secondary only exists when both names are present; primary always follows.
  const wanted = origin === "secondary" ? !!(first && last) : !!name;
  if (!wanted) {
    if (existing && origin === "secondary") {
      await db.from("customer_contacts").delete().eq("id", existing.id);
    }
    return;
  }

  if (existing) {
    await db.from("customer_contacts").update({ name }).eq("id", existing.id);
    return;
  }

  // Primary: adopt the existing default contact (avoids duplicating a contact
  // that already stands for this person), otherwise create a new default one.
  if (origin === "primary") {
    const def = (
      await db
        .from("customer_contacts")
        .select("id")
        .eq("customer_id", customerId)
        .eq("is_default", true)
        .limit(1)
    ).data?.[0];
    if (def) {
      await db.from("customer_contacts").update({ origin: "primary", name }).eq("id", def.id);
      return;
    }
  }

  await db.from("customer_contacts").insert({
    company_id: companyId,
    customer_id: customerId,
    name,
    origin,
    is_default: origin === "primary",
    email: seed?.email ?? null,
    phone: seed?.phone ?? null,
  });
}
