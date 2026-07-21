import { createClient } from "@/lib/supabase/server";

export type StaffOption = { id: string; label: string };

/**
 * Tenant users with a given role, for staff pickers (e.g. Sales manager).
 * RLS confines this to the caller's company. These are real CRM logins, so the
 * picker has no "add new" — staff are added via user management, not inline.
 */
export async function getUsersByRole(role: string): Promise<StaffOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, first_name, last_name, email, role, active")
    .eq("role", role)
    .eq("active", true);
  return (data ?? []).map((u) => ({
    id: u.id,
    label:
      [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email || "User",
  }));
}

/** Sales staff for the Sales manager dropdown (users with role = 'sales'). */
export function getSalesUsers(): Promise<StaffOption[]> {
  return getUsersByRole("sales");
}
