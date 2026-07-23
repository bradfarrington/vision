"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Icon } from "./icon";
import { TOOLBAR_H } from "./primitives";
import { cn } from "@/lib/utils";

// Shared URL-param helpers for list screens. Search/filters/sort all live in
// the query string so the server component can read them and re-query — real,
// shareable, back-button-friendly state (no client data fetching).
//
// The columns/filters popovers themselves live in `data-list.tsx`; this file
// is just the URL plumbing and the search control shared by every list.

export function useSetParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParams = useCallback(
    (updates: Record<string, string | null>, { resetPage = true } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      if (resetPage) params.delete("page");
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  return { setParams, isPending, searchParams };
}

// ---------------------------------------------------------------------------
/** The `search` param, debounced so a keystroke doesn't push a route. */
function useDebouncedSearch() {
  const { setParams, searchParams } = useSetParams();
  const applied = searchParams.get("search") ?? "";
  const [value, setValue] = useState(applied);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      setParams({ search: value.trim() || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return { value, setValue, applied };
}

/**
 * Search as a TOOLBAR BUTTON that expands into a field — for list screens, where
 * it sits on the same row as Date Range / Columns / Filters instead of costing
 * the table a whole row of its own.
 *
 * It stays open whenever there's a term, applied or still being typed: a
 * collapsed magnifier over a filtered list would hide WHY the list is short.
 * Escape clears and closes; blurring an empty field closes it.
 */
export function SearchButton({ placeholder, width = 260 }: { placeholder: string; width?: number }) {
  const { value, setValue, applied } = useDebouncedSearch();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const expanded = open || !!value || !!applied;

  if (!expanded) {
    return (
      <button
        type="button"
        aria-label="Search"
        onClick={() => {
          setOpen(true);
          // The input mounts on this render; focus it once it exists.
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        // Square and TOOLBAR_H tall, so it matches its labelled neighbours; the
        // glyph is a size up and heavier than the icons that sit beside text,
        // since here it is the whole button and has no word to lean on.
        className={cn(
          TOOLBAR_H,
          "inline-flex w-[38px] items-center justify-center rounded-lg border border-[#e7e7ea] bg-white text-[#3f3f46] transition-colors hover:bg-[#fafafa] hover:text-[#0a0a0a]",
        )}
      >
        <Icon name="search" size={16} strokeWidth={2.4} />
      </button>
    );
  }

  return (
    <div
      className={cn(
        TOOLBAR_H,
        "flex items-center gap-2 rounded-lg border border-[#d4d4d8] bg-white px-3 text-[13px] focus-within:border-[var(--accent-blue)] focus-within:ring-2 focus-within:ring-[var(--accent-tint)]",
      )}
      style={{ width }}
    >
      <Icon name="search" size={16} strokeWidth={2.4} className="shrink-0 text-[#a1a1aa]" />
      <input
        ref={inputRef}
        autoFocus={open}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (!value) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue("");
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent text-[#3f3f46] placeholder:text-[#a1a1aa] focus:outline-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="shrink-0 text-[13px] leading-none text-[#a1a1aa] transition-colors hover:text-[#3f3f46]"
        >
          ✕
        </button>
      )}
    </div>
  );
}
