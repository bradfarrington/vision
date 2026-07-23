"use client";

import { useSetParams } from "./list-controls";
import { TOOLBAR_H } from "./primitives";
import { Icon } from "./icon";
import type { IconName } from "./icon";
import { cn } from "@/lib/utils";

// List ⇄ Board switch for a list screen's toolbar. URL-param driven (`view`)
// like every other list control, so the choice is shareable, back-button
// friendly and rides in the saved session view state for free.
//
// Generic on purpose: contracts get the same board, so it takes its options
// rather than hardcoding Leads'.

export type ViewOption = { value: string; label: string; icon: IconName };

export const LIST_BOARD_VIEWS: ViewOption[] = [
  { value: "list", label: "List", icon: "list" },
  { value: "board", label: "Board", icon: "board" },
];

export function ViewToggle({
  views = LIST_BOARD_VIEWS,
  param = "view",
}: {
  views?: ViewOption[];
  param?: string;
}) {
  const { setParams, searchParams } = useSetParams();
  // The first option is the default, so it stays out of the URL entirely.
  const current = searchParams.get(param) ?? views[0].value;

  return (
    <div
      className={cn(
        TOOLBAR_H,
        "inline-flex items-center rounded-lg border border-[#e7e7ea] bg-[#fafafa] p-0.5",
      )}
      role="group"
      aria-label="View"
    >
      {views.map((v) => {
        const active = current === v.value;
        return (
          <button
            key={v.value}
            type="button"
            aria-pressed={active}
            onClick={() =>
              // Switching view resets nothing else — the filters, search and
              // date range carry across, so you see the SAME set both ways.
              setParams({ [param]: v.value === views[0].value ? null : v.value })
            }
            // Icon only — the two glyphs (rows vs columns) say what the views
            // are more directly than the words do, and the pair reads as one
            // compact control rather than a second set of buttons. The label
            // stays as the accessible name and the tooltip.
            title={v.label}
            aria-label={v.label}
            className={cn(
              "inline-flex h-full items-center justify-center rounded-md px-2.5 transition-colors",
              active
                ? "bg-white text-[var(--accent-blue)] shadow-[0_1px_2px_rgba(10,10,10,0.08)]"
                : "text-[#a1a1aa] hover:text-[#3f3f46]",
            )}
          >
            <Icon name={v.icon} size={16} strokeWidth={2.2} />
          </button>
        );
      })}
    </div>
  );
}
