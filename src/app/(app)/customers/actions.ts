"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { addNote } from "@/app/(app)/notes/actions";
import { searchCustomersForLink } from "@/lib/data/customer-record";
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

  // Salutation defaults to Title + surname (how we address them).
  data.salutation = [data.title, data.last_name].filter(Boolean).join(" ").trim() || null;

  const isCommercial = (data.customer_type ?? "").toLowerCase() === "commercial";
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
    // Mirror the first person into a (default) linked contact.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncPersonContact(supabase as any, companyId, customerId, "primary", data.first_name, data.last_name, {
      email: data.email,
      phone: data.phone ?? data.mobile,
    });
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { error } = await db.from("customers").update({ [field]: normalised }).eq("id", id);
  if (error) return { error: error.message };

  // Keep salutation + mirrored contacts in sync when the name fields change.
  const NAME_FIELDS = ["title", "first_name", "last_name", "first_name_2", "last_name_2"];
  if (NAME_FIELDS.includes(field)) {
    const { data } = await db
      .from("customers")
      .select("company_id, title, first_name, last_name, first_name_2, last_name_2, email, phone, mobile")
      .eq("id", id)
      .single();
    if (data) {
      if (field === "title" || field === "last_name") {
        const salutation = [data.title, data.last_name].filter(Boolean).join(" ").trim() || null;
        await db.from("customers").update({ salutation }).eq("id", id);
      }
      if (field === "first_name" || field === "last_name") {
        await syncPersonContact(db, data.company_id, id, "primary", data.first_name, data.last_name, {
          email: data.email,
          phone: data.phone ?? data.mobile,
        });
      }
      if (field === "first_name_2" || field === "last_name_2") {
        await syncPersonContact(db, data.company_id, id, "secondary", data.first_name_2, data.last_name_2);
      }
    }
  }

  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  return {};
}

// --- Auto-mirror the customer's name fields into contacts -------------------
// The primary/secondary person on the customer becomes a linked contact,
// kept in sync by `origin`. The default contact drives the overview "Main" card.
async function syncPersonContact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// --- Tenant option lists (the searchable "add new" dropdowns) ----------------
/** Add (or reuse) a value in a tenant-editable option list. */
export async function addTenantOption(
  listKey: string,
  label: string,
): Promise<{ id?: string; label?: string; error?: string }> {
  const clean = label.trim();
  if (!clean) return { error: "Enter a name." };
  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const existing = await db
    .from("tenant_options")
    .select("id, label")
    .eq("list_key", listKey)
    .eq("label", clean)
    .limit(1);
  if (existing.data?.[0]) {
    revalidatePath("/customers", "layout");
    return { id: existing.data[0].id, label: clean };
  }
  const ins = await db
    .from("tenant_options")
    .insert({ company_id: companyId, list_key: listKey, label: clean })
    .select("id, label")
    .single();
  if (ins.error) return { error: ins.error.message };
  revalidatePath("/customers", "layout");
  return { id: ins.data.id, label: clean };
}

/** Remove a value from a tenant option list. */
export async function deleteTenantOption(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("tenant_options").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/customers", "layout");
  return {};
}

// --- Relationship types (directional pairs) ---------------------------------
/** Add (or reuse) a relationship-type pair. Blank inverse → symmetric. */
export async function addRelationshipType(
  forwardLabel: string,
  inverseLabel?: string | null,
): Promise<{ id?: number; forwardLabel?: string; inverseLabel?: string; error?: string }> {
  const fwd = forwardLabel.trim();
  const inv = (inverseLabel ?? "").trim() || fwd;
  if (!fwd) return { error: "Enter a label." };
  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const existing = await db
    .from("relationship_types")
    .select("id, forward_label, inverse_label")
    .eq("forward_label", fwd)
    .eq("inverse_label", inv)
    .limit(1);
  if (existing.data?.[0]) {
    revalidatePath("/customers", "layout");
    return { id: existing.data[0].id, forwardLabel: fwd, inverseLabel: inv };
  }
  const ins = await db
    .from("relationship_types")
    .insert({ company_id: companyId, forward_label: fwd, inverse_label: inv })
    .select("id")
    .single();
  if (ins.error) return { error: ins.error.message };
  revalidatePath("/customers", "layout");
  return { id: ins.data.id, forwardLabel: fwd, inverseLabel: inv };
}

