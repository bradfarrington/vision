"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Icon } from "./icon";

// Shared URL-param helpers for list screens. Search/filters/sort all live in
// the query string so the server component can read them and re-query — real,
// shareable, back-button-friendly state (no client data fetching).
//
// The columns/filters popovers themselves live in `data-list.tsx`; this file
// is just the URL plumbing and the search box shared by every list.

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
export function SearchBox({
  placeholder,
  width = 320,
}: {
  placeholder: string;
  width?: number;
}) {
  const { setParams, searchParams } = useSetParams();
  const [value, setValue] = useState(searchParams.get("search") ?? "");
  const first = useRef(true);

  // Debounce so we don't push a route on every keystroke.
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

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[13px] focus-within:border-[var(--accent-blue)] focus-within:ring-2 focus-within:ring-[var(--accent-tint)]"
      style={{ width }}
    >
      <Icon name="search" size={13} className="text-[#a1a1aa]" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[#3f3f46] placeholder:text-[#a1a1aa] focus:outline-none"
      />
    </div>
  );
}
