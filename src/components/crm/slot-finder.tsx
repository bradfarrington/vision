"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { searchSlots } from "@/app/(app)/diary/slots/actions";
import { saveBooking } from "@/app/(app)/diary/actions";
import { durationLabel } from "@/lib/appointments";
import type { SlotSuggestion } from "@/lib/data/availability";
import type { DiaryStaff } from "@/lib/data/staff";
import type { TenantOption } from "@/lib/data/customer-record";
import { Card, CardTitle, Icon, btnPrimary } from "./primitives";
import { Combo } from "./combo";
import { DatePicker } from "./date-picker";
import { cn } from "@/lib/utils";

// Slot finder (design screen 09) — "find 2.5 days for any two installers,
// earliest Wednesday" → the first windows where everyone needed is free.
//
// Every suggestion is a real slot boundary the grid can render and the booking
// dialog can accept, and each says WHY it's being offered: a bare list of dates
// is unjudgeable.

const DURATIONS = [60, 120, 240, 480, 720, 960, 1440, 1920, 2400];

export function SlotFinder({
  staff,
  types,
  /** Pre-filled when arriving from a lead or contract. */
  leadId,
  contractId,
  customerId,
  context,
}: {
  staff: DiaryStaff[];
  types: TenantOption[];
  leadId?: string | null;
  contractId?: string | null;
  customerId?: string | null;
  context?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [booking, startBooking] = useTransition();

  const [mode, setMode] = useState<"named" | "any">("named");
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [anyCount, setAnyCount] = useState(2);
  const [duration, setDuration] = useState(480);
  const [earliest, setEarliest] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [includeWeekends, setIncludeWeekends] = useState(false);

  const [results, setResults] = useState<SlotSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function search() {
    setError(null);
    if (mode === "named" && !staffIds.length) {
      setError("Pick who needs to be there, or switch to “any available”.");
      return;
    }
    start(async () => {
      const found = await searchSlots({
        staffIds: mode === "named" ? staffIds : [],
        anyCount: mode === "any" ? anyCount : undefined,
        poolIds: staff.map((s) => s.id),
        duration,
        earliest: earliest ? new Date(earliest).toISOString() : undefined,
        includeWeekends,
        limit: 6,
      });
      setResults(found);
    });
  }

  function book(slot: SlotSuggestion) {
    startBooking(async () => {
      const res = await saveBooking({
        startsAt: slot.start,
        duration,
        type,
        title: type,
        staffIds: slot.staffIds,
        staffNames: slot.staffNames,
        leadId: leadId ?? null,
        contractId: contractId ?? null,
        customerId: customerId ?? null,
        // The engine only offers windows it has just verified as free, so a
        // clash here would be a race, not a mistake — book it and let the
        // diary show the truth.
        force: true,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push(`/diary?view=day&d=${slot.start.slice(0, 10)}`);
    });
  }

  return (
    <div className="grid max-w-[1100px] items-start gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardTitle className="mb-2 text-[14px]">What needs booking</CardTitle>
        {context && <p className="mb-2 text-[12px] text-[#71717a]">{context}</p>}

        <Field label="Type">
          <Combo
            options={types.map((t) => ({ id: t.id, value: t.label, label: t.label }))}
            value={type}
            onChange={(v) => setType(v || null)}
            placeholder="Fitting, survey…"
          />
        </Field>

        <Field label="Who">
          <div className="mb-1.5 flex gap-1.5">
            <Toggle on={mode === "named"} onClick={() => setMode("named")}>
              These people
            </Toggle>
            <Toggle on={mode === "any"} onClick={() => setMode("any")}>
              Any available
            </Toggle>
          </div>
          {mode === "named" ? (
            <div className="flex flex-wrap gap-1.5">
              {staff.map((s) => {
                const on = staffIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setStaffIds(on ? staffIds.filter((i) => i !== s.id) : [...staffIds, s.id])
                    }
                    className={cn(
                      "rounded-full border px-2 py-1 text-[11.5px] font-medium transition-colors",
                      on
                        ? "border-[var(--accent-blue)] bg-[var(--accent-tint)] text-[var(--accent-active)]"
                        : "border-[#e7e7ea] bg-white text-[#3f3f46] hover:bg-[#fafafa]",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Stepper value={anyCount} onChange={setAnyCount} min={1} max={Math.max(1, staff.length)} />
              <span className="text-[12.5px] text-[#3f3f46]">
                {anyCount === 1 ? "person" : "people"}, whoever is free
              </span>
            </div>
          )}
        </Field>

        <Field label="How long">
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map((m) => (
              <Toggle key={m} on={duration === m} onClick={() => setDuration(m)}>
                {durationLabel(m)}
              </Toggle>
            ))}
          </div>
        </Field>

        <Field label="Earliest start">
          <DatePicker value={earliest} onChange={setEarliest} placeholder="As soon as possible" />
        </Field>

        <label className="mt-1 flex items-center gap-2 text-[12.5px] text-[#3f3f46]">
          <input
            type="checkbox"
            checked={includeWeekends}
            onChange={(e) => setIncludeWeekends(e.target.checked)}
            className="size-3.5 accent-[var(--accent-blue)]"
          />
          Include weekends
        </label>

        <button
          type="button"
          onClick={search}
          disabled={pending}
          className={cn(btnPrimary, "mt-3 w-full justify-center")}
        >
          {pending ? "Searching…" : "Find next slots"}
        </button>

        {error && (
          <p className="mt-2 rounded-lg border border-[#f3c7c7] bg-[#fdecec] px-3 py-2 text-[12px] font-medium text-[#d64545]">
            {error}
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-2.5">
        {results === null && (
          <Card>
            <p className="py-6 text-center text-[12.5px] text-[#71717a]">
              Set the job up on the left and the first free windows appear here.
            </p>
          </Card>
        )}

        {results?.length === 0 && (
          <Card>
            <p className="py-6 text-center text-[12.5px] text-[#71717a]">
              Nothing free in the next three months for that combination. Try fewer people, a
              shorter job, or allow weekends.
            </p>
          </Card>
        )}

        {results?.map((slot, i) => (
          <SlotRow
            key={slot.start}
            slot={slot}
            duration={duration}
            best={i === 0}
            disabled={booking}
            onBook={() => book(slot)}
          />
        ))}
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  duration,
  best,
  disabled,
  onBook,
}: {
  slot: SlotSuggestion;
  duration: number;
  best: boolean;
  disabled: boolean;
  onBook: () => void;
}) {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const sameDay = start.toDateString() === end.toDateString();

  return (
    <Card
      className={cn(
        "flex items-center gap-3",
        // The first result is the engine's best answer, so it says so — a list
        // of six equal-looking options makes you compare them all over again.
        best && "ring-1 ring-[var(--accent-blue)]",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#0a0a0a]">
            {start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            {!sameDay &&
              ` – ${end.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`}
          </span>
          <span className="text-[12px] text-[#71717a]">
            {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ·{" "}
            {durationLabel(duration)}
          </span>
          {best && (
            <span className="rounded-full bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--accent-active)]">
              Best match
            </span>
          )}
        </div>
        {/* WHY this one — the design's "both free · no conflicts · spans a
            weekend". A date on its own can't be judged. */}
        <p className="mt-0.5 text-[11.5px] text-[#71717a]">{slot.reasons.join(" · ")}</p>
      </div>

      <button
        type="button"
        onClick={onBook}
        disabled={disabled}
        className={cn(
          "shrink-0 rounded-lg bg-[#1a7f3e] px-3 py-1.5 text-[12px] font-semibold text-white",
          disabled && "opacity-60",
        )}
      >
        Book slot
      </button>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2.5 flex flex-col gap-1">
      <span className="text-[11.5px] font-semibold text-[#3f3f46]">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors",
        on
          ? "border-[var(--accent-blue)] bg-[var(--accent-tint)] text-[var(--accent-active)]"
          : "border-[#e7e7ea] bg-white text-[#3f3f46] hover:bg-[#fafafa]",
      )}
    >
      {children}
    </button>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <span className="inline-flex items-center rounded-lg border border-[#e7e7ea]">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-2 py-1 text-[#71717a] hover:text-[#0a0a0a]"
        aria-label="Fewer"
      >
        <Icon name="minus" size={12} strokeWidth={2.5} />
      </button>
      <span className="min-w-[22px] text-center text-[12.5px] font-bold tabular-nums text-[#0a0a0a]">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-2 py-1 text-[#71717a] hover:text-[#0a0a0a]"
        aria-label="More"
      >
        <Icon name="plus" size={12} strokeWidth={2.5} />
      </button>
    </span>
  );
}
