"use client";

import { useRouter } from "next/navigation";

import { DatePicker } from "./date-picker";
import { Icon } from "./icon";
import { TOOLBAR_H } from "./primitives";
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
    <div className={cn(TOOLBAR_H, "inline-flex items-center gap-2")}>
      <button type="button" onClick={() => router.push(prev)} className={STEP} aria-label="Previous">
        <Icon name="chevron-left" size={15} strokeWidth={2} />
      </button>

      {/* The window label IS the picker's trigger, and it's the loudest thing
          in the cluster — the steppers and Today are quiet boxes around it. */}
      <span className="inline-flex min-w-[196px] justify-center">
        <DatePicker
          value={anchor}
          variant="button"
          triggerLabel={label}
          triggerClassName="text-[14.5px] font-bold"
          onChange={(d) => {
            // Only the anchor date changes — the view and filters stay put, so
            // jumping to March keeps you in Week view with the same staff
            // selected.
            if (d) setParams({ d });
          }}
        />
      </span>

      <button type="button" onClick={() => router.push(next)} className={STEP} aria-label="Next">
        <Icon name="chevron-right" size={15} strokeWidth={2} />
      </button>

      {/* A PILL, not a square — "Today" is a jump, not a step, so it shouldn't
          read as a third arrow. */}
      <button
        type="button"
        onClick={() => router.push(today)}
        className="inline-flex items-center rounded-full border border-[#e7e7ea] bg-white px-3 py-[5px] text-[12px] font-semibold text-[#3f3f46] transition-colors hover:bg-[#fafafa]"
      >
        Today
      </button>
    </div>
  );
}

/** The ‹ › steppers — 30px squares, per design screen 07. */
const STEP =
  "inline-flex size-[30px] shrink-0 items-center justify-center rounded-[7px] border border-[#e7e7ea] bg-white text-[#3f3f46] transition-colors hover:bg-[#fafafa]";
