"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveBooking, type BookingResult } from "@/app/(app)/diary/actions";
import { APPOINTMENT_STATUSES, durationLabel } from "@/lib/appointments";
import { SLOT_MINUTES } from "@/lib/diary";
import { Combo } from "./combo";
import { DatePicker } from "./date-picker";
import { TimePicker } from "./time-picker";
import { inputClass } from "./wizard";
import type { DiaryStaff } from "@/lib/data/staff";
import type { TenantOption } from "@/lib/data/customer-record";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The booking dialog — ONE component behind every way of making an appointment:
// clicking a slot on the diary, "Book appointment" on a lead, and "Add
// appointment" on a contract's Fitting tab. They differ only in what arrives
// pre-filled, which is why they can't drift apart.
//
// Durations are offered as SLOT MULTIPLES, matching the grid: a booking that
// isn't a whole number of slots renders between two rows and can never be
// picked from the grid again.
// ---------------------------------------------------------------------------

export type BookingSeed = {
  id?: string;
  startsAt?: Date | null;
  duration?: number;
  type?: string | null;
  title?: string | null;
  notes?: string | null;
  staffIds?: string[];
  status?: string;
  leadId?: string | null;
  contractId?: string | null;
  customerId?: string | null;
};

const DURATIONS = [30, 60, 90, 120, 180, 240, 480, 720, 960, 1440];

