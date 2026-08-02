"use client";

import { useState } from "react";

import { BookingDialog, type BookingSeed } from "./booking-dialog";
import { Icon } from "./icon";
import { btnSecondary } from "./primitives";
import type { DiaryStaff } from "@/lib/data/staff";
import type { TenantOption } from "@/lib/data/customer-record";
import { cn } from "@/lib/utils";

// "Book appointment" on a lead, and "Add appointment" on a contract's Fitting
// tab. Both open the SAME dialog the diary uses — pre-filled with whichever
// record you're standing on — so there is one booking form in the CRM rather
// than three that drift.

export function BookAppointmentButton({
  staff,
  types,
  leadId,
  contractId,
  customerId,
  context,
  label = "Book appointment",
  variant = "secondary",
}: {
  staff: DiaryStaff[];
  types: TenantOption[];
  leadId?: string | null;
  contractId?: string | null;
  customerId?: string | null;
  /** Shown under the dialog title — "Lead L-2431 · Margaret Ellison". */
  context?: string | null;
  label?: string;
  variant?: "secondary" | "link";
}) {
  const [open, setOpen] = useState(false);

  // Default to the next half hour rather than "now": nobody books a job for
  // 14:07, and the grid can only render slot boundaries anyway.
  const seed: BookingSeed = {
    startsAt: nextSlot(),
    duration: 60,
    staffIds: [],
    leadId: leadId ?? null,
    contractId: contractId ?? null,
    customerId: customerId ?? null,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "link"
            ? "flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--accent-blue)]"
            : cn(btnSecondary)
        }
      >
        <Icon name={variant === "link" ? "plus" : "calendar"} size={13} strokeWidth={1.75} />
        {label}
      </button>

      <BookingDialog
        open={open}
        onOpenChange={setOpen}
        seed={open ? seed : null}
        staff={staff}
        types={types}
        context={context}
      />
    </>
  );
}

/** The next half-hour boundary from now. */
function nextSlot(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + (30 - (d.getMinutes() % 30)));
  return d;
}
