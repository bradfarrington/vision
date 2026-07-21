"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { pillActive, pillDefault } from "./primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Shared URL-param helpers for list screens. Filtering/pagination all live in
// the query string so the server component can read them and re-query — real,
// shareable, back-button-friendly state (no client data fetching).

function useSetParams() {
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

// ---------------------------------------------------------------------------
export function FilterDropdown({
  param,
  label,
  options,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  const { setParams, searchParams } = useSetParams();
  const current = searchParams.get(param);
  const active = options.find((o) => o.value === current);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={active ? pillActive : pillDefault}>
        {label}
        {active ? `: ${active.label}` : ": All"}
        <Icon name="chevron-down" size={11} className="text-[#71717a]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        <DropdownMenuItem onClick={() => setParams({ [param]: null })}>
          All
        </DropdownMenuItem>
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => setParams({ [param]: o.value })}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
export function TogglePill({ param, label }: { param: string; label: string }) {
  const { setParams, searchParams } = useSetParams();
  const on = searchParams.get(param) === "1";
  return (
    <button
      type="button"
      className={on ? pillActive : pillDefault}
      onClick={() => setParams({ [param]: on ? null : "1" })}
    >
      {label}
      {on && <span aria-hidden>✕</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
export function Pagination({
  page,
  pageCount,
}: {
  page: number;
  pageCount: number;
}) {
  const { setParams } = useSetParams();
  const go = (p: number) =>
    setParams({ page: p <= 1 ? null : String(p) }, { resetPage: false });

  const pages = pageWindow(page, pageCount);

  return (
    <div className="ml-auto flex items-center gap-1.5">
      <PageButton disabled={page <= 1} onClick={() => go(page - 1)}>
        ‹
      </PageButton>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-[#a1a1aa]">
            …
          </span>
        ) : (
          <PageButton key={p} active={p === page} onClick={() => go(p)}>
            {p}
          </PageButton>
        ),
      )}
      <PageButton disabled={page >= pageCount} onClick={() => go(page + 1)}>
        ›
      </PageButton>
    </div>
  );
}

function PageButton({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-[7px] text-[12.5px]",
        active
          ? "bg-[#18181b] font-semibold text-white"
          : "border border-[#e7e7ea] bg-white text-[#3f3f46] hover:bg-[#fafafa]",
        disabled && "cursor-not-allowed text-[#a1a1aa] hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}

// [1] 2 3 … 143 — condensed page window around the current page.
function pageWindow(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7)
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pageCount - 1) out.push("…");
  out.push(pageCount);
  return out;
}
