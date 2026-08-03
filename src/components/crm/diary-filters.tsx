"use client";

import { Popover } from "@/components/crm/data-list";
import { useSetParams } from "@/components/crm/list-controls";
import { WORK_CATEGORIES } from "@/lib/appointments";
import type { DiaryStaff } from "@/lib/data/staff";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

// The diary's Job type + Staff filters — TWO labelled dropdowns, per design
// screen 07, not one "Filters" popover.
//
// They're separate because the trigger states the current selection ("Staff:
// Dave Nolan") rather than a count on a generic button. On a list screen a
// popover hides a dozen filters behind one control and a badge is the only
// summary that fits; the diary has exactly two axes and they are the two
// questions you ask it all day, so each gets to say its own answer out loud.
//
// Both use the SHARED Popover — the diary isn't a ListSpec (it's a time canvas,
// not a table), but its controls must read identically to the lists', so it
// uses the same one rather than a fourth hand-rolled menu. See AGENTS.md
// § Popover menus.
//
// Both are multi-select and ride in comma-separated URL params, so the state is
// shareable and rides in the session view state like every other list control.

/** "All" · the one thing chosen · "N types" — the trigger IS the summary. */
function summarise(selected: string[], nameOf: (v: string) => string, plural: string): string {
  if (!selected.length) return "All";
  if (selected.length === 1) return nameOf(selected[0]);
  return `${selected.length} ${plural}`;
}

function useToggleParam(param: string) {
  const { setParams, searchParams } = useSetParams();
  const selected = (searchParams.get(param) ?? "").split(",").filter(Boolean);
  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    setParams({ [param]: next.length ? next.join(",") : null });
  };
  const clear = () => setParams({ [param]: null });
  return { selected, toggle, clear };
}

export function JobTypeFilter() {
  const { selected, toggle, clear } = useToggleParam("cat");
  const label = summarise(
    selected,
    (v) => WORK_CATEGORIES.find((c) => c.key === v)?.label ?? v,
    "types",
  );

  return (
    <Popover label={`Job type: ${label}`} caret active={selected.length > 0} width={220}>
      {() => (
        <div className="flex flex-col p-2">
          {WORK_CATEGORIES.map((c) => (
            <Row
              key={c.key}
              label={c.label}
              checked={selected.includes(c.key)}
              onToggle={() => toggle(c.key)}
              swatch={c.bg}
            />
          ))}
          <ClearAll show={selected.length > 0} onClear={clear} />
        </div>
      )}
    </Popover>
  );
}

export function StaffFilter({ staff }: { staff: DiaryStaff[] }) {
  const { selected, toggle, clear } = useToggleParam("staff");
  const label = summarise(selected, (v) => staff.find((s) => s.id === v)?.name ?? v, "people");

  return (
    <Popover label={`Staff: ${label}`} caret active={selected.length > 0} width={250}>
      {() => (
        <div className="flex flex-col p-2">
          {staff.length === 0 && (
            <p className="px-1 py-2 text-[12px] text-[#a1a1aa]">No active staff.</p>
          )}
          {staff.map((s) => (
            <Row
              key={s.id}
              label={s.name}
              hint={s.role}
              checked={selected.includes(s.id)}
              onToggle={() => toggle(s.id)}
            />
          ))}
          <ClearAll show={selected.length > 0} onClear={clear} />
        </div>
      )}
    </Popover>
  );
}

function ClearAll({ show, onClear }: { show: boolean; onClear: () => void }) {
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={onClear}
      className="mt-1 self-start px-1 py-1 text-[12px] font-semibold text-[var(--accent-blue)]"
    >
      Show all
    </button>
  );
}

function Row({
  label,
  hint,
  checked,
  onToggle,
  swatch,
}: {
  label: string;
  hint?: string | null;
  checked: boolean;
  onToggle: () => void;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 rounded-md px-1 py-[5px] text-left hover:bg-[#fafafa]"
    >
      <span
        className={cn(
          "flex size-[15px] shrink-0 items-center justify-center rounded-[4px] border",
          checked
            ? "border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white"
            : "border-[#d4d4d8] bg-white",
        )}
      >
        {checked && <Icon name="check" size={10} strokeWidth={3} />}
      </span>
      {swatch && <span className="size-3 shrink-0 rounded" style={{ background: swatch }} />}
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#3f3f46]">{label}</span>
      {hint && <span className="shrink-0 text-[10.5px] text-[#a1a1aa]">{hint}</span>}
    </button>
  );
}
