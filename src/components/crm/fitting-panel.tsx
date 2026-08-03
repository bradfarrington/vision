"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  cancelBooking,
  completeBooking,
  updateAppointmentField,
} from "@/app/(app)/diary/actions";
import { WORK_CATEGORIES, durationLabel, workCategory } from "@/lib/appointments";
import { BookAppointmentButton } from "./book-appointment-button";
import { AppointmentComment } from "./appointment-comment";
import { Combo } from "./combo";
import { DatePicker } from "./date-picker";
import { EditableField } from "./editable-field";
import { updateContractField } from "@/app/(app)/contracts/actions";
import { TimePicker } from "./time-picker";
import { Card, CardTitle } from "./primitives";
import { useDialogs } from "./dialogs";
import type { DiaryEvent } from "@/lib/data/appointments";
import type { DiaryStaff } from "@/lib/data/staff";
import type { TenantOption } from "@/lib/data/customer-record";
import { cn } from "@/lib/utils";

// The contract's Fitting tab (design screen 05b): every appointment against
// this job — surveys, the fit itself, service visits — with who's going, how
// long, and whether it's confirmed.
//
// Reads the SAME appointments table the diary does, so anything booked here
// shows on the diary immediately and vice versa. That's the whole point of the
// merge (AGENTS.md § One appointment table).
//
// EVERY COLUMN EDITS IN PLACE. This is the screen the office works a job from,
// and re-opening a booking dialog to move a fit half an hour is the kind of
// friction that ends with the diary being wrong. Same rule, same controls, as
// the customer record's inline fields.

/** Slot multiples, matching the booking dialog — see AGENTS.md § Booking. */
const DURATIONS = [30, 60, 90, 120, 180, 240, 480, 720, 960, 1440];

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
    // Access sits BESIDE the appointments on a wide screen and under them on a
    // narrow one. The table is the wide thing here; the access note is a
    // paragraph, and a paragraph stretched over 1300px is unreadable while the
    // space beside it sits empty. `desktop:` is the app's own ≥1367px tier
    // (globals.css) — a 13" laptop at 1280 keeps the stacked layout.
    <div className="grid max-w-[1520px] grid-cols-1 items-start gap-4 desktop:grid-cols-[minmax(0,1fr)_330px]">
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
          <div className="overflow-x-auto px-[18px] py-1">
            <div className={cn(GRID, HEAD)}>
              <span>Date</span>
              <span>Time</span>
              <span>Duration</span>
              <span>Appointment</span>
              <span>Staff</span>
              <span>Status</span>
              <span>Comment</span>
              <span className="text-right">Actions</span>
            </div>
            {upcoming.map((a) => (
              <Row key={a.id} appt={a} staff={staff} types={types} />
            ))}
          </div>
        )}
      </Card>

      {/* Access & directions — what the person going actually needs. It's the
          contract's own `fitting_directions`, the note the lead carried through
          conversion, and it's EDITABLE here as well as on the Overview tab:
          this is the screen you're on when you find out about the gate code. */}
      <Card>
        <CardTitle className="mb-1.5 text-[14px]">Access &amp; directions</CardTitle>
        <EditableField
          id={contractId}
          field="fitting_directions"
          type="textarea"
          value={siteDirections}
          action={updateContractField}
          placeholder="Where to park, which gate, who to ask for…"
          className="w-full text-left text-[12.5px] leading-relaxed"
        />
      </Card>
    </div>
  );
}

// The long free-text column goes LAST and takes the slack. Everything before
// it is a fixed, predictable width, so the eye runs down a column of dates, a
// column of times, a column of names — and the one column that varies in
// length has nothing to its right to run into.
const GRID =
  "grid min-w-[1040px] grid-cols-[84px_76px_88px_150px_176px_112px_minmax(220px,1fr)_78px] gap-3";
const HEAD =
  "border-b border-[#e7e7ea] py-2 text-[11px] font-bold uppercase tracking-[0.05em] text-[#a1a1aa]";

