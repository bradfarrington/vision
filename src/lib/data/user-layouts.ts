import { createClient } from "@/lib/supabase/server";

/**
 * A user's saved arrangement for a customisable surface (see the
 * `user_ui_layouts` table). Layout is per user, so the read is scoped to the
 * signed-in user — RLS enforces the same, this just avoids fetching a row we
 * would then have to filter.
 *
 * Returns the raw `columns` array — an ordered list of card ids per column — or
 * `null` when the user has never customised this surface (in which case the
 * client falls back to the surface's default arrangement). The table isn't in
 * the generated types yet, so the query goes through a loose client, matching
 * the rest of the data layer until `supabase gen types` is re-run.
 */
export async function getUserLayout(layoutKey: string): Promise<string[][] | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{ data: { layout: unknown } | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };

  const { data, error } = await db
    .from("user_ui_layouts")
    .select("layout")
    .eq("user_id", user.id)
    .eq("layout_key", layoutKey)
    .maybeSingle();

  if (error) {
    console.error("getUserLayout:", error.message);
    return null;
  }

  const columns = (data?.layout as { columns?: unknown } | null)?.columns;
  if (!Array.isArray(columns)) return null;
  // Guard the shape: every entry must be an array of strings, or we ignore the
  // stored value rather than feed the board something it can't place.
  if (!columns.every((col) => Array.isArray(col) && col.every((id) => typeof id === "string"))) {
    return null;
  }
  return columns as string[][];
}
