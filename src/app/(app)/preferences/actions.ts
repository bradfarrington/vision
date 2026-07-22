"use server";

import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

/**
 * Per-user UI preferences (see the `user_ui_layouts` table). These save a user's
 * own arrangement of a customisable surface — currently the customer-record
 * overview bento — and are read back by `getUserLayout`.
 *
 * Everything here is pinned to the signed-in user and their tenant: `user_id`
 * comes from the verified session, `company_id` from `current_company_id()` (the
 * JWT claim), never from client input. The RLS policy checks both, so a save can
 * only ever write the caller's own row.
 *
 * No `revalidatePath` — the board manages its own state optimistically, so a save
 * must not trigger a server re-render (that would fight the drag it just
 * finished). The table isn't in the generated types yet, hence the loose client.
 */
type LooseWrite = {
  from: (t: string) => {
    upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    };
  };
};

export async function saveUserLayout(layoutKey: string, columns: string[][]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant" };

  const db = supabase as unknown as LooseWrite;
  const { error } = await db.from("user_ui_layouts").upsert(
    {
      user_id: user.id,
      company_id: companyId,
      layout_key: layoutKey,
      layout: { columns },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,layout_key" },
  );
  if (error) {
    console.error("saveUserLayout:", error.message);
    return { error: error.message };
  }
  return { ok: true };
}

/** Forget a user's customisation so the surface reverts to its default layout. */
export async function resetUserLayout(layoutKey: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const db = supabase as unknown as LooseWrite;
  const { error } = await db
    .from("user_ui_layouts")
    .delete()
    .eq("user_id", user.id)
    .eq("layout_key", layoutKey);
  if (error) {
    console.error("resetUserLayout:", error.message);
    return { error: error.message };
  }
  return { ok: true };
}
