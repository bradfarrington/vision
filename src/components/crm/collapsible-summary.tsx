"use client";

import { useState } from "react";

import { saveUserPref } from "@/app/(app)/preferences/actions";
import { Icon } from "./icon";
import { TOOLBAR_H } from "./primitives";
import { cn } from "@/lib/utils";

/**
 * The summary row above a list: stat tiles on the left, the view toggle (and
 * anything else passed as children) on the right, with a control to HIDE the
 * tiles.
 *
 * Hidden state is a per-user preference in `user_ui_layouts`, like the column
 * layout — someone who works the list all day and doesn't want the tiles
 * shouldn't have to re-hide them every visit, and one person's choice must not
 * become everyone's (see AGENTS.md § Rearrangeable cards).
 *
 * The tiles stay SERVER-rendered and are handed in as a prop; this component
 * only decides whether to show them, so hiding costs no round trip and showing
 * needs no refetch.
 */
export function CollapsibleSummary({
  layoutKey,
  initialHidden,
  summary,
  children,
}: {
  layoutKey: string;
  initialHidden: boolean;
  summary: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(initialHidden);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    void saveUserPref(layoutKey, { hidden: next });
  }

  return (
    <div className="flex items-end justify-between gap-3">
      {hidden ? <span /> : summary}
      <div className="flex shrink-0 items-center gap-2.5">
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
          {/* One chevron, rotated — pointing up means "collapse these away",
              down means "bring them back". */}
          <Icon
            name="chevron-down"
            size={15}
            strokeWidth={2.4}
            className={cn("transition-transform", !hidden && "rotate-180")}
          />
        </button>
        {children}
      </div>
    </div>
  );
}
