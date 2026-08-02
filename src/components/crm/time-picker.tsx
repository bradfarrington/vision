"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useDismissOnOutside, useFloatingMenu } from "./floating-menu";
import { Icon } from "./icon";
import { DAY_END_HOUR, DAY_START_HOUR, SLOT_MINUTES } from "@/lib/diary";

// ---------------------------------------------------------------------------
// TimePicker — the custom control that retires the last native input in the
// CRM. `<input type="time">` renders differently in every browser, ignores the
// tenant accent, and on some platforms opens an OS wheel that has nothing to do
// with this app — the same reasons `DatePicker` replaced `<input type="date">`.
//
// Shape deliberately mirrors DatePicker (`value` / `onChange` / `variant`), so
// the two read as a pair wherever a date and a time sit side by side.
//
// The list is the DIARY'S OWN SLOTS — 07:00 to 17:00 every 30 minutes — so the
// times you can pick here are exactly the times the grid can show. A booking
// made at 07:17 would render between two rows and could never be selected from
// the grid again. Out-of-hours values are still accepted if they arrive from
// elsewhere (see below); this only constrains what you can PICK.
// ---------------------------------------------------------------------------

/** `HH:MM` (24h). Null when unset. */
export type TimeValue = string | null;

export function TimePicker({
  value,
  onChange,
  variant = "input",
  placeholder = "—",
  className,
  /** Minutes between options. Defaults to the diary's slot size. */
  step = SLOT_MINUTES,
  /** Widen beyond working hours where a booking genuinely can run late. */
  fromHour = DAY_START_HOUR,
  toHour = DAY_END_HOUR,
}: {
  value: TimeValue;
  onChange: (value: TimeValue) => void;
  variant?: "input" | "text";
  placeholder?: string;
  className?: string;
  step?: number;
  fromHour?: number;
  toHour?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const menuStyle = useFloatingMenu({
    open,
    triggerRef,
    width: 132,
    align: variant === "text" ? "end" : "start",
    maxHeight: 280,
  });

  // Shared dismiss — attaches on the next macrotask so the press that opened
  // the menu can't close it, and matches on the composed path so a row that
  // re-renders on press still counts as inside. See floating-menu.
  const dismiss = useCallback(() => setOpen(false), []);
  useDismissOnOutside({ open, onDismiss: dismiss, refs: [ref, triggerRef] });

  const options: string[] = [];
  for (let m = fromHour * 60; m < toHour * 60; m += step) {
    options.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }

  // A value that isn't on the step (legacy data, or one typed elsewhere) still
  // has to be selectable and visible — dropping it would silently rewrite the
  // booking the moment someone opened the field.
  const offStep = value && !options.includes(value);

  // Open scrolled to the current value, or to the start of the working day.
  // A list of twenty times that always opens at the top means scrolling past
  // the morning to book an afternoon job, every time.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>("[data-selected='true']");
    el?.scrollIntoView({ block: "center" });
  }, [open]);

  const shown = value ?? null;

  return (
    <div ref={ref} className={cn("relative", variant === "text" && "inline-block", className)}>
      {variant === "text" ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "-mx-1 rounded px-1 text-right text-[12.5px] font-medium text-[#3f3f46] transition-colors hover:bg-[var(--accent-tint)]",
            !shown && "text-[#a1a1aa]",
          )}
        >
          {shown ?? placeholder}
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-left text-[13px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
        >
          <span className={cn("flex-1 tabular-nums", !shown && "text-[#a1a1aa]")}>
            {shown ?? placeholder}
          </span>
          <Icon name="clock" size={14} strokeWidth={1.75} className="text-[#71717a]" />
        </button>
      )}

      {open && menuStyle && (
        <div
          ref={listRef}
          style={menuStyle}
          className="z-50 overflow-y-auto rounded-xl border border-[#e7e7ea] bg-white p-1 shadow-[0_12px_32px_rgba(10,10,10,0.10),0_4px_8px_rgba(10,10,10,0.05)]"
        >
          {offStep && (
            <Option
              label={value!}
              selected
              hint="current"
              onPick={() => {
                onChange(value!);
                setOpen(false);
              }}
            />
          )}
          {options.map((t) => (
            <Option
              key={t}
              label={t}
              selected={t === value}
              onPick={() => {
                // Clicking the SELECTED option clears the field, the same way
                // the Combo does — otherwise there's no way back to blank once
                // a time is set, only sideways to another one.
                onChange(t === value ? null : t);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Option({
  label,
  selected,
  hint,
  onPick,
}: {
  label: string;
  selected: boolean;
  hint?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      data-selected={selected ? "true" : undefined}
      onClick={onPick}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left text-[12.5px] tabular-nums transition-colors",
        selected
          ? "bg-[var(--accent-tint)] font-semibold text-[var(--accent-active)]"
          : "text-[#3f3f46] hover:bg-[#fafafa]",
      )}
    >
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[10px] text-[#a1a1aa]">{hint}</span>}
      {/* Tick on the selected row, turning into an ✕ on hover to advertise that
          clicking it again clears the field — same affordance as the Combo. */}
      {selected && (
        <>
          <Icon name="check" size={12} strokeWidth={2.5} className="group-hover:hidden" />
          <Icon name="x" size={12} strokeWidth={2.5} className="hidden group-hover:block" />
        </>
      )}
    </button>
  );
}
