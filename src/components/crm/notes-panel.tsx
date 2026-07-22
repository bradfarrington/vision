"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { addNote, deleteNote, loadNoteHistory, updateNote } from "@/app/(app)/notes/actions";
import {
  attachExistingDocument,
  deleteDocument,
  findDuplicateDocument,
  renameDocument,
  uploadDocument,
} from "@/app/(app)/documents/actions";
import type { NoteItem, NoteRevision } from "@/lib/data/notes";
import type { DocumentItem } from "@/lib/data/documents";
import { cn } from "@/lib/utils";
import { Combo } from "./combo";
import { useDialogs } from "./dialogs";
import { Icon } from "./icon";
import { InlineViewer, FullscreenViewer, type ViewerDoc } from "./document-viewer";

// ---------------------------------------------------------------------------
// Customer notes panel — compose, link, attach, edit, and read back history.
//
// Every note is stamped (author + date/time) and versioned: editing appends a
// new version rather than overwriting, so "Edited" is always expandable into
// who changed what, and when. A note can be pinned to a lead or a contract, and
// carry files — the files are ordinary documents (they appear in the Documents
// tab too), just tagged with the note.
// ---------------------------------------------------------------------------

export type NoteLinkTarget = { id: string; label: string; kind: "lead" | "contract" };

const NO_LINK = "none";

