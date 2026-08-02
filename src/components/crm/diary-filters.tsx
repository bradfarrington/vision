"use client";

import { Popover, SectionLabel } from "@/components/crm/data-list";
import { useSetParams } from "@/components/crm/list-controls";
import { WORK_CATEGORIES } from "@/lib/appointments";
import type { DiaryStaff } from "@/lib/data/staff";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

// The diary's Staff + Category filters, in the SHARED toolbar popover — the
// diary isn't a ListSpec (it's a time canvas, not a table), but its controls
// must read identically to the lists', so it uses the same Popover rather than
// a fourth hand-rolled one. See AGENTS.md § Popover menus.
//
// Both are multi-select and ride in comma-separated URL params, so the state is
// shareable and rides in the session view state like every other list control.

export function DiaryFiltersButton({ staff }: { staff: DiaryStaff[] }) {
  const { setParams, searchParams } = useSetParams();

  const selectedStaff = (searchParams.get("staff") ?? "").split(",").filter(Boolean);
  const selectedCats = (searchParams.get("cat") ?? "").split(",").filter(Boolean);
  const activeCount = selectedStaff.length + selectedCats.length;

  const toggle = (param: string, current: string[], value: string) => {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setParams({ [param]: next.length ? next.join(",") : null });
  };

  return (
    <Popover label="Filters" icon="filters" badge={activeCount || undefined} width={280}>
      {() => (
        <div className="flex flex-col gap-3 p-3">
          <div>
            <SectionLabel>Job type</SectionLabel>
            <div className="mt-1 flex flex-col">
              {WORK_CATEGORIES.map((c) => (
                <Row
                  key={c.key}
                  label={c.label}
                  checked={selectedCats.includes(c.key)}
                  onToggle={() => toggle("cat", selectedCats, c.key)}
                  swatch={c.bg}
                />
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Staff</SectionLabel>
            <div className="mt-1 flex flex-col">
              {staff.length === 0 && (
                <p className="px-1 py-2 text-[12px] text-[#a1a1aa]">No active staff.</p>
              )}
              {staff.map((s) => (
                <Row
                  key={s.id}
                  label={s.name}
                  hint={s.role}
                  checked={selectedStaff.includes(s.id)}
                  onToggle={() => toggle("staff", selectedStaff, s.id)}
                />
              ))}
            </div>
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => setParams({ staff: null, cat: null })}
              className="self-start text-[12px] font-semibold text-[var(--accent-blue)]"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </Popover>
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