function Row({
  appt,
  staff,
  types,
}: {
  appt: DiaryEvent;
  staff: DiaryStaff[];
  types: TenantOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm } = useDialogs();

  const when = new Date(appt.startsAt);
  const cat = workCategory(appt.type, appt.workType);
  const done = appt.status === "done";

  const patch = (fields: Record<string, unknown>) =>
    start(async () => {
      await updateAppointmentField(appt.id, fields);
      router.refresh();
    });

  /** Date and time are two editors over ONE column — each keeps the other's half. */
  const setDate = (value: string | null) => {
    if (!value) return;
    const [y, m, d] = value.split("-").map(Number);
    const next = new Date(when);
    next.setFullYear(y, (m || 1) - 1, d || 1);
    patch({ starts_at: next.toISOString() });
  };
  const setTime = (value: string | null) => {
    if (!value) return;
    const [h, min] = value.split(":").map(Number);
    const next = new Date(when);
    next.setHours(h || 0, min || 0, 0, 0);
    patch({ starts_at: next.toISOString() });
  };

  function setStatus(value: string) {
    if (!value || value === appt.status) return;
    // "Done" goes through completeBooking so the completion stamp is written
    // — the generic patch would set the status and lose the timestamp.
    start(async () => {
      if (value === "done") await completeBooking(appt.id);
      else await updateAppointmentField(appt.id, { status: value });
      router.refresh();
    });
  }

  /** Multi-select: a fit is two people. Clicking a name toggles them. */
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
        GRID,
        "items-start border-b border-[#f4f4f5] py-2.5 text-[12px] last:border-b-0",
        pending && "opacity-60",
      )}
    >
      <span className="min-w-0">
        <DatePicker
          value={toDateValue(when)}
          onChange={setDate}
          variant="button"
          triggerLabel={
            <span className="text-left">
              <span className="block font-semibold text-[#0a0a0a]">
                {when.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
              <span className="block text-[10.5px] font-normal text-[#a1a1aa]">
                {when.toLocaleDateString("en-GB", { weekday: "short" })}
              </span>
            </span>
          }
          triggerClassName="!px-1 !py-0.5 text-[12px]"
        />
      </span>

      <span className="min-w-0 tabular-nums">
        <TimePicker
          value={toTimeValue(when)}
          onChange={setTime}
          variant="text"
          className="[&>button]:text-left [&>button]:text-[#3f3f46]"
        />
      </span>

      <span className="min-w-0">
        <Combo
          options={DURATIONS.map((m) => ({ value: String(m), label: durationLabel(m) }))}
          value={String(appt.duration ?? 60)}
          onChange={(v) => v && patch({ duration: Number(v) })}
          variant="text"
          align="start"
          clearable={false}
          className="[&>button]:text-left [&>button]:text-[#3f3f46]"
        />
      </span>

      <span className="flex min-w-0 items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-full" style={{ background: cat.fg }} />
        <Combo
          options={types.map((t) => ({ id: t.id, value: t.label, label: t.label }))}
          value={appt.type ?? appt.title}
          onChange={(v) => patch({ type: v || null, title: v || appt.title })}
          variant="text"
          align="start"
          className="min-w-0 flex-1 [&>button]:w-full [&>button]:truncate [&>button]:text-left [&>button]:font-semibold [&>button]:text-[#0a0a0a]"
          placeholder="Set a type…"
        />
      </span>

      <span className="min-w-0">
        <StaffCell appt={appt} staff={staff} onToggle={toggleStaff} />
      </span>

      {/* The PILL is the trigger: the status stays readable at a glance and is
          one click from changing, rather than a pill sitting next to a control
          that does the same job. */}
      <span className="min-w-0">
        <Combo
          options={[
            { value: "provisional", label: "Provisional" },
            { value: "confirmed", label: "Confirmed" },
            { value: "done", label: "Done" },
          ]}
          value={done ? "done" : appt.provisional ? "provisional" : "confirmed"}
          onChange={setStatus}
          variant="text"
          align="start"
          clearable={false}
          className={cn(
            "[&>button]:rounded-full [&>button]:px-2 [&>button]:py-[3px] [&>button]:text-[11px] [&>button]:font-semibold",
            done
              ? "[&>button]:bg-[#e7f4ec] [&>button]:text-[#1a7f3e]"
              : appt.provisional
                ? "[&>button]:bg-[#fdf2dc] [&>button]:text-[#b86e00]"
                : "[&>button]:bg-[#f4f4f5] [&>button]:text-[#3f3f46]",
          )}
        />
      </span>

      {/* Its own column, and the LAST one: as a second line under the
          appointment it ran the width of the table and printed over
          everything to its right. */}
      <span className="min-w-0">
        <AppointmentComment id={appt.id} value={appt.notes} className="text-[11.5px]" />
      </span>

      {/* Stacked, not side by side: two verbs in a 78px column would each
          truncate to a word and a half. */}
      <span className="flex flex-col items-end gap-1">
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
      </span>
    </div>
  );
}

/** Who's going — multi-select, because a fit is two people and a single-select
 *  would silently drop the second one the first time anyone edited it. */
function StaffCell({
  appt,
  staff,
  onToggle,
}: {
  appt: DiaryEvent;
  staff: DiaryStaff[];
  onToggle: (id: string) => void;
}) {
  const shown = appt.staffNames.length
    ? appt.staffNames.join(" + ")
    : (appt.assignedTo ?? null);

  return (
    <Combo
      options={staff.map((s) => ({ id: s.id, value: s.id, label: s.name }))}
      // No single "value": the trigger shows everyone assigned, and picking a
      // name toggles that person rather than replacing the lot.
      value={null}
      selectedValues={appt.staffIds}
      onChange={(v) => v && onToggle(v)}
      variant="text"
      align="start"
      clearable={false}
      placeholder={shown ?? "Nobody yet"}
      searchPlaceholder="Search staff…"
      // Wraps to two lines rather than truncating: a fit is two people and
      // "Aaron Bl…" tells you neither who is going nor that there are two.
      className="[&>button]:w-full [&>button]:max-w-full [&>button]:text-left [&>button]:leading-tight [&>button]:whitespace-normal [&>button]:break-words [&>button]:text-[#3f3f46]"
    />
  );
}

function toDateValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export { WORK_CATEGORIES };
