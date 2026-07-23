/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { systemViews } from "@/lib/views/system-views";
import type { SavedView, ViewColumns, ViewEntity, ViewQuery } from "@/lib/views/views";

// Saved views for a list screen. RLS already confines a read to the caller's
// tenant AND to rows that are either theirs or shared, so no ownership filter
// is needed here — the policy is the enforcement (see the migration).

type Row = {
  id: string;
  name: string;
  query: unknown;
  columns: unknown;
  owner_user_id: string | null;
};

function toView(r: Row): SavedView {
  return {
    id: r.id,
    name: r.name,
    query: (r.query ?? {}) as ViewQuery,
    columns: (r.columns ?? null) as ViewColumns,
    system: false,
    shared: r.owner_user_id === null,
  };
}

/**
 * Every view available on a screen: the code-defined system ones first, then
 * the tenant's shared and personal saved ones.
 *
 * Fails SOFT — if the table hasn't been created yet (schema is applied by hand
 * here), the screen still works with its system views rather than erroring out.
 */
export async function getSavedViews(entity: ViewEntity): Promise<SavedView[]> {
  const supabase = await createClient();
  const db = supabase as unknown as { from(t: string): any };
  const { data, error } = await db
    .from("saved_views")
    .select("id, name, query, columns, owner_user_id")
    .eq("entity", entity)
    .order("sort_order")
    .order("name");

  const saved = error ? [] : ((data ?? []) as Row[]).map(toView);
  return [...systemViews(entity), ...saved];
}

/** One view by id, system or saved. Null when it no longer exists. */
export async function getSavedView(
  entity: ViewEntity,
  id: string | undefined,
): Promise<SavedView | null> {
  if (!id) return null;
  if (id.startsWith("sys:")) return systemViews(entity).find((v) => v.id === id) ?? null;
  const views = await getSavedViews(entity);
  return views.find((v) => v.id === id) ?? null;
}
