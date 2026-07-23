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

// Section memory — remembers the LAST location within a top-level section (a
// sidebar destination like /leads or /customers), so clicking that sidebar item
// resumes exactly where you were, an open record included, rather than always
// dumping you back on the list. This is a level up from viewstate above:
// viewstate remembers a LIST's filters; section memory remembers WHICH page in
// the section you had open (a record, or the list). The sidebar reads section
// memory first, then falls back to viewstate for the list's filters.

const sectionKey = (base: string) => `section:${base}`;

/** Longest sidebar base that prefixes `pathname` (its section), or null. */
function sectionForPath(pathname: string, sections: string[]): string | null {
  let match: string | null = null;
  for (const base of sections) {
    if (pathname === base || pathname.startsWith(`${base}/`)) {
      if (!match || base.length > match.length) match = base;
    }
  }
  return match;
}

function saveSectionPath(base: string, pathname: string) {
  try {
    sessionStorage.setItem(sectionKey(base), pathname);
  } catch {
    /* storage unavailable — degrade to no memory */
  }
}

export function loadSectionPath(base: string): string {
  try {
    return sessionStorage.getItem(sectionKey(base)) ?? "";
  } catch {
    return "";
  }
}

/**
 * Mount once in the app shell: records the current pathname under its section
 * whenever you navigate, so the sidebar can resume it. Only the pathname is
 * stored (a record needs no query; a list's filters already live in viewstate),
 * which keeps this off useSearchParams and out of dynamic-rendering territory.
 * Create wizards (`…/new`) are skipped — resuming an emptied form is jarring,
 * not "where I was".
 */
export function SectionMemorySaver({ sections }: { sections: string[] }) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.endsWith("/new")) return;
    const base = sectionForPath(pathname, sections);
    if (base) saveSectionPath(base, pathname);
  }, [pathname, sections]);
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
