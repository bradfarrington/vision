"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Remembers a list screen's URL state (sort, filters, search, page) for the
// session, so leaving and returning lands you exactly where you left off rather
// than resetting to defaults. Scoped to sessionStorage: it survives navigation
// and reloads within the tab, and clears when the tab closes — the right scope
// for "I was just here". Cross-device persistence would be a DB-backed pref.

const key = (path: string) => `viewstate:${path}`;

function saveViewState(path: string, query: string) {
  try {
    if (query) sessionStorage.setItem(key(path), query);
    else sessionStorage.removeItem(key(path)); // cleared filters → forget, so it reverts to default
  } catch {
    /* storage unavailable — degrade to no memory */
  }
}

export function loadViewState(path: string): string {
  try {
    return sessionStorage.getItem(key(path)) ?? "";
  } catch {
    return "";
  }
}

/** Mount on a list page: persists its current query whenever it changes. */
export function ViewStateSaver() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  useEffect(() => {
    saveViewState(pathname, query);
  }, [pathname, query]);
  return null;
}

/**
 * A Link that, on click, restores the saved view for its href — so a nav item or
 * breadcrumb returns to the remembered filters/sort instead of the bare route.
 * The rendered href stays bare (no hydration mismatch, middle-click still works);
 * the restore happens only on a normal click.
 */
export function RememberedLink({
  href,
  className,
  title,
  "aria-label": ariaLabel,
  "aria-current": ariaCurrent,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  "aria-label"?: string;
  "aria-current"?: React.AriaAttributes["aria-current"];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const onClick = (e: React.MouseEvent) => {
    // Let modified clicks (new tab/window) and non-primary buttons behave natively.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    const saved = loadViewState(href);
    if (saved) {
      e.preventDefault();
      router.push(`${href}?${saved}`);
    }
  };
  return (
    <Link
      href={href}
      onClick={onClick}
      className={className}
      title={title}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
    >
      {children}
    </Link>
  );
}
