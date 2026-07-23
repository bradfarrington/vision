"use client";

import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useDismissOnOutside, useFloatingMenu } from "./floating-menu";
import { Icon } from "./icon";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Reusable accent-themed date picker. Plain-text trigger (or bordered input),
// with a custom calendar: click the header to step day → month → year, then
// pick year → month → day for fast selection. Emits a `yyyy-mm-dd` string.
export function DatePicker({
  value,
  onChange,
  variant = "input",
  placeholder = "—",
  className,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  variant?: "input" | "text";
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"day" | "month" | "year">("day");
  const [cursor, setCursor] = useState<Date>(() => parseDate(value) ?? new Date());
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Fixed, viewport-positioned — see components/crm/floating-menu.
  const menuStyle = useFloatingMenu({
    open,
    triggerRef,
    width: 280,
    align: variant === "text" ? "end" : "start",
    maxHeight: 340,
  });

  const selected = parseDate(value);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setCursor(parseDate(value) ?? new Date());
    setView("day");
    setOpen(true);
  }

  // Shared dismiss — attaches on the next macrotask (so the press that opened
  // this menu can't close it) and matches on the event's composed path (so a row
  // that re-renders on press is still "inside"). See floating-menu.
  const dismiss = useCallback(() => setOpen(false), []);
  useDismissOnOutside({ open, onDismiss: dismiss, refs: [ref, triggerRef] });

  const shown = selected ? formatDisplay(selected) : null;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const yearBlockStart = Math.floor(year / 12) * 12;

  function pick(date: Date) {
    onChange(toISO(date));
    setOpen(false);
  }
  function shift(dir: number) {
    if (view === "day") setCursor(new Date(year, month + dir, 1));
    else if (view === "month") setCursor(new Date(year + dir, month, 1));
    else setCursor(new Date(year + dir * 12, month, 1));
  }
  function cycleHeader() {
    setView((v) => (v === "day" ? "month" : v === "month" ? "year" : "day"));
  }

  const headerLabel =
    view === "day"
      ? `${MONTHS_FULL[month]} ${year}`
      : view === "month"
        ? `${year}`
        : `${yearBlockStart} – ${yearBlockStart + 11}`;

  return (
    <div ref={ref} className={cn("relative", variant === "text" && "inline-block", className)}>
      {variant === "text" ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
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
          onClick={toggle}
          className="flex w-full items-center gap-2 rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-left text-[13px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
        >
          <span className={cn("flex-1", !shown && "text-[#a1a1aa]")}>{shown ?? placeholder}</span>
          <Icon name="calendar" size={14} strokeWidth={1.75} className="text-[#71717a]" />
        </button>
      )}

      {open && menuStyle && (
        <div
          style={menuStyle}
          className="z-50 overflow-y-auto rounded-xl border border-[#e7e7ea] bg-white p-3 shadow-[0_12px_32px_rgba(10,10,10,0.10),0_4px_8px_rgba(10,10,10,0.05)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={cycleHeader}
              className="rounded-md px-2 py-1 text-[13px] font-bold text-[#0a0a0a] hover:bg-[var(--accent-tint)]"
            >
              {headerLabel}
            </button>
            <div className="flex items-center gap-1">
              <ArrowBtn onClick={() => shift(-1)}>‹</ArrowBtn>
              <ArrowBtn onClick={() => shift(1)}>›</ArrowBtn>
            </div>
          </div>

          {view === "day" && (
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAYS.map((w, i) => (
                <div key={i} className="py-1 text-[10.5px] font-semibold text-[#a1a1aa]">
                  {w}
                </div>
              ))}
              {monthCells(year, month).map((cell, i) => {
                const isSel = selected && sameDay(cell.date, selected);
                const isToday = sameDay(cell.date, new Date());
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pick(cell.date)}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-md text-[12.5px]",
                      cell.inMonth ? "text-[#3f3f46]" : "text-[#c8c8cc]",
                      isSel
                        ? "bg-[var(--accent-blue)] font-semibold text-white"
                        : isToday
                          ? "font-semibold text-[var(--accent-blue)] ring-1 ring-inset ring-[var(--accent-blue)]"
                          : "hover:bg-[var(--accent-tint)]",
                    )}
                  >
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>
          )}

          {view === "month" && (
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((m, i) => {
                const isSel = selected && selected.getFullYear() === year && selected.getMonth() === i;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setCursor(new Date(year, i, 1));
                      setView("day");
                    }}
                    className={cn(
                      "rounded-md py-2 text-[12.5px]",
                      isSel
                        ? "bg-[var(--accent-blue)] font-semibold text-white"
                        : "text-[#3f3f46] hover:bg-[var(--accent-tint)]",
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          )}

          {view === "year" && (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => yearBlockStart + i).map((y) => {
                const isSel = selected && selected.getFullYear() === y;
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setCursor(new Date(y, month, 1));
                      setView("month");
                    }}
                    className={cn(
                      "rounded-md py-2 text-[12.5px]",
                      isSel
                        ? "bg-[var(--accent-blue)] font-semibold text-white"
                        : "text-[#3f3f46] hover:bg-[var(--accent-tint)]",
                    )}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-[#f4f4f5] pt-2 text-[12px] font-semibold">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="text-[#71717a] hover:text-[#3f3f46]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => pick(new Date())}
              className="text-[var(--accent-blue)]"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArrowBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-[15px] text-[#71717a] hover:bg-[var(--accent-tint)] hover:text-[#3f3f46]"
    >
      {children}
    </button>
  );
}

// Six weeks of cells (Monday-first), including trailing days from adjacent months.
function monthCells(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday = 0
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(year, month, 1 - startOffset + i);
    cells.push({ date, inMonth: date.getMonth() === month });
  }
  return cells;
}

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatDisplay(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
