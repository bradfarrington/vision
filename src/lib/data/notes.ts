/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Notes — stamped, versioned, linkable, with attachments.
//
// One table backs every note in the CRM (`public.lead_notes`): customer-level
// when lead_id is null, lead-level otherwise, split into threads by `category`.
// A note optionally points at a lead OR a contract, so it can be read from the
// customer record and from the thing it's about.
//
// History is append-only (`public.note_revisions`): v1 is written with the note,
// and every edit appends the next version stamped with author + timestamp. The
// live row always holds the current text so lists stay a single read; history is
// fetched on demand (see getNoteHistory) rather than loaded with every record.
//
// Attachments are ordinary `documents` rows carrying note_id — same bucket, same
// tenant RLS, same viewer, so a file attached to a note is also just a file on
// the customer.
// ---------------------------------------------------------------------------

/** Note threads. 'general' = the customer's Notes tab; 'marketing' is its own. */
export type NoteCategory = "general" | "marketing";

export type NoteRevision = {
  version: number;
  content: string;
  editedAt: string;
  editedBy: string | null; // resolved display name
};

export type NoteItem = {
  id: string;
  /** Per-tenant reference number, shown as N-<n>. */
  number: number | null;
  content: string;
  category: string | null;
  createdAt: string;
  author: string | null; // resolved display name of the writer
  /** Null until the note has been edited at least once. */
  updatedAt: string | null;
  editor: string | null; // who made the most recent edit
  leadId: string | null;
  contractId: string | null;
};

// Selected columns for a note row incl. author/editor joins. Shared so every
// loader returns an identical shape.
export const NOTE_SELECT =
  "id, note_number, content, category, created_at, updated_at, lead_id, contract_id, " +
  "author:created_by(first_name, last_name), editor:updated_by(first_name, last_name)";

// Fallback for when a migration hasn't been applied yet — see the note on
// DOCUMENT_SELECT_BASE. A pending migration must never blank a customer's notes.
export const NOTE_SELECT_BASE =
  "id, content, category, created_at, " +
  "author:created_by(first_name, last_name)";

type NameJoin = { first_name: string | null; last_name: string | null } | null;

function personName(p: NameJoin): string | null {
  if (!p) return null;
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null;
}

/** Normalise a raw `lead_notes` row (with joins) into a NoteItem. */
export function mapNoteRow(row: any): NoteItem {
  return {
    id: row.id,
    number: row.note_number ?? null,
    content: row.content,
    category: row.category ?? null,
    createdAt: row.created_at,
    author: personName(row.author),
    updatedAt: row.updated_at ?? null,
    editor: personName(row.editor),
    leadId: row.lead_id ?? null,
    contractId: row.contract_id ?? null,
  };
}

/**
 * Every version of a note, oldest first. Loaded on demand when someone opens a
 * note's history — it isn't part of the record payload.
 */
export async function getNoteHistory(noteId: string): Promise<NoteRevision[]> {
  const supabase = await createClient();
  const db = supabase as unknown as { from(t: string): any };
  const { data, error } = await db
    .from("note_revisions")
    .select("version, content, edited_at, editor:edited_by(first_name, last_name)")
    .eq("note_id", noteId)
    .order("version");
  if (error) throw new Error(`getNoteHistory: ${error.message}`);
  return ((data ?? []) as any[]).map((r) => ({
    version: r.version,
    content: r.content,
    editedAt: r.edited_at,
    editedBy: personName(r.editor),
  }));
}