export function BookingDialog({
  open,
  onOpenChange,
  seed,
  staff,
  types,
  /** Shown under the title — "Lead L-2431 · Margaret Ellison". */
  context,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed: BookingSeed | null;
  staff: DiaryStaff[];
  /** The tenant's `appointment_type` list. */
  types: TenantOption[];
  context?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The form is REMOUNTED per seed rather than re-seeded by an effect:
          clicking a second slot must not reopen the dialog still holding the
          first one's time, and a key does that without a setState-in-effect
          (which cascades a render and is what the lint rule is about). */}
      {open && seed && (
        <BookingForm
          key={seedKey(seed)}
          seed={seed}
          staff={staff}
          types={types}
          context={context}
          onDone={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

/** Identity of a seed, so a new one remounts the form with fresh state. */
function seedKey(seed: BookingSeed): string {
  return [
    seed.id ?? "new",
    seed.startsAt?.toISOString() ?? "",
    (seed.staffIds ?? []).join(","),
    seed.leadId ?? "",
    seed.contractId ?? "",
  ].join("|");
}

function BookingForm({
  seed,
  staff,
  types,
  context,
  onDone,
  onCancel,
}: {
  seed: BookingSeed;
  staff: DiaryStaff[];
  types: TenantOption[];
  context?: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<BookingResult["clashes"]>(undefined);

  const [date, setDate] = useState<string | null>(
    seed.startsAt ? toDateValue(seed.startsAt) : null,
  );
  const [time, setTime] = useState<string | null>(
    seed.startsAt ? toTimeValue(seed.startsAt) : null,
  );
  const [duration, setDuration] = useState(seed.duration ?? 60);
  const [type, setType] = useState<string | null>(seed.type ?? null);
  const [notes, setNotes] = useState(seed.notes ?? "");
  const [staffIds, setStaffIds] = useState<string[]>(seed.staffIds ?? []);
  const [status, setStatus] = useState(seed.status ?? "confirmed");

  const canSave = !!date && !!time;

  function submit(force = false) {
    if (!canSave) {
      setError("Pick a date and a time.");
      return;
    }
    setError(null);
    const startsAt = combine(date!, time!);
    start(async () => {
      const res = await saveBooking({
        id: seed.id,
        startsAt,
        duration,
        type,
        title: type,
        notes,
        staffIds,
        staffNames: staff.filter((s) => staffIds.includes(s.id)).map((s) => s.name),
        status,
        leadId: seed.leadId ?? null,
        contractId: seed.contractId ?? null,
        customerId: seed.customerId ?? null,
        force,
      });
      if (res.clashes?.length) {
        setClashes(res.clashes);
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{seed.id ? "Edit appointment" : "Book an appointment"}</DialogTitle>
          {context && <DialogDescription>{context}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <DatePicker value={date} onChange={setDate} />
            </Field>
            <Field label="Time">
              <TimePicker value={time} onChange={setTime} />
            </Field>
          </div>

          <Field label="Type">
            <Combo
              options={types.map((t) => ({ id: t.id, value: t.label, label: t.label }))}
              value={type}
              onChange={(v) => setType(v || null)}
              placeholder="Sales call, survey, fitting…"
            />
          </Field>

          <Field label="How long">
            {/* Slot multiples only — see the note at the top of this file. */}
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDuration(m)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors",
                    duration === m
                      ? "border-[var(--accent-blue)] bg-[var(--accent-tint)] text-[var(--accent-active)]"
                      : "border-[#e7e7ea] bg-white text-[#3f3f46] hover:bg-[#fafafa]",
                  )}
                >
                  {durationLabel(m)}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Who">
            <div className="flex flex-wrap gap-1.5">
              {staff.length === 0 && (
                <span className="text-[12px] text-[#a1a1aa]">
                  No active staff — add people under Settings.
                </span>
              )}
              {staff.map((s) => {
                const on = staffIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    // Multi-select: a fitting is two people, a survey is one.
                    onClick={() =>
                      setStaffIds(on ? staffIds.filter((i) => i !== s.id) : [...staffIds, s.id])
                    }
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11.5px] font-medium transition-colors",
                      on
                        ? "border-[var(--accent-blue)] bg-[var(--accent-tint)] text-[var(--accent-active)]"
                        : "border-[#e7e7ea] bg-white text-[#3f3f46] hover:bg-[#fafafa]",
                    )}
                  >
                    <span className="flex size-[18px] items-center justify-center rounded-full bg-white/70 text-[9px] font-bold">
                      {s.initials}
                    </span>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Status">
            <div className="flex gap-1.5">
              {APPOINTMENT_STATUSES.filter((s) => s.key !== "cancelled").map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                    status === s.key
                      ? "border-[var(--accent-blue)] bg-[var(--accent-tint)] text-[var(--accent-active)]"
                      : "border-[#e7e7ea] bg-white text-[#3f3f46] hover:bg-[#fafafa]",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Notes">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the person going needs to know…"
              className={cn(inputClass, "resize-y")}
            />
          </Field>
        </div>

        {/* A clash is REPORTED, not silently blocked: double-booking is usually
            a mistake and occasionally deliberate, so the jobs are named and the
            override is one click. */}
        {clashes && clashes.length > 0 && (
          <div className="rounded-lg border border-[#f0d9a8] bg-[#fdf2dc] px-3 py-2">
            <p className="text-[12.5px] font-semibold text-[#b86e00]">
              Already booked at that time
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {clashes.map((c) => (
                <li key={c.id} className="text-[12px] text-[#3f3f46]">
                  {c.staffName} — {c.title},{" "}
                  {new Date(c.startsAt).toLocaleString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={pending}
              className="mt-2 text-[12px] font-semibold text-[#b86e00] underline"
            >
              Book it anyway
            </button>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-[#f3c7c7] bg-[#fdecec] px-3 py-2 text-[12.5px] font-medium text-[#d64545]">
            {error}
          </p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#d4d4d8] bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#3f3f46]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={pending || !canSave}
            className={cn(
              "rounded-lg bg-[#1a7f3e] px-3.5 py-2 text-[12.5px] font-semibold text-white",
              (pending || !canSave) && "opacity-60",
            )}
          >
            {pending ? "Saving…" : seed.id ? "Save changes" : "Book it"}
          </button>
        </DialogFooter>
      </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] font-semibold text-[#3f3f46]">{label}</span>
      {children}
    </label>
  );
}

function toDateValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Combine the picker's `yyyy-mm-dd` and `HH:MM` into a local instant. */
function combine(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

export { SLOT_MINUTES };
