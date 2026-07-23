"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { loadViewState } from "@/components/crm/view-state";
import { BOTTOM_NAV, MAIN_NAV, type NavItem } from "./nav";

// 76px icon rail transcribed from VisionSidebar.dc.html: 44px circular items,
// fixed order, accent-filled active state (bg = tenant accent, white icon,
// soft shadow). Idle items: white fill, #566173 icon, #e2e7ee hairline.
export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="flex w-[76px] flex-none flex-col items-center pt-[10px] pb-[18px]">
      <nav className="flex flex-col items-center gap-2">
        {MAIN_NAV.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-2">
        {BOTTOM_NAV.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>
    </aside>
  );
}

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const router = useRouter();
  // Restore a list screen's remembered view (filters/sort) instead of the bare
  // route. Only fires when there is saved state for this destination; a plain
  // click on any other nav item behaves normally.
  const onClick = (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    const saved = loadViewState(item.href);
    if (saved) {
      e.preventDefault();
      router.push(`${item.href}?${saved}`);
    }
  };
  return (
    <Link
      href={item.href}
      onClick={onClick}
      // NO PREFETCH. The rail is on screen on every page, and every destination
      // behind it is a DYNAMIC route (they all read searchParams). Next's client
      // router cache keeps dynamic payloads for 0s by default, so a prefetch is
      // never fresh and the rail re-requests every route it can see — which is
      // why the dev terminal fills with `GET /leads?_rsc=…` while you sit on
      // another screen. These are deliberate clicks, not hovers over a row, so
      // fetching on click is the right trade.
      prefetch={false}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex size-11 items-center justify-center rounded-full border transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--accent-blue)]/40",
        active
          ? "border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white shadow-[0_4px_12px_rgba(16,20,24,0.12)]"
          : "border-[#e2e7ee] bg-white text-[#566173] shadow-[0_1px_2px_rgba(16,20,24,0.06)] hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]",
      )}
    >
      <RailIcon paths={item.paths} />
    </Link>
  );
}

function RailIcon({ paths }: { paths: string[] }) {
  return (
    <svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
