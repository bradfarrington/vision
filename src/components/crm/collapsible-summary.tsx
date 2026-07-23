"use client";

import { createContext, useContext, useState } from "react";

import { saveUserPref } from "@/app/(app)/preferences/actions";
import { Icon } from "./icon";
import { TOOLBAR_H } from "./primitives";
import { cn } from "@/lib/utils";

/**
 * Show/hide for a list's summary tiles.
 *
 * Split into a TOOLBAR button and a PANEL rather than one component that owns a
 * whole row: when the tiles are hidden the panel renders nothing at all, so the
 * row collapses completely. The first cut kept the control on its own row, which
 * meant hiding the tiles just swapped them for an empty band holding one
 * chevron — the exact waste the hiding was meant to reclaim.
 *
 * Hidden state is a per-user preference in `user_ui_layouts`, like the column
 * layout: someone who works the list all day shouldn't re-hide them every visit,
 * and one person's choice must not become everyone's.
 *
 * The tiles stay SERVER-rendered and are passed as children, so hiding costs no
 * round trip and showing needs no refetch.
 */

type Ctx = { hidden: boolean; toggle: () => void };
const SummaryContext = createContext<Ctx | null>(null);

export function SummaryProvider({
  layoutKey,
  initialHidden,
  children,
}: {
  layoutKey: string;
  initialHidden: boolean;
  children: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(initialHidden);
  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    void saveUserPref(layoutKey, { hidden: next });
  };
  return <SummaryContext.Provider value={{ hidden, toggle }}>{children}</SummaryContext.Provider>;
}

function useSummary(): Ctx {
  const ctx = useContext(SummaryContext);
  if (!ctx) throw new Error("useSummary must be used inside a SummaryProvider");
  return ctx;
}

/** The toolbar control. Chevron up = collapse these, down = bring them back. */
export function SummaryToggle() {
  const { hidden, toggle } = useSummary();
  return (
    <button
      type="button"
      onClick={toggle}
      title={hidden ? "Show summary" : "Hide summary"}
      aria-label={hidden ? "Show summary" : "Hide summary"}
      aria-expanded={!hidden}
      className={cn(
        TOOLBAR_H,
        "inline-flex w-[38px] items-center justify-center rounded-lg border border-[#e7e7ea] bg-white text-[#a1a1aa] transition-colors hover:bg-[#fafafa] hover:text-[#3f3f46]",
      )}
    >
      <Icon
        name="chevron-down"
        size={15}
        strokeWidth={2.4}
        className={cn("transition-transform", !hidden && "rotate-180")}
      />
    </button>
  );
}

/**
 * The tiles themselves — nothing at all when hidden, so no row is left behind.
 * Renders its children bare: the summary owns its own layout, and wrapping it
 * again here would just nest two identical flex rows.
 */
export function SummaryPanel({ children }: { children: React.ReactNode }) {
  const { hidden } = useSummary();
  if (hidden) return null;
  return <>{children}</>;
}
