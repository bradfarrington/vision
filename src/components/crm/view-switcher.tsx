"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { useSetParams } from "./list-controls";
import { useListLayout } from "./data-list";
import { useDialogs } from "./dialogs";
import { useFloatingMenu } from "./floating-menu";
import { Icon } from "./icon";
import {
  createSavedView,
  deleteSavedView,
  renameSavedView,
  updateSavedView,
} from "@/app/(app)/views/actions";
import {
  ALL_VIEW_ID,
  pickViewQuery,
  paramsForView,
  sameColumns,
  sameQuery,
  type SavedView,
  type ViewEntity,
} from "@/lib/views/views";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The saved-view switcher, on the PAGE TITLE rather than in the toolbar.
//
// The toolbar buttons are verbs — they modify what you're looking at. A view is
// the SUBJECT: it's what you're looking at, and it contains those filters. So it
// reads as `Leads › All leads ▾`, not as a sixth button next to Filters.
//
// Selecting a view expands its query into the URL (the server keeps reading
// plain params and knows nothing about views), and `sv=<id>` records which one
// is loaded so the screen can tell "this is the saved view" from "this is the
// saved view plus two changes" — the DIRTY state, without which nobody can tell
// whether what they're looking at is what they saved.
// ---------------------------------------------------------------------------

