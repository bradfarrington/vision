import { createClient } from "@/lib/supabase/server";

/**
 * A user's saved preferences for a customisable surface (see the
 * `user_ui_layouts` table). Preferences are per user, so reads are scoped to the
 * signed-in user — RLS enforces the same, this just avoids fetching a row we
 * would then have to filter.
 *
 * The `layout` jsonb is opaque to the DB; each surface owns its own shape:
 *   - the overview bento stores `{ columns: string[][] }` (cards per column)
 *   - the record tabs store `{ order: string[] }` (tab labels in order)
 *
 * The table isn't in the generated types yet, so the query goes through a loose
 * client, matching the rest of the data layer until `supabase gen types` is
 * re-run.
 */
async function readLayout(layoutKey: string): Promise<unknown | null> {
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
    console.error("readLayout:", error.message);
    return null;
  }
  return data?.layout ?? null;
}

/**
 * The overview bento arrangement — an ordered list of card ids per column, or
 * `null` when the user has never customised it (the board then falls back to its
 * default layout). Shape is guarded so a malformed row is ignored rather than
 * fed to the board.
 */
export async function getUserLayout(layoutKey: string): Promise<string[][] | null> {
  const layout = await readLayout(layoutKey);
  const columns = (layout as { columns?: unknown } | null)?.columns;
  if (!Array.isArray(columns)) return null;
  if (!columns.every((col) => Array.isArray(col) && col.every((id) => typeof id === "string"))) {
    return null;
  }
  return columns as string[][];
}

/**
 * A saved ordering for a flat list (e.g. the customer-record tabs), or `null`
 * when the user hasn't reordered — the consumer then keeps its authored order.
 */
export async function getUserOrder(layoutKey: string): Promise<string[] | null> {
  const layout = await readLayout(layoutKey);
  const order = (layout as { order?: unknown } | null)?.order;
  if (!Array.isArray(order) || !order.every((v) => typeof v === "string")) return null;
  return order as string[];
}

/**
 * The raw saved preference object for a surface that stores more than a flat
 * order/columns (e.g. the customer list keeps `{ order, widths }`). The consumer
 * sanitises the shape it expects. `null` when the user hasn't customised.
 */
export async function getUserPref(layoutKey: string): Promise<Record<string, unknown> | null> {
  const layout = await readLayout(layoutKey);
  return layout && typeof layout === "object" && !Array.isArray(layout)
    ? (layout as Record<string, unknown>)
    : null;
}
