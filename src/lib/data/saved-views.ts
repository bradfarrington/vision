import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUserPref } from "@/lib/data/user-layouts";
import { systemViews } from "@/lib/views/system-views";
import { defaultViewKey, isViewParam } from "@/lib/views/views";
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
  const { data, error } = await supabase
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

/**
 * WHICH view this user starts on — their own, never the tenant's.
 *
 * Stored in `user_ui_layouts` rather than as a column on `saved_views`, and the
 * split is the point: a view is a named, listable, shareable RECORD; which one
 * you land on is a PREFERENCE, like a column layout. Keeping it there means a
 * SHARED view can be one person's default without them owning it, two people
 * can default to the same view without fighting over a flag, and it needs no
 * hand-applied migration.
 *
 * Returns just the id — the caller already has the view list to resolve it.
 */
export async function getDefaultViewId(entity: ViewEntity): Promise<string | null> {
  const pref = await getUserPref(defaultViewKey(entity));
  const id = pref?.id;
  return typeof id === "string" && id ? id : null;
}

/**
 * The view a BARE visit should open on: the user's default, and only when the
 * URL is asking for nothing in particular.
 *
 * A URL that already names a view (`sv`) or carries any view param is someone's
 * deliberate destination — a shared link, the back button, the sidebar
 * restoring where you were — and must never be overridden by a preference.
 */
export async function defaultViewFor(
  entity: ViewEntity,
  params: Record<string, string | undefined>,
): Promise<SavedView | null> {
  if (params.sv) return null;
  if (Object.entries(params).some(([k, v]) => v && isViewParam(k))) return null;

  const id = await getDefaultViewId(entity);
  if (!id) return null;
  const view = await getSavedView(entity, id);
  // A default pointing at a deleted view is silently ignored rather than
  // erroring — the view list is the source of truth, the pref is a pointer.
  return view && Object.keys(view.query).length ? view : null;
}
