"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { useDialogs } from "./dialogs";
import { useFloatingMenu } from "./floating-menu";
import { Icon } from "./icon";

export type ComboOption = { id?: string; value: string; label: string };

const MENU_WIDTH = 224; // w-56, the "text" variant's fixed menu width

// Reusable searchable dropdown with an inline "Add new" — the tenant-editable
// pick-list control. Filters as you type; if the query matches nothing you can
// add it (persisted via onAddNew). Custom options can be removed via onDelete.
// Accent-themed so it rebrands per tenant.
export function Combo({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search or add…",
  addNounLabel = "Add",
  onAddNew,
  onDelete,
  className,
  variant = "input",
  align,
  clearable = true,
  mono,
}: {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  addNounLabel?: string;
  onAddNew?: (label: string) => Promise<{ label?: string; error?: string }>;
  onDelete?: (id: string) => Promise<{ error?: string }>;
  className?: string;
  /** "input" = bordered box; "text" = plain value that reveals the menu on click. */
  variant?: "input" | "text";
  /** Which trigger edge the menu lines up with. Defaults to the trigger's own
   *  text alignment: right for the "text" variant (field rows put the value on
   *  the right), left for the boxed input. */
  align?: "start" | "end";
  /** Clicking the already-selected option empties the field. Off only where the
   *  list has its own "none" entry, or where a value is required. */
  clearable?: boolean;
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { confirm } = useDialogs();

  const menuStyle = useFloatingMenu({
    open,
    triggerRef,
    width: variant === "input" ? "trigger" : MENU_WIDTH,
    align: align ?? (variant === "text" ? "end" : "start"),
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q));
  const exact = options.some((o) => o.label.toLowerCase() === q);
  const selected = options.find((o) => o.value.toLowerCase() === (value ?? "").toLowerCase());

  function choose(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  function addNew() {
    const label = query.trim();
    if (!label || !onAddNew) return;
    setError(null);
    start(async () => {
      const res = await onAddNew(label);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.label) {
        onChange(res.label);
        router.refresh();
      }
      setOpen(false);
      setQuery("");
    });
  }

  // `||`, not `??`: a cleared field can arrive as "" as well as null, and an
  // empty string would otherwise render an empty — so unclickable — trigger
  // with no placeholder to aim at.
  const shown = selected?.label || value || null;

  return (
    <div ref={ref} className={cn("relative", variant === "text" && "inline-block", className)}>
      {variant === "text" ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "-mx-1 rounded px-1 text-right text-[12.5px] font-medium text-[#3f3f46] transition-colors hover:bg-[var(--accent-tint)]",
            mono && "font-mono",
            // min-w keeps an empty field clickable even if its placeholder is blank.
            !shown && "min-w-[18px] text-[#a1a1aa]",
          )}
        >
          {shown ?? placeholder}
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-left text-[13px] text-[#0a0a0a] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
        >
          <span className={cn("flex-1 truncate", !shown && "text-[#a1a1aa]")}>{shown ?? placeholder}</span>
          <Icon name="chevron-down" size={13} className="text-[#71717a]" />
        </button>
      )}

      {open && menuStyle && (
        <div
          style={menuStyle}
          className="z-50 flex flex-col overflow-hidden rounded-lg border border-[#e7e7ea] bg-white shadow-[0_12px_32px_rgba(10,10,10,0.10),0_4px_8px_rgba(10,10,10,0.05)]"
        >
          <div className="shrink-0 border-b border-[#f4f4f5] p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && q && !exact && onAddNew) {
                  e.preventDefault();
                  addNew();
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-[#d4d4d8] px-2.5 py-1.5 text-[12.5px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {filtered.map((o) => {
              // Same case-insensitive comparison the trigger uses, so the tick
              // can't disagree with the value on show.
              const isSelected = o.value.toLowerCase() === (value ?? "").toLowerCase();
              const clears = isSelected && clearable;
              return (
                <div key={o.value} className="group flex items-center rounded-md hover:bg-[var(--accent-tint)]">
                  <button
                    type="button"
                    title={clears ? `Clear “${o.label}”` : undefined}
                    onClick={() => choose(clears ? "" : o.value)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1.5 text-left text-[12.5px]",
                      isSelected ? "font-semibold text-[var(--accent-active)]" : "text-[#3f3f46]",
                    )}
                  >
                    {/* The tick sits ONLY on the selected row — an empty slot on
                        every other row would indent the whole list to wait for a
                        mark that isn't coming. On hover it becomes an ✕: that's
                        the "click me again to empty the field" affordance. */}
                    {isSelected && (
                      <span className="flex w-3.5 shrink-0 items-center justify-center">
                        <Icon
                          name="check"
                          size={12}
                          strokeWidth={2.4}
                          className={clears ? "group-hover:hidden" : ""}
                        />
                        {clears && (
                          <Icon name="x" size={12} strokeWidth={2.4} className="hidden group-hover:block" />
                        )}
                      </span>
                    )}
                    <span className="truncate">{o.label}</span>
                  </button>
                  {onDelete && o.id && (
                    <button
                      type="button"
                      aria-label={`Remove “${o.label}” from this list`}
                      title={`Remove “${o.label}” from this list`}
                      disabled={pending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Remove “${o.label}” from this list?`,
                          message:
                            "It stops appearing in this dropdown for everyone at your company. Records already set to it keep the value, and you can add it back at any time.",
                          confirmLabel: "Remove from list",
                          tone: "danger",
                        });
                        if (!ok) return;
                        start(async () => {
                          await onDelete(o.id!);
                          router.refresh();
                        });
                      }}
                      className="mr-1 shrink-0 rounded p-1 text-[#d4d4d8] transition-colors hover:bg-white hover:text-[#d64545] group-hover:text-[#a1a1aa]"
                    >
                      <Icon name="trash" size={12} strokeWidth={1.9} />
                    </button>
                  )}
                </div>
              );
            })}

            {onAddNew && q && !exact && (
              <button
                type="button"
                disabled={pending}
                onClick={addNew}
                className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px] font-semibold text-[var(--accent-blue)] hover:bg-[var(--accent-tint)]"
              >
                <Icon name="plus" size={12} strokeWidth={2.2} /> {addNounLabel} “{query.trim()}”
              </button>
            )}

            {filtered.length === 0 && (!onAddNew || !q) && (
              <div className="px-2.5 py-2 text-[12.5px] text-[#a1a1aa]">No matches</div>
            )}
          </div>
          {error && (
            <div className="shrink-0 border-t border-[#f4f4f5] px-2.5 py-2 text-[11.5px] font-medium text-[#d64545]">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
