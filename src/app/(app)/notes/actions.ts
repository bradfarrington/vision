/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { getNoteHistory, type NoteRevision } from "@/lib/data/notes";

// ---------------------------------------------------------------------------
// Note actions — write side of the versioned note store (see lib/data/notes.ts).
//
// Every write stamps the author from the session and the tenant from the
// verified JWT; nothing trusts a client-supplied company or user id. Editing is
// non-destructive: the previous text stays in note_revisions forever, and the
// edit appends the next version.
// ---------------------------------------------------------------------------

/** Where a note is written from — decides which screen we revalidate. */
type NoteOwner = { customerId?: string | null; leadId?: string | null; contractId?: string | null };

function revalidateOwner(o: NoteOwner) {
  if (o.customerId) revalidatePath(`/customers/${o.customerId}`);
  if (o.leadId) revalidatePath(`/leads/${o.leadId}`);
  if (o.contractId) revalidatePath(`/contracts/${o.contractId}`);
}

/**
 * Write a new note. Returns the new id so the caller can upload attachments
 * against it (the panel creates the note, then uploads each file with noteId).
 */
export async function addNote(input: {
  customerId?: string | null;
  leadId?: string | null;
  contractId?: string | null;
  content: string;
  category?: string;
}): Promise<{ id?: string; error?: string }> {
  const text = input.content.trim();
  if (!text) return { error: "Enter a note." };

  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const db = supabase as any;

  // Per-tenant reference (N-<n>) — the counter derives the tenant from the JWT.
  const { data: noteNumber } = await supabase.rpc("next_reference", { p_name: "note" });

  const ins = await db
    .from("lead_notes")
    .insert({
      company_id: companyId,
      note_number: noteNumber != null ? Number(noteNumber) : null,
      customer_id: input.customerId ?? null,
      lead_id: input.leadId ?? null,
      contract_id: input.contractId ?? null,
      content: text,
      category: input.category ?? "general",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (ins.error) return { error: ins.error.message };

  // v1 — the note as first written. Its own row, so history reads the same way
  // whether a note has been edited once or never.
  const rev = await db.from("note_revisions").insert({
    company_id: companyId,
    note_id: ins.data.id,
    version: 1,
    content: text,
    edited_by: user?.id ?? null,
  });
  if (rev.error) return { error: rev.error.message };

  revalidateOwner(input);
  return { id: ins.data.id };
}

/**
 * Edit a note's text and/or what it links to. The prior text is untouched in
 * note_revisions; the new text is appended as the next version. A link-only
 * change adds no version (the note still says the same thing).
 */
export async function updateNote(
  noteId: string,
  content: string,
  link?: { leadId?: string | null; contractId?: string | null },
  owner?: NoteOwner,
): Promise<{ error?: string }> {
  const text = content.trim();
  if (!text) return { error: "A note can't be empty." };

  const companyId = await getCompanyId();
  if (!companyId) return { error: "No tenant in session." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const db = supabase as any;

  const current = (
    await db.from("lead_notes").select("content").eq("id", noteId).limit(1)
  ).data?.[0];
  if (!current) return { error: "Note not found." };

  const textChanged = current.content !== text;

  const patch: Record<string, unknown> = { content: text };
  if (link) {
    patch.lead_id = link.leadId ?? null;
    patch.contract_id = link.contractId ?? null;
  }
  // Only a text change counts as an edit of the note itself.
  if (textChanged) {
    patch.updated_at = new Date().toISOString();
    patch.updated_by = user?.id ?? null;
  }

  const upd = await db.from("lead_notes").update(patch).eq("id", noteId);
  if (upd.error) return { error: upd.error.message };

  if (textChanged) {
    const last = await db
      .from("note_revisions")
      .select("version")
      .eq("note_id", noteId)
      .order("version", { ascending: false })
      .limit(1);
    const next = (last.data?.[0]?.version ?? 0) + 1;
    const rev = await db.from("note_revisions").insert({
      company_id: companyId,
      note_id: noteId,
      version: next,
      content: text,
      edited_by: user?.id ?? null,
    });
    if (rev.error) return { error: rev.error.message };
  }

  if (owner) revalidateOwner(owner);
  return {};
}

/**
 * Delete a note. Its revisions cascade; attachments survive as plain documents
 * on the customer (documents.note_id is ON DELETE SET NULL) — deleting a note
 * must never destroy a file someone uploaded.
 */
export async function deleteNote(noteId: string, owner?: NoteOwner): Promise<{ error?: string }> {
  const supabase = await createClient();
  const db = supabase as any;
  const { error } = await db.from("lead_notes").delete().eq("id", noteId);
  if (error) return { error: error.message };
  if (owner) revalidateOwner(owner);
  return {};
}

/** Read a note's full version history (client components call this on expand). */
export async function loadNoteHistory(
  noteId: string,
): Promise<{ revisions?: NoteRevision[]; error?: string }> {
  try {
    return { revisions: await getNoteHistory(noteId) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not load history." };
  }
}
