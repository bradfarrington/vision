import { createClient } from "@/lib/supabase/server";

export type StaffOption = { id: string; label: string };

/**
 * Sales staff for the Sales manager / Salesperson pickers. Sourced from
 * staff_members (NOT auth users) — a staff member may or may not have a CRM
 * login. RLS confines this to the caller's tenant. Filters to staff flagged as
 * sales via `role` or the `roles[]` array.
 */
export async function getSalesStaff(): Promise<StaffOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_members")
    .select("id, first_name, last_name, role, roles, active")
    .eq("active", true)
    .order("last_name");

  return (data ?? [])
    .filter((s) => s.role === "sales" || (Array.isArray(s.roles) && s.roles.includes("sales")))
    .map((s) => ({
      id: s.id,
      label: [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "Staff member",
    }));
}
