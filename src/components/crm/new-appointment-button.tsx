"use client";

import { useState } from "react";

import { BookingDialog, type BookingSeed } from "./booking-dialog";
import { Icon } from "./icon";
import { TOOLBAR_H, btnPrimary } from "./primitives";
import { DAY_START_HOUR } from "@/lib/diary";
import type { DiaryStaff } from "@/lib/data/staff";
import type { TenantOption } from "@/lib/data/customer-record";
import { cn } from "@/lib/utils";

// "+ New appointment" — the diary's primary action (design screen 07).
//
// Booking from a SLOT is still the main path: clicking a cell already knows the
// when and, on the day and week grids, the who. This is the door for a booking
// that isn't on screen yet — the call that comes in while you're looking at
// next week, or a job for a date you'd have to navigate to first.
//
// It opens the SAME shared BookingDialog as every other route in (a diary slot,
// a lead, the contract's Fitting tab), so there is one booking form in the CRM.
// See AGENTS.md § Booking — one dialog.

export function NewAppointmentButton({
  staff,
  types,
  /** The day currently on screen, `yyyy-mm-dd` — where the booking starts. */
  anchor,
}: {
  staff: DiaryStaff[];
  types: TenantOption[];
  anchor: string;
}) {
  const [seed, setSeed] = useState<BookingSeed | null>(null);

  const open = () => {
    // Seeded on the day you're LOOKING at, not today: navigating to a week and
    // then booking means you meant that week. The dialog's own date and time
    // pickers move it from there.
    const [y, m, d] = anchor.split("-").map(Number);
    const start = new Date(y, (m || 1) - 1, d || 1);
    start.setHours(DAY_START_HOUR, 0, 0, 0);
    setSeed({ startsAt: start, staffIds: [] });
  };

  return (
    <>
      <button type="button" onClick={open} className={cn(TOOLBAR_H, btnPrimary)}>
        <Icon name="plus" size={13} strokeWidth={2.2} /> New appointment
      </button>
      <BookingDialog
        open={!!seed}
        onOpenChange={(o) => !o && setSeed(null)}
        seed={seed}
        staff={staff}
        types={types}
      />
    </>
  );
}
