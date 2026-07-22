"use client";

import { createContext, useContext, useMemo, useState } from "react";

const SEP = "\u001F"; // unit separator — never appears in a tab label

// Lightweight tab strip for detail screens. Panels are server-rendered and
// passed in as content; this only toggles which one is visible. Underline +
// active weight match the lead-detail tab bar.
export type TabDef = {
  label: string;
  count?: number;
  content: React.ReactNode;
};

// Summary cards on the Overview tab link through to the tab that owns the data
// ("View all →"). Panels are server components rendered as `content`, so they
// can't reach the `active` state directly — this context hands them a
// `goTo("Notes")` for the small client button that does the switch.
type TabNav = { goTo: (label: string) => void };
const TabNavContext = createContext<TabNav | null>(null);

/** Switch the surrounding <Tabs> by label. Throws outside a Tabs — a mounting bug. */
export function useTabNav(): TabNav {
  const ctx = useContext(TabNavContext);
  if (!ctx) throw new Error("useTabNav must be used inside <Tabs>");
  return ctx;
}

export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(0);
  // The label list is flattened to a string so the context value only changes
  // when the tab set really does — a tab label may contain spaces or "&", so the
  // separator is a unit-separator control char that can't appear in one.
  const labelKey = tabs.map((t) => t.label).join(SEP);
  const nav = useMemo<TabNav>(
    () => ({
      goTo: (label: string) => {
        const i = labelKey.split(SEP).indexOf(label);
        if (i >= 0) setActive(i);
      },
    }),
    [labelKey],
  );
  return (
    <TabNavContext.Provider value={nav}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-end gap-0.5 overflow-x-auto border-b border-[#e7e7ea]">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setActive(i)}
              className={`relative whitespace-nowrap px-3.5 pb-[11px] pt-[9px] text-[13px] ${
                i === active ? "font-bold text-[#0a0a0a]" : "font-medium text-[#71717a] hover:text-[#3f3f46]"
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1 text-[11px] text-[#a1a1aa]">{t.count}</span>
              )}
              {i === active && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-sm bg-[var(--accent-blue)]" />
              )}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pt-4">{tabs[active]?.content}</div>
      </div>
    </TabNavContext.Provider>
  );
}

/**
 * The "View all →" affordance on an Overview summary card. Client-side by
 * necessity (it flips tab state); everything around it stays a server component.
 */
export function TabLink({
  to,
  children,
  className = "",
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { goTo } = useTabNav();
  return (
    <button
      type="button"
      onClick={() => goTo(to)}
      className={`text-[11.5px] font-semibold text-[var(--accent-blue)] hover:underline ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * A whole row/region that acts as a jump to another tab — used where the summary
 * item itself should be clickable (a note snippet, a document row).
 */
export function TabJump({
  to,
  children,
  className = "",
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { goTo } = useTabNav();
  return (
    <button type="button" onClick={() => goTo(to)} className={className}>
      {children}
    </button>
  );
}