/** Remove a relationship-type pair. */
export async function deleteRelationshipType(id: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("relationship_types").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/customers", "layout");
  return {};
}

// --- Customer relationships -------------------------------------------------
/**
 * Link this customer to another. `labelThisSide` is how it reads on THIS
 * customer's record; `labelOtherSide` is the reverse wording on the other's.
 * Stored with customer_id = this customer (the "a" side).
 */
export async function addCustomerRelationship(
  customerId: string,
  relatedCustomerId: string,
  labelThisSide: string | null,
  labelOtherSide: string | null,
  notes?: string | null,
): Promise<{ error?: string }> {
  if (!relatedCustomerId) return { error: "Choose a customer to link." };
  if (relatedCustomerId === customerId) return { error: "A customer can't be linked to itself." };
  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("customer_relationships").insert({
    company_id: companyId,
    customer_id: customerId,
    related_customer_id: relatedCustomerId,
    label_a: labelThisSide || null,
    label_b: labelOtherSide || null,
    notes: notes || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/customers/${relatedCustomerId}`);
  return {};
}

/** Change a relationship's type from a given customer's perspective. */
export async function setRelationshipLabels(
  relationshipId: string,
  viewerIsA: boolean,
  labelThisSide: string | null,
  labelOtherSide: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const patch = viewerIsA
    ? { label_a: labelThisSide || null, label_b: labelOtherSide || null }
    : { label_b: labelThisSide || null, label_a: labelOtherSide || null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("customer_relationships")
    .update(patch)
    .eq("id", relationshipId);
  if (error) return { error: error.message };
  revalidatePath("/customers", "layout");
  return {};
}

/** Remove a customer relationship. */
export async function deleteCustomerRelationship(
  customerId: string,
  relationshipId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("customer_relationships")
    .delete()
    .eq("id", relationshipId);
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return {};
}

const EDITABLE_RELATIONSHIP_FIELDS = new Set(["relationship_type", "notes"]);

/** Inline-edit a relationship's type or note. */
export async function updateRelationshipField(
  id: string,
  field: string,
  value: string | number | boolean | null,
): Promise<{ error?: string }> {
  if (!EDITABLE_RELATIONSHIP_FIELDS.has(field)) return { error: `Field "${field}" is not editable.` };
  const normalised = typeof value === "string" && value.trim() === "" ? null : value;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("customer_relationships")
    .update({ [field]: normalised })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/customers", "layout");
  return {};
}

/** Search customers for the relationship picker (client-callable). */
export async function searchCustomers(query: string, excludeId: string) {
  return searchCustomersForLink(query, excludeId);
}

// --- Custom fields (Additional info) ----------------------------------------
/** Set a customer's value for a custom field (upsert). */
export async function setCustomFieldValue(
  customerId: string,
  definitionId: number,
  value: string | null,
): Promise<{ error?: string }> {
  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session." };
  const clean = typeof value === "string" && value.trim() === "" ? null : value;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const existing = (
    await db
      .from("custom_field_values")
      .select("id")
      .eq("customer_id", customerId)
      .eq("definition_id", definitionId)
      .limit(1)
  ).data?.[0];
  const { error } = existing
    ? await db.from("custom_field_values").update({ value: clean }).eq("id", existing.id)
    : await db
        .from("custom_field_values")
        .insert({ company_id: companyId, definition_id: definitionId, customer_id: customerId, value: clean });
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return {};
}

/**
 * Define a new custom field for this tenant, from the record screen.
 * Dropdown fields get their own tenant_options list (`cf_<slug>_<id>`) seeded
 * with the values given, so they behave exactly like the standard pick-lists —
 * searchable, and extendable inline later. All rows are company_id-scoped, so a
 * tenant's own questions are invisible to every other tenant.
 */
export async function addCustomFieldDefinition(
  question: string,
  dataType: "text" | "select",
  values: string[] = [],
  entity: "customer" | "lead" = "customer",
): Promise<{ error?: string }> {
  const label = question.trim();
  if (!label) return { error: "Enter a question." };
  const labels = values.map((v) => v.trim()).filter(Boolean);
  if (dataType === "select" && labels.length === 0)
    return { error: "Add at least one dropdown value." };

  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session." };
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const dupe = await db
    .from("custom_field_definitions")
    .select("id")
    .eq("entity", entity)
    .eq("question", label)
    .limit(1);
  if (dupe.data?.[0]) return { error: "That question already exists." };

  const last = await db
    .from("custom_field_definitions")
    .select("sort_order")
    .eq("entity", entity)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sortOrder = (last.data?.[0]?.sort_order ?? 0) + 1;

  const ins = await db
    .from("custom_field_definitions")
    .insert({ company_id: companyId, entity, question: label, data_type: dataType, sort_order: sortOrder })
    .select("id")
    .single();
  if (ins.error) return { error: ins.error.message };

  if (dataType === "select") {
    const listKey = `cf_${slugify(label)}_${ins.data.id}`;
    const opts = await db.from("tenant_options").insert(
      // De-duplicated: the list's unique (company_id, list_key, label) would reject repeats.
      [...new Set(labels)].map((l, i) => ({
        company_id: companyId,
        list_key: listKey,
        label: l,
        sort_order: i + 1,
      })),
    );
    if (opts.error) return { error: opts.error.message };
    const upd = await db
      .from("custom_field_definitions")
      .update({ list_key: listKey })
      .eq("id", ins.data.id);
    if (upd.error) return { error: upd.error.message };
  }

  revalidatePath("/customers", "layout");
  return {};
}

/** Remove a custom field (its answers cascade; its own dropdown list goes too). */
export async function deleteCustomFieldDefinition(id: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const def = (
    await db.from("custom_field_definitions").select("list_key").eq("id", id).limit(1)
  ).data?.[0];
  const { error } = await db.from("custom_field_definitions").delete().eq("id", id);
  if (error) return { error: error.message };
  // Only lists this field owns — shared standard lists (marketing_source etc.) stay.
  if (def?.list_key?.startsWith("cf_")) {
    await db.from("tenant_options").delete().eq("list_key", def.list_key);
  }
  revalidatePath("/customers", "layout");
  return {};
}

/** A safe list_key fragment: lowercase, alphanumerics + underscores. */
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "field";
}

/**
 * Add a stamped marketing note (thread) — author + date/time, and versioned
 * like every other note (see app/(app)/notes/actions).
 */
export async function addMarketingNote(
  customerId: string,
  content: string,
): Promise<{ error?: string }> {
  const res = await addNote({ customerId, content, category: "marketing" });
  return res.error ? { error: res.error } : {};
}

/** Delete a marketing note. */
export async function deleteMarketingNote(
  customerId: string,
  noteId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("lead_notes").delete().eq("id", noteId);
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  return {};
}

/** Add a sales staff member from the Sales manager dropdown. */
export async function addSalesStaff(name: string): Promise<{ label?: string; error?: string }> {
  const clean = name.trim();
  if (!clean) return { error: "Enter a name." };
  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session." };

  const parts = clean.split(/\s+/);
  const first = parts[0];
  const last = parts.slice(1).join(" ");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("staff_members").insert({
    company_id: companyId,
    first_name: first,
    last_name: last,
    role: "sales",
    roles: ["sales"],
    active: true,
  });
  if (error) return { error: error.message };
  revalidatePath("/customers", "layout");
  return { label: clean };
}
