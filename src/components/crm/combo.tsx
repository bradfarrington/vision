"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export type ComboOption = { id?: string; value: string; label: string };

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
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

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
  const selected = options.find((o) => o.value === value);

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

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-left text-[13px] text-[#0a0a0a] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
      >
        <span className={cn("flex-1 truncate", !selected && !value && "text-[#a1a1aa]")}>
          {selected?.label ?? value ?? placeholder}
        </span>
        <Icon name="chevron-down" size={13} className="text-[#71717a]" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-[#e7e7ea] bg-white shadow-[0_12px_32px_rgba(10,10,10,0.10),0_4px_8px_rgba(10,10,10,0.05)]">
          <div className="border-b border-[#f4f4f5] p-2">
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
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.map((o) => (
              <div key={o.value} className="group flex items-center rounded-md hover:bg-[var(--accent-tint)]">
                <button
                  type="button"
                  onClick={() => choose(o.value)}
                  className={cn(
                    "flex-1 px-2.5 py-1.5 text-left text-[12.5px]",
                    o.value === value ? "font-semibold text-[var(--accent-active)]" : "text-[#3f3f46]",
                  )}
                >
                  {o.label}
                </button>
                {onDelete && o.id && (
                  <button
                    type="button"
                    aria-label={`Remove ${o.label}`}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await onDelete(o.id!);
                        router.refresh();
                      })
                    }
                    className="mr-1 px-1.5 text-[12px] text-[#a1a1aa] opacity-0 hover:text-[#d64545] group-hover:opacity-100"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

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
            <div className="border-t border-[#f4f4f5] px-2.5 py-2 text-[11.5px] font-medium text-[#d64545]">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
