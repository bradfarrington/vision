"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { cancelBooking, completeBooking } from "@/app/(app)/diary/actions";
import { WORK_CATEGORIES, durationLabel, workCategory } from "@/lib/appointments";
import { BookAppointmentButton } from "./book-appointment-button";
import { Card, CardTitle, Pill } from "./primitives";
import { useDialogs } from "./dialogs";
import type { DiaryEvent } from "@/lib/data/appointments";
import type { DiaryStaff } from "@/lib/data/staff";
import type { TenantOption } from "@/lib/data/customer-record";
import { AppointmentComment } from "@/components/crm/appointment-comment";
import { cn } from "@/lib/utils";

// The contract's Fitting tab (design screen 05b): every appointment against
// this job — surveys, the fit itself, service visits — with who's going, how
// long, and whether it's confirmed.
//
// Reads the SAME appointments table the diary does, so anything booked here
// shows on the diary immediately and vice versa. That's the whole point of the
// merge (AGENTS.md § One appointment table).

export function FittingPanel({
  appointments,
  staff,
  types,
  contractId,
  customerId,
  contractRef,
  customerName,
  siteDirections,
}: {
  appointments: DiaryEvent[];
  staff: DiaryStaff[];
  types: TenantOption[];
  contractId: string;
  customerId: string | null;
  contractRef: string;
  customerName: string | null;
  siteDirections: string | null;
}) {
  const upcoming = appointments.filter((a) => a.status !== "cancelled");

  return (
    <div className="flex max-w-[1320px] flex-col gap-4">
      <Card className="!px-0 !py-0">
        <div className="flex items-center justify-between gap-2 border-b border-[#f4f4f5] px-[18px] py-3.5">
          <CardTitle className="text-[15px]">Appointments</CardTitle>
          <BookAppointmentButton
            staff={staff}
            types={types}
            contractId={contractId}
            customerId={customerId}
            context={`${contractRef}${customerName ? ` · ${customerName}` : ""}`}
            label="Add appointment"
            variant="link"
          />
        </div>

        {upcoming.length === 0 ? (
          <p className="px-[18px] py-6 text-center text-[12.5px] text-[#71717a]">
            Nothing booked against this contract yet.
          </p>
        ) : (
          <div className="px-[18px] py-1">
            <div className="grid grid-cols-[92px_1fr_128px_92px_1fr_104px_84px] gap-2 border-b border-[#e7e7ea] py-2 text-[11px] font-bold uppercase tracking-[0.05em] text-[#a1a1aa]">
              <span>Date</span>
              <span>Appointment</span>
              <span>Time</span>
              <span>Duration</span>
              <span>Staff</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            {upcoming.map((a) => (
              <Row key={a.id} appt={a} />
            ))}
          </div>
        )}
      </Card>

      {/* Access & directions — what the person going actually needs. It lives
          on the contract's site address (fitting_directions), so it's the same
          note the lead carried through conversion. */}
      <Card>
        <CardTitle className="mb-1.5 text-[14px]">Access &amp; directions</CardTitle>
        {siteDirections ? (
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#3f3f46]">
            {siteDirections}
          </p>
        ) : (
          <p className="text-[12.5px] text-[#a1a1aa]">
            No access notes on this contract. Add them on the Overview tab so whoever goes knows
            where to park and how to get in.
          </p>
        )}
      </Card>
    </div>
  );
}

function Row({ appt }: { appt: DiaryEvent }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm } = useDialogs();

  const when = new Date(appt.startsAt);
  const cat = workCategory(appt.type, appt.workType);
  const done = appt.status === "done";

  function markDone() {
    start(async () => {
      await completeBooking(appt.id);
      router.refresh();
    });
  }

  async function cancel() {
    const ok = await confirm({
      title: "Cancel this appointment?",
      message:
        "It leaves the diary and the person booked is freed up. The appointment is kept on the contract as history, not deleted.",
      confirmLabel: "Cancel appointment",
      tone: "danger",
    });
    if (!ok) return;
    start(async () => {
      await cancelBooking(appt.id);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[92px_1fr_128px_92px_1fr_104px_84px] items-center gap-2 border-b border-[#f4f4f5] py-2.5 text-[12px] last:border-b-0",
        pending && "opacity-60",
      )}
    >
      <span>
        <span className="block font-semibold text-[#0a0a0a]">
          {when.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
        <span className="block text-[10.5px] text-[#a1a1aa]">
          {when.toLocaleDateString("en-GB", { weekday: "short" })}
        </span>
      </span>

      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full" style={{ background: cat.fg }} />
          <span className="truncate font-semibold text-[#0a0a0a]">{appt.title}</span>
        </span>
        {/* The comment is EDITABLE here: it's what the person going needs to
            read, and it was previously only settable by reopening the booking. */}
        <AppointmentComment
          id={appt.id}
          value={appt.notes}
          className="mt-0.5 text-[10.5px]"
        />
      </span>

      <span className="tabular-nums text-[#3f3f46]">
        {when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </span>

      <span className="text-[#3f3f46]">{durationLabel(appt.duration)}</span>

      <span className="min-w-0 truncate text-[#3f3f46]">
        {appt.staffNames.length ? appt.staffNames.join(" + ") : (appt.assignedTo ?? "—")}
      </span>

      <span>
        <Pill tone={done ? "success" : appt.provisional ? "amber" : "neutral"}>
          {done ? "Done" : appt.provisional ? "Provisional" : "Confirmed"}
        </Pill>
      </span>

      <span className="flex items-center justify-end gap-2">
        {!done && (
          <button
            type="button"
            onClick={markDone}
            disabled={pending}
            className="text-[11.5px] font-semibold text-[var(--accent-blue)]"
          >
            Mark done
          </button>
        )}
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="text-[11.5px] font-medium text-[#a1a1aa] hover:text-[#d64545]"
        >
          Cancel
        </button>
      </span>
    </div>
  );
}

export { WORK_CATEGORIES };
