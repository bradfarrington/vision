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
  variant = "icon",
}: {
  views?: ViewOption[];
  param?: string;
  /**
   * `icon` — two glyphs, for a LIST's list⇄board switch: the pair reads as one
   * compact control next to the toolbar's other buttons.
   * `label` — the words, for the DIARY's Day/Week/Month (design screen 07). A
   * period isn't a shape, so there's no glyph that says "Week" the way rows-vs-
   * columns says "board"; and it sits by the page title rather than in the
   * button cluster, where it has the room.
   */
  variant?: "icon" | "label";
}) {
  const { setParams, searchParams } = useSetParams();
  // The first option is the default, so it stays out of the URL entirely.
  const current = searchParams.get(param) ?? views[0].value;
  const labelled = variant === "label";

  return (
    <div
      className={cn(
        TOOLBAR_H,
        "inline-flex items-center rounded-lg p-0.5",
        labelled ? "bg-[#f4f4f5]" : "border border-[#e7e7ea] bg-[#fafafa]",
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
            // The label stays as the accessible name and the tooltip even when
            // it's on screen, so the icon variant loses nothing.
            title={v.label}
            aria-label={v.label}
            className={cn(
              "inline-flex h-full items-center justify-center rounded-md transition-colors",
              labelled ? "px-2.5 text-[12.5px]" : "px-2.5",
              active
                ? labelled
                  ? "bg-white font-semibold text-[#0a0a0a] shadow-[0_1px_2px_rgba(10,10,10,0.08)]"
                  : "bg-white text-[var(--accent-blue)] shadow-[0_1px_2px_rgba(10,10,10,0.08)]"
                : labelled
                  ? "font-medium text-[#71717a] hover:text-[#3f3f46]"
                  : "text-[#a1a1aa] hover:text-[#3f3f46]",
            )}
          >
            {labelled ? v.label : <Icon name={v.icon} size={16} strokeWidth={2.2} />}
          </button>
        );
      })}
    </div>
  );
}