export function NotesPanel({
  customerId,
  notes,
  documents,
  linkTargets,
}: {
  customerId: string;
  notes: NoteItem[];
  /** All the customer's documents — attachments are the ones carrying note_id. */
  documents: DocumentItem[];
  /** Leads + contracts a note can be pinned to. */
  linkTargets: NoteLinkTarget[];
}) {
  // The composer's open state lives here so the empty state's button can open
  // it — with no notes there's one call to action, not a link and a card.
  const [composing, setComposing] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<ViewerDoc | null>(null);
  const attachmentsFor = (noteId: string) => documents.filter((d) => d.noteId === noteId);
  const empty = notes.length === 0;

  const preview = documents.find((d) => d.id === previewId) ?? null;
  const previewDoc: ViewerDoc | null = preview
    ? { id: preview.id, name: preview.name, file_name: preview.file_name, file_type: preview.file_type }
    : null;

  // The PDF preview is a cross-origin iframe; once focused it eats the first
  // click on the surrounding UI. Blurring it on mouse-down keeps note actions
  // single-click. (Same guard as DocumentsPanel — keep both.)
  function reclaimFocus() {
    const active = document.activeElement as HTMLElement | null;
    if (active && active.tagName === "IFRAME") active.blur();
  }

  return (
    <div className="flex flex-col lg:h-full" onMouseDownCapture={reclaimFocus}>
      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:items-stretch">
        {/* Left: composer + the note thread, scrolling internally */}
        <div
          className={cn(
            "flex flex-col gap-4 lg:min-h-0",
            empty ? "lg:w-full" : "lg:w-[45%] lg:shrink-0",
          )}
        >
          {(!empty || composing) && (
            <NoteComposer
              customerId={customerId}
              linkTargets={linkTargets}
              open={composing}
              setOpen={setComposing}
            />
          )}
          {empty ? (
            !composing && <EmptyNotes onAdd={() => setComposing(true)} />
          ) : (
            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <div className="rounded-xl border border-[#e7e7ea] bg-white px-4">
                {notes.map((n, i) => (
                  <NoteRow
                    key={n.id}
                    customerId={customerId}
                    note={n}
                    attachments={attachmentsFor(n.id)}
                    linkTargets={linkTargets}
                    last={i === notes.length - 1}
                    previewId={previewId}
                    onPreview={setPreviewId}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: the same inline viewer the Documents tab uses — click any
            attachment on the left to preview it here. */}
        {!empty && (
          <div className="flex min-h-[600px] min-w-0 flex-1 flex-col lg:min-h-0">
            <InlineViewer doc={previewDoc} onFullscreen={() => previewDoc && setFullscreen(previewDoc)} />
          </div>
        )}
      </div>

      <FullscreenViewer doc={fullscreen} onClose={() => setFullscreen(null)} />
    </div>
  );
}

// --- Empty state ------------------------------------------------------------
// Matches the Documents panel's empty card: dashed well, one icon, one line of
// explanation, one button. It also sells what notes do here — stamped, linkable
// and versioned — which a bare "no notes yet" doesn't.
function EmptyNotes({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#e7e7ea] bg-[#fafafa] px-6 py-14 text-center">
      <span className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-tint)] text-[var(--accent-active)]">
        <Icon name="message" size={18} strokeWidth={1.75} />
      </span>
      <p className="text-[13.5px] font-semibold text-[#0a0a0a]">No notes on this customer yet</p>
      <p className="max-w-[380px] text-[12px] leading-relaxed text-[#71717a]">
        Every note records who wrote it and when. Pin one to a lead or contract, attach photos or
        documents, and edits keep a full history.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
      >
        <Icon name="plus" size={13} strokeWidth={2.2} /> Write the first note
      </button>
    </div>
  );
}

// --- Composer ---------------------------------------------------------------
function NoteComposer({
  customerId,
  linkTargets,
  open,
  setOpen,
}: {
  customerId: string;
  linkTargets: NoteLinkTarget[];
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [content, setContent] = useState("");
  const [link, setLink] = useState<string>(NO_LINK);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { confirm } = useDialogs();

  function reset() {
    setContent("");
    setLink(NO_LINK);
    setFiles([]);
    setError(null);
  }

  function save() {
    const text = content.trim();
    if (!text) return;
    setError(null);
    const target = decodeLink(link);
    start(async () => {
      const res = await addNote({
        customerId,
        leadId: target?.kind === "lead" ? target.id : null,
        contractId: target?.kind === "contract" ? target.id : null,
        content: text,
      });
      if (res.error || !res.id) {
        setError(res.error ?? "Could not save the note.");
        return;
      }
      // Attachments upload one at a time against the saved note, so a single
      // rejected file doesn't lose the note or the other files.
      const failed: string[] = [];
      for (const f of files) {
        const up = await uploadAttachment({ file: f, customerId, noteId: res.id, confirm });
        if (up.error) failed.push(`${f.name}: ${up.error}`);
      }
      if (failed.length) {
        setError(`Note saved, but some files didn't upload — ${failed.join("; ")}`);
        setContent("");
        setFiles([]);
        router.refresh();
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 self-start text-[12.5px] font-semibold text-[var(--accent-blue)]"
      >
        <Icon name="plus" size={13} strokeWidth={2.2} /> Add note
      </button>
    );

  return (
    <div className="rounded-xl border border-[#e7e7ea] bg-white p-4">
      <textarea
        autoFocus
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a note…"
        className="w-full resize-y rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[12.5px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <LinkPicker value={link} onChange={setLink} linkTargets={linkTargets} />
        </div>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-[#d4d4d8] px-3 py-2 text-[12.5px] font-semibold text-[#3f3f46] hover:bg-[#fafafa]"
        >
          <Icon name="paperclip" size={13} /> Attach
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            setFiles([...files, ...Array.from(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f4f5] px-2.5 py-1 text-[11.5px] text-[#3f3f46]"
            >
              <Icon name="file" size={11} /> {f.name}
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="text-[#a1a1aa] hover:text-[#d64545]"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-[11.5px] font-medium text-[#d64545]">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !content.trim()}
          className="rounded-md bg-[var(--accent-blue)] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save note"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-[12px] font-semibold text-[#71717a]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// --- One note ---------------------------------------------------------------
function NoteRow({
  customerId,
  note,
  attachments,
  linkTargets,
  last,
  previewId,
  onPreview,
}: {
  customerId: string;
  note: NoteItem;
  attachments: DocumentItem[];
  linkTargets: NoteLinkTarget[];
  last: boolean;
  previewId: string | null;
  onPreview: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [link, setLink] = useState(encodeLink(note));
  const [history, setHistory] = useState<NoteRevision[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { confirm } = useDialogs();

  const target = linkTargets.find((t) => t.id === (note.leadId ?? note.contractId));

  function saveEdit() {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    const t = decodeLink(link);
    start(async () => {
      const res = await updateNote(
        note.id,
        text,
        { leadId: t?.kind === "lead" ? t.id : null, contractId: t?.kind === "contract" ? t.id : null },
        { customerId },
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      setHistory(null); // stale now — reloaded next time it's opened
      router.refresh();
    });
  }

  function toggleHistory() {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    if (history) return;
    start(async () => {
      const res = await loadNoteHistory(note.id);
      if (res.error) setError(res.error);
      else setHistory(res.revisions ?? []);
    });
  }

  function attach(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    if (!chosen.length) return;
    setError(null);
    start(async () => {
      for (const f of chosen) {
        const up = await uploadAttachment({ file: f, customerId, noteId: note.id, confirm });
        if (up.error) setError(`${f.name}: ${up.error}`);
      }
      router.refresh();
    });
  }

  return (
    <div className={cn("group py-3", !last && "border-b border-[#f4f4f5]")}>
      {editing ? (
        <div>
          <textarea
            autoFocus
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full resize-y rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[12.5px] text-[#0a0a0a] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
          />
          <div className="mt-2 max-w-[280px]">
            <LinkPicker value={link} onChange={setLink} linkTargets={linkTargets} />
          </div>
          <p className="mt-1.5 text-[11px] text-[#a1a1aa]">
            The current wording is kept in this note&rsquo;s history — nothing is overwritten.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={pending || !draft.trim()}
              className="rounded-md bg-[var(--accent-blue)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(note.content);
                setLink(encodeLink(note));
                setEditing(false);
                setError(null);
              }}
              className="text-[12px] font-semibold text-[#71717a]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-[12.5px] text-[#3f3f46]">{note.content}</p>
      )}

      {!editing && (target || attachments.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {target && (
            <Link
              href={`/${target.kind}s/${target.id}`}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-tint)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--accent-active)] hover:brightness-95"
            >
              <Icon name="arrow-right" size={11} /> {target.label}
            </Link>
          )}
          {attachments.map((a) => (
            <Attachment
              key={a.id}
              doc={a}
              customerId={customerId}
              selected={a.id === previewId}
              onPreview={() => onPreview(a.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#a1a1aa]">
        <span>
          {note.author ?? "Unknown"} · {fmtDateTime(note.createdAt)}
        </span>
        {note.updatedAt && (
          <button
            type="button"
            onClick={toggleHistory}
            className="inline-flex items-center gap-1 font-semibold text-[var(--accent-blue)]"
          >
            <Icon name="clock" size={11} />
            Edited by {note.editor ?? "unknown"} · {fmtDateTime(note.updatedAt)}
          </button>
        )}
        <span className="ml-auto flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          {!editing && (
            <>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="font-semibold text-[#71717a] hover:text-[#3f3f46]"
              >
                Attach
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="font-semibold text-[#71717a] hover:text-[#3f3f46]"
              >
                Edit
              </button>
            </>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              const ok = await confirm({
                title: "Remove this note?",
                message:
                  "Its version history goes with it. Any attachments stay on the customer's Documents tab.",
                confirmLabel: "Remove note",
                tone: "danger",
              });
              if (!ok) return;
              start(async () => {
                await deleteNote(note.id, { customerId });
                router.refresh();
              });
            }}
            className="font-semibold text-[#d64545] disabled:opacity-50"
          >
            Remove
          </button>
        </span>
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          attach(e.target.files);
          e.target.value = "";
        }}
      />

      {error && <p className="mt-1.5 text-[11.5px] font-medium text-[#d64545]">{error}</p>}

      {showHistory && (
        <div className="mt-2 rounded-lg border border-[#e7e7ea] bg-[#fafafa] p-2.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#71717a]">
            Version history
          </p>
          {history === null ? (
            <p className="text-[11.5px] text-[#a1a1aa]">Loading…</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {history.map((r) => (
                <li key={r.version} className="border-l-2 border-[#e4e4e7] pl-2.5">
                  <p className="text-[11px] text-[#a1a1aa]">
                    v{r.version}
                    {r.version === 1 ? " · written" : " · edited"} by {r.editedBy ?? "unknown"} ·{" "}
                    {fmtDateTime(r.editedAt)}
                  </p>
                  <p className="whitespace-pre-wrap text-[12px] text-[#52525b]">{r.content}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

// --- Attachment chip --------------------------------------------------------
function Attachment({
  doc,
  customerId,
  selected,
  onPreview,
}: {
  doc: DocumentItem;
  customerId: string;
  selected: boolean;
  onPreview: () => void;
}) {
  const [pending, start] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const router = useRouter();
  const { confirm } = useDialogs();

  function commitRename(next: string) {
    setRenaming(false);
    const clean = next.trim();
    if (!clean || clean === doc.name) return;
    start(async () => {
      await renameDocument(doc.id, clean, "customer", customerId);
      router.refresh();
    });
  }

  if (renaming) {
    return (
      <input
        autoFocus
        defaultValue={doc.name}
        onBlur={(e) => commitRename(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setRenaming(false);
          }
        }}
        className="rounded-full border border-[var(--accent-blue)] bg-white px-2.5 py-1 text-[11.5px] text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
      />
    );
  }

  return (
    <span
      className={cn(
        "group/att inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] transition-colors",
        selected
          ? "bg-[var(--accent-tint)] text-[var(--accent-active)]"
          : "bg-[#f4f4f5] text-[#3f3f46] hover:bg-[#ececee]",
      )}
    >
      <Icon name={isImage(doc) ? "eye" : "file"} size={11} />
      <button
        type="button"
        // Selects the file for the viewer on the right, rather than punting the
        // user out to a new tab.
        onMouseDown={onPreview}
        className={cn("font-medium", selected && "font-semibold")}
      >
        {doc.name}
      </button>
      <button
        type="button"
        aria-label={`Rename ${doc.name}`}
        title="Rename"
        onClick={() => setRenaming(true)}
        className="text-[#a1a1aa] opacity-0 transition-opacity hover:text-[#3f3f46] group-hover/att:opacity-100"
      >
        <Icon name="pencil" size={10.5} strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label={`Remove ${doc.name}`}
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: `Delete “${doc.name}”?`,
            message: "The file is removed from the customer's record too, not just this note.",
            confirmLabel: "Delete file",
            tone: "danger",
          });
          if (!ok) return;
          start(async () => {
            await deleteDocument(doc.id, "customer", customerId);
            router.refresh();
          });
        }}
        className="text-[#a1a1aa] hover:text-[#d64545]"
      >
        ✕
      </button>
    </span>
  );
}

// --- Shared bits ------------------------------------------------------------
function LinkPicker({
  value,
  onChange,
  linkTargets,
}: {
  value: string;
  onChange: (v: string) => void;
  linkTargets: NoteLinkTarget[];
}) {
  return (
    <Combo
      options={[
        { value: NO_LINK, label: "Not linked" },
        ...linkTargets.map((t) => ({ value: `${t.kind}:${t.id}`, label: t.label })),
      ]}
      value={value}
      onChange={onChange}
      placeholder="Link to a lead or contract…"
      searchPlaceholder="Search leads & contracts…"
    />
  );
}

function encodeLink(n: NoteItem): string {
  if (n.leadId) return `lead:${n.leadId}`;
  if (n.contractId) return `contract:${n.contractId}`;
  return NO_LINK;
}

function decodeLink(v: string): { kind: "lead" | "contract"; id: string } | null {
  if (!v || v === NO_LINK) return null;
  const [kind, id] = v.split(":");
  if ((kind === "lead" || kind === "contract") && id) return { kind, id };
  return null;
}

/** SHA-256 of a file, hex — computed in the browser so a duplicate never costs
 *  an upload of the whole file. Returns null if the browser won't do it (an
 *  insecure context), in which case we simply upload as before. */
async function hashFile(file: File): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/**
 * Attach one file to a note. If the identical file is already on the customer's
 * record, the user chooses: reuse it (one copy in storage, shared by both rows)
 * or upload another copy. Escape/backdrop takes the non-duplicating option.
 */
async function uploadAttachment({
  file,
  customerId,
  noteId,
  confirm,
}: {
  file: File;
  customerId: string;
  noteId: string;
  confirm: ReturnType<typeof useDialogs>["confirm"];
}): Promise<{ error?: string }> {
  const contentHash = await hashFile(file);
  if (contentHash) {
    const dupe = await findDuplicateDocument({ contentHash, customerId });
    if (dupe.id) {
      const uploadAnyway = await confirm({
        title: `“${file.name}” is already on this record`,
        message: `Saved as “${dupe.name}”${dupe.uploader ? ` by ${dupe.uploader}` : ""}${
          dupe.createdAt ? ` on ${fmtDateTime(dupe.createdAt)}` : ""
        }. Attaching that one keeps a single copy of the file.`,
        confirmLabel: "Upload another copy",
        cancelLabel: "Attach the existing file",
        tone: "warning",
      });
      if (!uploadAnyway) {
        return attachExistingDocument({
          documentId: dupe.id,
          noteId,
          ownerType: "customer",
          ownerId: customerId,
        });
      }
    }
  }

  const fd = new FormData();
  fd.set("ownerType", "customer");
  fd.set("ownerId", customerId);
  fd.set("customerId", customerId);
  fd.set("noteId", noteId);
  fd.set("file", file);
  return uploadDocument(fd);
}

function isImage(doc: DocumentItem): boolean {
  return (doc.file_type ?? "").startsWith("image/");
}

function fmtDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