export function ViewSwitcher({
  entity,
  views,
  activeId,
}: {
  entity: ViewEntity;
  views: SavedView[];
  /** `sv` from the URL, or undefined for the implicit "all" view. */
  activeId?: string;
}) {
  const { setParams, searchParams } = useSetParams();
  const layout = useListLayout();
  const { confirm } = useDialogs();
  const [open, setOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuStyle = useFloatingMenu({ open, triggerRef, width: 300, align: "start", maxHeight: 460 });

  const active = views.find((v) => v.id === activeId) ?? views.find((v) => v.id === ALL_VIEW_ID)!;
  const current = pickViewQuery(searchParams);

  // Dirty = the URL's view-params differ from the saved ones, or the columns do.
  // Column layout only counts when the view pins one; a system view says WHICH
  // records, not how to look at them.
  const dirty =
    !sameQuery(current, active.query) ||
    (!!active.columns && !!layout && !sameColumns(active.columns, layout));

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function select(view: SavedView) {
    setParams(paramsForView(view, searchParams));
    setOpen(false);
  }

  function saveOver() {
    setError(null);
    startSaving(async () => {
      const res = await updateSavedView({
        entity,
        id: active.id,
        query: current,
        columns: layout,
      });
      if (res.error) setError(res.error);
    });
  }

  // The naming panel does double duty: creating a view and renaming one. A
  // native prompt() is never an option here (see AGENTS.md § Dialogs).
  const [naming, setNaming] = useState<null | { mode: "new" } | { mode: "rename"; view: SavedView }>(
    null,
  );

  function submitName(name: string) {
    if (!naming) return;
    setError(null);
    startSaving(async () => {
      const res =
        naming.mode === "new"
          ? await createSavedView({ entity, name, query: current, columns: layout })
          : await renameSavedView(entity, naming.view.id, name);
      if (res.error) {
        setError(res.error);
        return;
      }
      setNaming(null);
      // Land on the new view, so the dirty state clears and the title updates.
      if (naming.mode === "new" && res.id) setParams({ sv: res.id });
    });
  }

  async function remove(view: SavedView) {
    const ok = await confirm({
      title: `Delete “${view.name}”?`,
      message:
        "The view goes for good. The leads or customers in it are untouched — a view is only a saved arrangement.",
      confirmLabel: "Delete view",
      tone: "danger",
    });
    if (!ok) return;
    startSaving(async () => {
      const res = await deleteSavedView(entity, view.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (view.id === active.id) setParams(paramsForView(null, searchParams));
    });
  }

  function rename(view: SavedView) {
    setOpen(false);
    setNaming({ mode: "rename", view });
  }

  const system = views.filter((v) => v.system);
  const mine = views.filter((v) => !v.system && !v.shared);
  const shared = views.filter((v) => !v.system && v.shared);

  return (
    <div ref={ref} style={{ display: "contents" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[15px] font-semibold text-[#3f3f46] transition-colors hover:bg-[#f4f4f5]"
      >
        <span className="min-w-0 truncate">{active.name}</span>
        <Icon
          name="chevron-down"
          size={13}
          strokeWidth={2.4}
          className={cn("shrink-0 text-[#a1a1aa] transition-transform", open && "rotate-180")}
        />
      </button>

      {/* Dirty state — the whole reason the switcher is worth having. Without
          it you can't tell a saved view from one you've fiddled with. */}
      {dirty && (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-[#fdf2dc] px-2 py-[2px] text-[11px] font-semibold text-[#b86e00]">
            Modified
          </span>
          {!active.system && (
            <button
              type="button"
              onClick={saveOver}
              disabled={saving}
              className="text-[12px] font-semibold text-[var(--accent-blue)] hover:underline disabled:opacity-60"
            >
              Save
            </button>
          )}
          <button
            type="button"
            onClick={() => setNaming({ mode: "new" })}
            disabled={saving}
            className="text-[12px] font-semibold text-[var(--accent-blue)] hover:underline disabled:opacity-60"
          >
            Save as new
          </button>
          <button
            type="button"
            onClick={() => select(active)}
            className="text-[12px] font-medium text-[#71717a] hover:text-[#3f3f46]"
          >
            Reset
          </button>
        </div>
      )}

      {error && <span className="text-[12px] font-medium text-[#d64545]">{error}</span>}

      {naming && (
        <NameDialog
          mode={naming.mode}
          initial={naming.mode === "rename" ? naming.view.name : ""}
          onCancel={() => setNaming(null)}
          onSave={submitName}
          pending={saving}
        />
      )}

      {open && menuStyle && (
        <div
          style={menuStyle}
          className="z-50 flex flex-col overflow-hidden rounded-xl border border-[#e7e7ea] bg-white shadow-[0_8px_28px_rgba(10,10,10,0.14)]"
        >
          <div className="min-h-0 overflow-y-auto py-1.5">
            <Section label="Built in" />
            {system.map((v) => (
              <Row key={v.id} view={v} active={v.id === active.id} onSelect={() => select(v)} />
            ))}
            {shared.length > 0 && <Section label="Shared with the team" />}
            {shared.map((v) => (
              <Row key={v.id} view={v} active={v.id === active.id} onSelect={() => select(v)} />
            ))}
            <Section label="My views" />
            {mine.length === 0 && (
              <p className="px-3 py-1.5 text-[12px] text-[#a1a1aa]">
                Filter the list, then “Save as new”.
              </p>
            )}
            {mine.map((v) => (
              <Row
                key={v.id}
                view={v}
                active={v.id === active.id}
                onSelect={() => select(v)}
                onRename={() => rename(v)}
                onDelete={() => remove(v)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
      {label}
    </div>
  );
}

function Row({
  view,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  view: SavedView;
  active: boolean;
  onSelect: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group flex items-center gap-1 px-1.5">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[13px] hover:bg-[#fafafa]",
          active ? "font-semibold text-[var(--accent-blue)]" : "text-[#3f3f46]",
        )}
      >
        <span className="w-[14px] shrink-0">
          {active && <Icon name="check" size={12} strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1 truncate">{view.name}</span>
      </button>
      {/* Curation controls are always present, not hover-only — the only way to
          manage a list must be discoverable (see AGENTS.md § Lookup dropdowns). */}
      {onRename && (
        <button
          type="button"
          onClick={onRename}
          aria-label={`Rename ${view.name}`}
          className="shrink-0 rounded p-1 text-[#c4c4c8] transition-colors hover:text-[#3f3f46]"
        >
          <Icon name="pencil" size={12} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${view.name}`}
          className="shrink-0 rounded p-1 text-[#c4c4c8] transition-colors hover:text-[#d64545]"
        >
          <Icon name="trash" size={12} />
        </button>
      )}
    </div>
  );
}

/** Small inline naming panel — a full Dialog is more ceremony than one field needs. */
function NameDialog({
  mode,
  initial,
  onCancel,
  onSave,
  pending,
}: {
  mode: "new" | "rename";
  initial: string;
  onCancel: () => void;
  onSave: (name: string) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(initial);
  const isNew = mode === "new";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/20 pt-[18vh]">
      <div className="w-[340px] rounded-xl border border-[#e7e7ea] bg-white p-4 shadow-[0_12px_40px_rgba(10,10,10,0.18)]">
        <div className="mb-1 text-[14px] font-bold text-[#0a0a0a]">
          {isNew ? "Save as a new view" : "Rename view"}
        </div>
        <p className="mb-3 text-[12px] text-[#71717a]">
          {isNew
            ? "Saves the current filters, sort and columns. Only you will see it."
            : "Only the name changes — the filters and columns stay as they are."}
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSave(name);
            if (e.key === "Escape") onCancel();
          }}
          placeholder="e.g. My live leads"
          className="w-full rounded-lg border border-[#d4d4d8] px-3 py-2 text-[13px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#e7e7ea] px-3 py-1.5 text-[12.5px] font-semibold text-[#3f3f46] hover:bg-[#fafafa]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(name)}
            disabled={pending || !name.trim()}
            className="rounded-lg bg-[var(--accent-blue)] px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {pending ? "Saving…" : isNew ? "Save view" : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}
