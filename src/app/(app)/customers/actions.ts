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
    const { data: inserted, error } = await supabase
      .from("customers")
      .insert({ ...data, company_id: companyId } as CustomerInsert)
      .select("id")
      .single();
    if (error) return { error: error.message };
    customerId = inserted.id;
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}`);
}
