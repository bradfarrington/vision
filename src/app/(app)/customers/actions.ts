"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import type { Database } from "@/lib/supabase/types";

type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"];

export type CustomerFormState = { error?: string };

// Fields the form owns. Empty strings are normalised to null so we don't store
// blank text where the schema expects absent values.
const TEXT_FIELDS = [
  "customer_type",
  "title",
  "first_name",
  "last_name",
  "company_name",
  "email",
  "phone",
  "mobile",
  "home_telephone",
  "house_name",
  "house_number",
  "street",
  "locality",
  "town",
  "county",
  "postcode",
  "what_3_words",
  "notes",
] as const;

function collect(formData: FormData): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const field of TEXT_FIELDS) {
    const raw = formData.get(field);
    const value = typeof raw === "string" ? raw.trim() : "";
    out[field] = value === "" ? null : value;
  }
  return out;
}

/** Create or update a customer. `id` present in the form → update, else insert. */
export async function saveCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const id = formData.get("id");
  const data = collect(formData);

  const isCommercial = data.customer_type === "commercial";
  if (!data.first_name || !data.last_name) {
    return { error: "First and last name are required." };
  }
  if (isCommercial && !data.company_name) {
    return { error: "Company name is required for commercial customers." };
  }

  const supabase = await createClient();
  let customerId: string;

  if (typeof id === "string" && id) {
    // Update — RLS confines this to the caller's own tenant.
    const { error } = await supabase
      .from("customers")
      .update(data as CustomerUpdate)
      .eq("id", id);
    if (error) return { error: error.message };
    customerId = id;
  } else {
    const companyId = await getCompanyId();
    if (!companyId) return { error: "No tenant in session. Please sign in again." };
    // Per-tenant customer number. The counter starts at 0 for every tenant, so
    // the first customer is 0001 (displayed zero-padded). next_reference derives
    // the tenant from the JWT and increments atomically.
    const { data: customerNumber } = await supabase.rpc("next_reference", {
      p_name: "customer",
    });
    const { data: inserted, error } = await supabase
      .from("customers")
      .insert({
        ...data,
        company_id: companyId,
        customer_number: customerNumber != null ? Number(customerNumber) : null,
      } as CustomerInsert)
      .select("id")
      .single();
    if (error) return { error: error.message };
    customerId = inserted.id;
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}`);
}

// Columns the inline editor may write. Anything not in this set is rejected —
// the field name comes from the client, so it must never be trusted blindly.
const EDITABLE_CUSTOMER_FIELDS = new Set<string>([
  "customer_type", "title", "first_name", "last_name", "company_name",
  "title_2", "first_name_2", "last_name_2", "salutation", "business_address",
  "office_ref_1", "office_ref_2", "flash_note", "customer_moved_away",
  "no_whatsapp", "property_type",
  "email", "phone", "mobile", "mobile_2", "home_telephone", "work_telephone",
  "fax_alt_no",
  "house_name", "house_number", "street", "locality", "town", "county",
  "postcode", "what_3_words", "directions", "notes",
  "invoice_name", "invoice_address_1", "invoice_address_2", "invoice_address_3",
  "invoice_address_4", "invoice_postcode", "invoice_tel", "payment_terms",
  "settlement_disc_terms", "settlement_disc_pct", "calculate_vat_on_reduced",
  "account_created_in_package", "default_account_reference", "sales_manager",
  "vat_no", "cis_reg",
  "marketing_code", "marketing_notes", "no_postal_marketing", "no_email_marketing",
  "no_sms_marketing", "no_telephone_marketing", "do_not_contact", "bad_payer",
  "opt_in_date", "opted_in_by", "opt_in_document", "phone_opt_in", "letter_opt_in",
  "email_opt_in", "sms_opt_in",
]);

/** Update a single customer field from the inline editor. */
export async function updateCustomerField(
  id: string,
  field: string,
  value: string | number | boolean | null,
): Promise<{ error?: string }> {
  if (!EDITABLE_CUSTOMER_FIELDS.has(field)) {
    return { error: `Field "${field}" is not editable.` };
  }
  const normalised = typeof value === "string" && value.trim() === "" ? null : value;

  const supabase = await createClient();
  // Loosely typed: the expansion columns aren't in the generated types yet.
  const { error } = await (supabase as unknown as {
    from(t: string): {
      update(v: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
    };
  })
    .from("customers")
    .update({ [field]: normalised })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  return {};
}

// --- Linked contacts --------------------------------------------------------
// customer_contacts isn't in the generated types yet, so these use a cast.
// Re-run `supabase gen types` to restore typing.
const EDITABLE_CONTACT_FIELDS = new Set(["name", "email", "phone", "position_role", "no_whatsapp"]);

/** Add a blank linked contact to a customer (then edited inline). */
export async function addCustomerContact(customerId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("customer_contacts")
    .insert({ company_id: companyId, customer_id: customerId, name: "New contact" });
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return {};
}

/** Inline-edit a single field on a linked contact. */
export async function updateContactField(
  contactId: string,
  field: string,
  value: string | number | boolean | null,
): Promise<{ error?: string }> {
  if (!EDITABLE_CONTACT_FIELDS.has(field)) return { error: `Field "${field}" is not editable.` };
  const normalised = typeof value === "string" && value.trim() === "" ? null : value;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("customer_contacts")
    .update({ [field]: normalised })
    .eq("id", contactId);
  if (error) return { error: error.message };
  revalidatePath("/customers", "layout");
  return {};
}

/** Make one contact the default (clears the flag on the others). */
export async function setDefaultContact(
  customerId: string,
  contactId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  await db.from("customer_contacts").update({ is_default: false }).eq("customer_id", customerId);
  const { error } = await db.from("customer_contacts").update({ is_default: true }).eq("id", contactId);
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return {};
}

/** Remove a linked contact. */
export async function deleteCustomerContact(
  customerId: string,
  contactId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("customer_contacts").delete().eq("id", contactId);
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return {};
}
