"use client";

import { useRouter } from "next/navigation";

import { DatePicker } from "./date-picker";
import { Icon } from "./icon";
import { TOOLBAR_H, btnSecondary } from "./primitives";
import { useSetParams } from "./list-controls";
import { cn } from "@/lib/utils";

// Diary period navigation: ‹ · the window's label · › · Today.
//
// The LABEL IS THE DATE PICKER. Stepping a week at a time is fine for "next
// week" and useless for "the week of the 14th of March" — that's twenty clicks.
// Making the label itself open the calendar means the jump costs nothing extra
// on the toolbar, and it's where you'd point at the date anyway.
//
// Reuses the shared `DatePicker` (day → month → year drill-down), so a jump a
// year out is three clicks and the diary can't drift from the pickers used on
// every record.

export function DiaryNav({
  label,
  anchor,
  prev,
  next,
  today,
}: {
  /** The window's heading — "Tue 21 Jul 2026", "Mon 20 – Sun 26 Jul 2026". */
  label: string;
  /** The anchor date as `yyyy-mm-dd`, so the calendar opens on it. */
  anchor: string;
  /** Hrefs for the steppers, computed server-side so they carry the filters. */
  prev: string;
  next: string;
  today: string;
}) {
  const router = useRouter();
  const { setParams } = useSetParams();

  return (
    <div className={cn(TOOLBAR_H, "inline-flex items-center gap-1")}>
      <button
        type="button"
        onClick={() => router.push(prev)}
        className={cn(btnSecondary, "!px-2")}
        aria-label="Previous"
      >
        <Icon name="chevron-left" size={14} strokeWidth={2} />
      </button>

      {/* The window label IS the picker's trigger. */}
      <span className="inline-flex min-w-[200px] justify-center">
        <DatePicker
          value={anchor}
          variant="button"
          triggerLabel={label}
          onChange={(d) => {
            // Only the anchor date changes — the view and filters stay put, so
            // jumping to March keeps you in Week view with the same staff
            // selected.
            if (d) setParams({ d });
          }}
        />
      </span>

      <button
        type="button"
        onClick={() => router.push(next)}
        className={cn(btnSecondary, "!px-2")}
        aria-label="Next"
      >
        <Icon name="chevron-right" size={14} strokeWidth={2} />
      </button>

      <button type="button" onClick={() => router.push(today)} className={cn(btnSecondary, "ml-1")}>
        Today
      </button>
    </div>
  );
}
