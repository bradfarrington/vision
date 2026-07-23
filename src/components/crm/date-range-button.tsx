"use client";

import { useState } from "react";

import { DatePicker } from "./date-picker";
import { Popover } from "./data-list";
import { useSetParams } from "./list-controls";
import { RANGE_PRESETS, rangeLabel } from "@/lib/date-range";
import { cn } from "@/lib/utils";

// Date-range picker for a list toolbar, sitting beside Columns and Filters and
// built on the same shared `Popover` so all three read as one control group.
//
// URL-param-driven like every other list filter (see AGENTS.md § Lists): the
// server re-queries, the state is shareable and back-button-friendly, and it
// rides along in the saved session view state for free.
//   `range=<preset>`             — a rolling window, resolved server-side
//   `range=custom` + `from`/`to` — fixed endpoints
// Absent = all time.

export function DateRangeButton({ label = "Date" }: { label?: string }) {
  const { setParams, searchParams } = useSetParams();
  const range = searchParams.get("range");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const isCustom = range === "custom";

  // Custom endpoints are staged locally and applied together — writing a param
  // on each pick would re-query the list halfway through choosing a range, and
  // briefly show a window the user never asked for.
  const [draftFrom, setDraftFrom] = useState<string | null>(from);
  const [draftTo, setDraftTo] = useState<string | null>(to);

  const active = !!range;
  const current = rangeLabel(range, { from, to });

  return (
    <Popover
      label={active ? current : label}
      icon="calendar"
      active={active}
      width={268}
    >
      {(close) => (
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-[#f4f4f5] px-3 py-2.5">
            <span className="text-[13px] font-bold text-[#0a0a0a]">Date range</span>
            {active && (
              <button
                type="button"
                onClick={() => {
                  setParams({ range: null, from: null, to: null });
                  close();
                }}
                className="text-[11.5px] font-medium text-[var(--accent-blue)] hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto px-1.5 py-1.5">
            <RangeRow
              label="All time"
              checked={!range}
              onClick={() => {
                setParams({ range: null, from: null, to: null });
                close();
              }}
            />
            {RANGE_PRESETS.map((p) => (
              <RangeRow
                key={p.key}
                label={p.label}
                checked={range === p.key}
                onClick={() => {
                  // Presets drop any custom endpoints, or a stale from/to would
                  // sit in the URL contradicting the label on the button.
                  setParams({ range: p.key, from: null, to: null });
                  close();
                }}
              />
            ))}

            <div className="my-1 border-t border-[#f4f4f5]" />
            <RangeRow
              label="Custom range…"
              checked={isCustom}
              onClick={() => setParams({ range: "custom" })}
            />

            {isCustom && (
              <div className="flex flex-col gap-2 px-2 pb-1.5 pt-2">
                <Labelled label="From">
                  <DatePicker value={draftFrom} onChange={setDraftFrom} placeholder="Any" />
                </Labelled>
                <Labelled label="To">
                  <DatePicker value={draftTo} onChange={setDraftTo} placeholder="Any" />
                </Labelled>
                <button
                  type="button"
                  onClick={() => {
                    setParams({ range: "custom", from: draftFrom, to: draftTo });
                    close();
                  }}
                  className="rounded-md border border-[var(--accent-blue)] py-1.5 text-[12.5px] font-semibold text-[var(--accent-blue)] transition-colors hover:bg-[var(--accent-tint)]"
                >
                  Apply
                </button>
                {/* Both ends are optional — an open-ended range is a real answer
                    to "everything since we changed supplier". */}
                <p className="text-[11px] text-[#a1a1aa]">
                  Leave either end blank for an open-ended range.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-[#71717a]">{label}</span>
      {children}
    </label>
  );
}

function RangeRow({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#fafafa]"
    >
      <span
        className={cn(
          "flex size-[15px] shrink-0 items-center justify-center rounded-full border",
          checked ? "border-[var(--accent-blue)]" : "border-[#d4d4d8]",
        )}
      >
        {checked && <span className="size-[7px] rounded-full bg-[var(--accent-blue)]" />}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          checked ? "font-medium text-[#0a0a0a]" : "text-[#3f3f46]",
        )}
      >
        {label}
      </span>
    </button>
  );
}
