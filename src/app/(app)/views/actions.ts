"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import type { ViewColumns, ViewEntity, ViewQuery } from "@/lib/views/views";

// Saved-view mutations. A user manages their OWN views; `owner_user_id` is
// always the verified session user and `company_id` always comes from the JWT
// claim — never from the client (see AGENTS.md § Backend & multi-tenant).
//
// Shared (tenant-wide) views are read-only from here by design: the RLS policies
// only permit writes where owner_user_id = auth.uid(), so creating one needs an
// admin path that doesn't exist yet. That's the safe default, not an oversight.

const PATHS: Record<ViewEntity, string> = {
  leads: "/leads",
  customers: "/customers",
};

type Result = { id?: string; error?: string };

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const companyId = await getCompanyId();
  return { supabase, user, companyId };
}

/** Create a personal view from the screen's current query + column layout. */
export async function createSavedView(input: {
  entity: ViewEntity;
  name: string;
  query: ViewQuery;
  columns: ViewColumns;
}): Promise<Result> {
  const name = input.name.trim();
  if (!name) return { error: "Give the view a name." };

  const { supabase, user, companyId } = await session();
  if (!user) return { error: "Not signed in." };
  if (!companyId) return { error: "No tenant in session." };

  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      company_id: companyId,
      entity: input.entity,
      owner_user_id: user.id,
      name,
      query: input.query,
      columns: input.columns,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath(PATHS[input.entity]);
  return { id: data.id as string };
}

/** Overwrite a view with the screen's current state ("Save" on a dirty view). */
export async function updateSavedView(input: {
  entity: ViewEntity;
  id: string;
  query: ViewQuery;
  columns: ViewColumns;
}): Promise<Result> {
  // A system view is code, not a row — it can never be overwritten, only
  // duplicated. Guarded here as well as by RLS so the UI gets a clear message.
  if (input.id.startsWith("sys:")) {
    return { error: "Built-in views can't be changed — use “Save as new”." };
  }
  const { supabase } = await session();
  const { error } = await supabase
    .from("saved_views")
    .update({ query: input.query, columns: input.columns, updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) return { error: error.message };

  revalidatePath(PATHS[input.entity]);
  return { id: input.id };
}

export async function renameSavedView(
  entity: ViewEntity,
  id: string,
  name: string,
): Promise<Result> {
  const clean = name.trim();
  if (!clean) return { error: "Give the view a name." };
  if (id.startsWith("sys:")) return { error: "Built-in views can't be renamed." };

  const { supabase } = await session();
  const { error } = await supabase
    .from("saved_views")
    .update({ name: clean, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(PATHS[entity]);
  return { id };
}

export async function deleteSavedView(entity: ViewEntity, id: string): Promise<Result> {
  if (id.startsWith("sys:")) return { error: "Built-in views can't be deleted." };

  const { supabase } = await session();
  const { error } = await supabase.from("saved_views").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(PATHS[entity]);
  return {};
}
