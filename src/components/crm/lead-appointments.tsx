"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  cancelBooking,
  completeBooking,
  updateAppointmentField,
} from "@/app/(app)/diary/actions";
import { durationLabel, workCategory } from "@/lib/appointments";
import { AppointmentComment } from "./appointment-comment";
import { Combo } from "./combo";
import { DatePicker } from "./date-picker";
import { TimePicker } from "./time-picker";
import { useDialogs } from "./dialogs";
import type { LeadAppointment } from "@/lib/data/leads";
import type { DiaryStaff } from "@/lib/data/staff";
import type { TenantOption } from "@/lib/data/customer-record";
import { cn } from "@/lib/utils";

// The lead record's Appointments card — the same edit-in-place treatment as the
// contract's Fitting tab, in a third of the width.
//
// STACKED, NOT A TABLE. This card lives in a ~340px bento column, so the
// Fitting tab's eight columns would each be a word wide. The fields are the
// same and so are the controls; only the arrangement differs — type and status
// on the first line, when and how long on the second, who on the third, the
// comment last.

const DURATIONS = [30, 60, 90, 120, 180, 240, 480, 720, 960, 1440];

export function LeadAppointments({
  appointments,
  staff,
  types,
}: {
  appointments: LeadAppointment[];
  staff: DiaryStaff[];
  types: TenantOption[];
}) {
  const live = appointments.filter((a) => a.status !== "cancelled");

  if (live.length === 0) {
    return (
      <p className="text-[12.5px] text-[#a1a1aa]">
        None booked yet. Use &ldquo;Add&rdquo; above to book one.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-[#f4f4f5]">
      {live.map((a) => (
        <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
          <Row appt={a} staff={staff} types={types} />
        </li>
      ))}
    </ul>
  );
}

function Row({
  appt,
  staff,
  types,
}: {
  appt: LeadAppointment;
  staff: DiaryStaff[];
  types: TenantOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm } = useDialogs();

  const when = appt.startsAt ? new Date(appt.startsAt) : null;
  const cat = workCategory(appt.type, null);
  const done = appt.status === "done";
  const provisional = appt.status === "provisional";

  const patch = (fields: Record<string, unknown>) =>
    start(async () => {
      await updateAppointmentField(appt.id, fields);
      router.refresh();
    });

  const setDate = (value: string | null) => {
    if (!value) return;
    const [y, m, d] = value.split("-").map(Number);
    // A booking with no instant yet lands at the start of the working day
    // rather than midnight, which is nobody's appointment.
    const next = when ? new Date(when) : new Date(y, (m || 1) - 1, d || 1, 8, 0, 0, 0);
    next.setFullYear(y, (m || 1) - 1, d || 1);
    patch({ starts_at: next.toISOString() });
  };

  const setTime = (value: string | null) => {
    if (!value || !when) return;
    const [h, min] = value.split(":").map(Number);
    const next = new Date(when);
    next.setHours(h || 0, min || 0, 0, 0);
    patch({ starts_at: next.toISOString() });
  };

  function setStatus(value: string) {
    if (!value || value === appt.status) return;
    start(async () => {
      // "Done" goes through completeBooking so the completion stamp is written.
      if (value === "done") await completeBooking(appt.id);
      else await updateAppointmentField(appt.id, { status: value });
      router.refresh();
    });
  }

  function toggleStaff(id: string) {
    const next = appt.staffIds.includes(id)
      ? appt.staffIds.filter((s) => s !== id)
      : [...appt.staffIds, id];
    patch({
      staff_ids: next,
      staff_names: staff.filter((s) => next.includes(s.id)).map((s) => s.name),
    });
  }

  async function cancel() {
    const ok = await confirm({
      title: "Cancel this appointment?",
      message:
        "It leaves the diary and the person booked is freed up. The appointment stays on the lead as history, not deleted.",
      confirmLabel: "Cancel appointment",
      tone: "danger",
    });
    if (!ok) return;
    start(async () => {
      await cancelBooking(appt.id);
      router.refresh();
    });
  }

  const staffShown = appt.staffNames.length
    ? appt.staffNames.join(" + ")
    : (appt.assignedTo ?? null);

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", pending && "opacity-60")}>
      {/* What it is · what state it's in */}
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-full" style={{ background: cat.fg }} />
        <Combo
          options={types.map((t) => ({ id: t.id, value: t.label, label: t.label }))}
          value={appt.type ?? appt.title}
          onChange={(v) => patch({ type: v || null, title: v || appt.title })}
          variant="text"
          align="start"
          placeholder="Set a type…"
          className="min-w-0 flex-1 [&>button]:w-full [&>button]:truncate [&>button]:text-left [&>button]:text-[13px] [&>button]:font-semibold [&>button]:text-[#0a0a0a]"
        />
        <Combo
          options={[
            { value: "provisional", label: "Provisional" },
            { value: "confirmed", label: "Confirmed" },
            { value: "done", label: "Done" },
          ]}
          value={done ? "done" : provisional ? "provisional" : "confirmed"}
          onChange={setStatus}
          variant="text"
          align="end"
          clearable={false}
          className={cn(
            "shrink-0 [&>button]:rounded-full [&>button]:px-2 [&>button]:py-[2px] [&>button]:text-[10.5px] [&>button]:font-semibold",
            done
              ? "[&>button]:bg-[#e7f4ec] [&>button]:text-[#1a7f3e]"
              : provisional
                ? "[&>button]:bg-[#fdf2dc] [&>button]:text-[#b86e00]"
                : "[&>button]:bg-[#f4f4f5] [&>button]:text-[#3f3f46]",
          )}
        />
      </div>

      {/* When · how long */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] text-[#71717a]">
        <DatePicker
          value={when ? toDateValue(when) : null}
          onChange={setDate}
          variant="button"
          triggerLabel={
            when
              ? when.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })
              : "No date set"
          }
          triggerClassName="!px-1 !py-0 text-[12px] font-medium text-[#3f3f46]"
        />
        {when && (
          <>
            <span className="text-[#d4d4d8]">·</span>
            <TimePicker
              value={toTimeValue(when)}
              onChange={setTime}
              variant="text"
              className="[&>button]:text-[12px] [&>button]:text-[#3f3f46]"
            />
          </>
        )}
        <span className="text-[#d4d4d8]">·</span>
        <Combo
          options={DURATIONS.map((m) => ({ value: String(m), label: durationLabel(m) }))}
          value={String(appt.duration ?? 60)}
          onChange={(v) => v && patch({ duration: Number(v) })}
          variant="text"
          align="start"
          clearable={false}
          className="[&>button]:text-[12px] [&>button]:text-[#3f3f46]"
        />
      </div>

      {/* Who's going — multi-select, ticked, so the menu says who is already on it */}
      <Combo
        options={staff.map((s) => ({ id: s.id, value: s.id, label: s.name }))}
        value={null}
        selectedValues={appt.staffIds}
        onChange={(v) => v && toggleStaff(v)}
        variant="text"
        align="start"
        clearable={false}
        placeholder={staffShown ?? "Nobody assigned"}
        searchPlaceholder="Search staff…"
        className="[&>button]:w-full [&>button]:max-w-full [&>button]:text-left [&>button]:text-[12px] [&>button]:leading-tight [&>button]:break-words [&>button]:whitespace-normal [&>button]:text-[#3f3f46]"
      />

      <AppointmentComment id={appt.id} value={appt.notes} className="text-[12px]" />

      <div className="flex items-center gap-2.5">
        {!done && (
          <button
            type="button"
            onClick={() => setStatus("done")}
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
      </div>
    </div>
  );
}

function toDateValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
