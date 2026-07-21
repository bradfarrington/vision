"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  uploadDocument,
  renameDocument,
  deleteDocument,
  setDocumentCategory,
  addDocumentCategory,
  deleteDocumentCategory,
  getDocumentSignedUrl,
} from "@/app/(app)/documents/actions";
import type { DocumentItem, DocumentOwnerType } from "@/lib/data/documents";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { Combo } from "./combo";
import { InlineViewer, FullscreenViewer, type ViewerDoc } from "./document-viewer";

type CategoryOption = { id: string; label: string };

// ---------------------------------------------------------------------------
// DocumentsPanel — reusable two-pane file store. Left: toolbar + selectable
// list (rename, category). Right: inline viewer with zoom + full-screen. Drop
// it into any record tab with an ownerType + ownerId; customers/leads/contracts
// all share it. (customerId is only needed for lead/contract owners, to nest
// their files under the owning customer — for a customer owner it's the id.)
// ---------------------------------------------------------------------------
export function DocumentsPanel({
  ownerType,
  ownerId,
  documents,
  categoryOptions = [],
  customerId,
}: {
  ownerType: DocumentOwnerType;
  ownerId: string;
  documents: DocumentItem[];
  categoryOptions?: CategoryOption[];
  customerId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(documents[0]?.id ?? null);
  const [fullscreen, setFullscreen] = useState<ViewerDoc | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = documents.find((d) => d.id === selectedId) ?? null;
  const selectedViewer: ViewerDoc | null = selected
    ? { id: selected.id, name: selected.name, file_name: selected.file_name, file_type: selected.file_type }
    : null;

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setError(null);
    setBusy(true);
    setProgress({ done: 0, total: files.length });
    let firstError: string | null = null;
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      fd.set("ownerType", ownerType);
      fd.set("ownerId", ownerId);
      if (customerId) fd.set("customerId", customerId);
      fd.set("file", files[i]);
      const res = await uploadDocument(fd);
      if (res?.error && !firstError) firstError = res.error;
      setProgress({ done: i + 1, total: files.length });
    }
    setBusy(false);
    setProgress(null);
    if (firstError) setError(firstError);
    router.refresh();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!busy && e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  async function printDoc(doc: DocumentItem) {
    const res = await getDocumentSignedUrl(doc.id);
    if (!res.url) {
      if (res.error) setError(res.error);
      return;
    }
    if ((doc.file_type ?? "").startsWith("image/")) {
      const w = window.open("", "_blank", "width=900,height=1000");
      if (!w) return;
      w.document.write(
        `<!doctype html><title>${doc.name}</title><body style="margin:0;display:flex;justify-content:center"><img src="${res.url}" style="max-width:100%" onload="window.focus();window.print()"></body>`,
      );
      w.document.close();
    } else {
      // PDFs (and anything else) open in a new tab where the browser's own
      // viewer handles printing.
      window.open(res.url, "_blank");
    }
  }

  // The PDF preview is a cross-origin iframe; once it has focus the browser
  // eats the first click on the surrounding UI (just to blur the iframe), so
  // selecting another file appears to need a double-click. Proactively blurring
  // the focused iframe on mouse-down lets the very next click land normally.
  function reclaimFocus() {
    const active = document.activeElement as HTMLElement | null;
    if (active && active.tagName === "IFRAME") active.blur();
  }

  return (
    <div
      className="relative flex flex-col lg:h-full"
      onMouseDownCapture={reclaimFocus}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:items-stretch">
        {/* Left: toolbar + list (40% of the 40/60 split) */}
        <div className="flex flex-col lg:w-2/5 lg:min-h-0 lg:shrink-0">
          <Toolbar
            hasSelection={!!selected}
            busy={busy}
            progress={progress}
            onAdd={() => inputRef.current?.click()}
            onView={() => selectedViewer && setFullscreen(selectedViewer)}
            onPrint={() => selected && printDoc(selected)}
            onDelete={async () => {
              if (!selected) return;
              if (!confirm(`Delete “${selected.name}”? This can’t be undone.`)) return;
              const res = await deleteDocument(selected.id, ownerType, ownerId);
              if (res?.error) setError(res.error);
              else {
                if (selectedId === selected.id) setSelectedId(null);
                router.refresh();
              }
            }}
          />

          {error && <p className="mt-2 text-[11px] font-medium text-[#d64545]">{error}</p>}

          <div className="mt-3 flex-1 lg:min-h-0 lg:overflow-y-auto">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#e7e7ea] bg-[#fafafa] py-12 text-center">
                <Icon name="upload" size={20} strokeWidth={1.75} className="text-[#a1a1aa]" />
                <p className="text-[12.5px] font-medium text-[#71717a]">No documents yet</p>
                <p className="text-[11px] text-[#a1a1aa]">Drag files here or use “Add document”.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#e7e7ea] bg-white">
                {documents.map((d, i) => (
                  <DocRow
                    key={d.id}
                    doc={d}
                    ownerType={ownerType}
                    ownerId={ownerId}
                    categoryOptions={categoryOptions}
                    selected={d.id === selectedId}
                    last={i === documents.length - 1}
                    onSelect={() => setSelectedId(d.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Right: inline viewer (fills the container height) */}
        <div className="flex min-h-[600px] min-w-0 flex-1 flex-col lg:min-h-0">
          <InlineViewer
            doc={selectedViewer}
            onFullscreen={() => selectedViewer && setFullscreen(selectedViewer)}
          />
        </div>
      </div>

      {/* Drag overlay */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--accent-blue)] bg-[var(--accent-tint)]/80 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2">
            <Icon name="upload" size={24} strokeWidth={2} className="text-[var(--accent-blue)]" />
            <p className="text-[13px] font-semibold text-[var(--accent-blue)]">Drop files to upload</p>
          </div>
        </div>
      )}

      <FullscreenViewer doc={fullscreen} onClose={() => setFullscreen(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------
function Toolbar({
  hasSelection,
  busy,
  progress,
  onAdd,
  onView,
  onPrint,
  onDelete,
}: {
  hasSelection: boolean;
  busy: boolean;
  progress: { done: number; total: number } | null;
  onAdd: () => void;
  onView: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
      >
        <Icon name="upload" size={14} strokeWidth={2} />
        {busy ? `Uploading${progress ? ` ${progress.done}/${progress.total}` : ""}…` : "Add document"}
      </button>
      <TBtn icon="eye" label="View" onClick={onView} disabled={!hasSelection} />
      <TBtn icon="envelope" label="Email" onClick={() => {}} disabled title="Email — coming soon" />
      <TBtn icon="printer" label="Print" onClick={onPrint} disabled={!hasSelection} />
      <TBtn icon="trash" label="Delete" onClick={onDelete} disabled={!hasSelection} danger />
    </div>
  );
}

function TBtn({
  icon,
  label,
  onClick,
  disabled,
  danger,
  title,
}: {
  icon: "eye" | "envelope" | "printer" | "trash";
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-[#e7e7ea] bg-white px-2.5 py-2 text-[12.5px] font-semibold transition-colors hover:bg-[#fafafa] disabled:opacity-45 disabled:hover:bg-white",
        danger ? "text-[#d64545]" : "text-[#3f3f46]",
      )}
    >
      <Icon name={icon} size={14} strokeWidth={1.9} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// List row
// ---------------------------------------------------------------------------
function DocRow({
  doc,
  ownerType,
  ownerId,
  categoryOptions,
  selected,
  last,
  onSelect,
}: {
  doc: DocumentItem;
  ownerType: DocumentOwnerType;
  ownerId: string;
  categoryOptions: CategoryOption[];
  selected: boolean;
  last: boolean;
  onSelect: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(doc.name);
  const [pending, start] = useTransition();

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === doc.name) {
      setEditing(false);
      setName(doc.name);
      return;
    }
    start(async () => {
      const res = await renameDocument(doc.id, trimmed, ownerType, ownerId);
      if (!res?.error) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <div
      onMouseDown={onSelect}
      className={cn(
        "group flex cursor-pointer items-start gap-2.5 border-l-2 px-3 py-2.5 transition-colors",
        last ? "" : "border-b border-b-[#f4f4f5]",
        selected
          ? "border-l-[var(--accent-blue)] bg-[var(--accent-tint)]/50"
          : "border-l-transparent hover:bg-[#fafafa]",
      )}
    >
      <Icon name="file" size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--accent-blue)]" />

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={name}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                setEditing(false);
                setName(doc.name);
              }
            }}
            disabled={pending}
            className="w-full rounded-md border border-[var(--accent-blue)] bg-white px-2 py-1 text-[12.5px] font-semibold text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
          />
        ) : (
          <p className="truncate text-[12.5px] font-semibold text-[#0a0a0a]">{doc.name}</p>
        )}

        <p className="mt-0.5 truncate text-[11px] text-[#a1a1aa]">
          {doc.uploader ?? "—"} · {longDate(doc.created_at)}
          {doc.file_size ? ` · ${fileSize(doc.file_size)}` : ""}
        </p>

        {/* Category picker */}
        <div className="mt-1" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <CategoryPicker doc={doc} ownerType={ownerType} ownerId={ownerId} options={categoryOptions} />
        </div>
      </div>

      {/* Rename */}
      <button
        type="button"
        title="Rename"
        aria-label="Rename"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#a1a1aa] opacity-0 transition-opacity hover:bg-white hover:text-[#3f3f46] group-hover:opacity-100"
      >
        <Icon name="pencil" size={13} strokeWidth={1.9} />
      </button>
    </div>
  );
}

// Inline category dropdown, backed by the tenant `document_category` list.
function CategoryPicker({
  doc,
  ownerType,
  ownerId,
  options,
}: {
  doc: DocumentItem;
  ownerType: DocumentOwnerType;
  ownerId: string;
  options: CategoryOption[];
}) {
  const router = useRouter();
  const [, start] = useTransition();

  return (
    <Combo
      variant="text"
      value={doc.category}
      placeholder="+ Category"
      searchPlaceholder="Search or add category…"
      addNounLabel="Add category"
      options={options.map((o) => ({ id: o.id, value: o.label, label: o.label }))}
      onChange={(value) =>
        start(async () => {
          await setDocumentCategory(doc.id, value, ownerType, ownerId);
          router.refresh();
        })
      }
      onAddNew={(label) => addDocumentCategory(label)}
      onDelete={(id) => deleteDocumentCategory(id)}
      className="[&>button]:text-left"
    />
  );
}

function longDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} KB`;
  return `${bytes} B`;
}
