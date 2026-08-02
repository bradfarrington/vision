"use client";

import { useTransition } from "react";

import { setContractStage, toggleContractChecklistItem } from "@/app/(app)/contracts/actions";
import { CONTRACT_STAGES, contractStage, stageIndex, STEPPER_STAGES } from "@/lib/contracts";
import { STAGE_TONE_CLASS } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The stage badge in the contract-detail header, made interactive: pick a stage
// to move the job along. Backed by the setContractStage server action, which
// also stamps that stage's date the first time it is reached.
export function ContractStageChanger({
  contractId,
  stage: raw,
}: {
  contractId: string;
  stage: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const stage = contractStage(raw);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] text-[11px] font-semibold",
          STAGE_TONE_CLASS[stage.tone],
          pending && "opacity-60",
        )}
      >
        {stage.tone === "neutral" && <span className="size-1.5 rounded-full bg-[#71717a]" />}
        {stage.label}
        <Icon name="chevron-down" size={11} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {CONTRACT_STAGES.map((s) => (
          <DropdownMenuItem
            key={s.key}
            onClick={() =>
              startTransition(() => {
                void setContractStage(contractId, s.key);
              })
            }
            className={s.key === stage.key ? "font-semibold" : ""}
          >
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The stage STEPPER across the top of the contract record (design screen 05):
 * Signed → Survey → Ordered → Delivery → Installation → Complete, each with the
 * date it was reached. Steps before the current one are done (ticked), the
 * current one is filled, later ones are outlines.
 *
 * Every step is CLICKABLE — the stepper is the natural place to move a job on,
 * so it does the same job as the header's dropdown rather than being a picture
 * of the state next to the only control that changes it.
 */
export function StageStepper({
  contractId,
  stage: raw,
  dates,
}: {
  contractId: string;
  stage: string | null;
  /** Stage key → the date it was reached, already formatted for display. */
  dates: Record<string, string | null>;
}) {
  const [pending, startTransition] = useTransition();
  const current = stageIndex(raw);
  const cancelled = contractStage(raw).key === "cancelled";

  return (
    <div
      className={cn(
        "flex flex-wrap items-stretch gap-1.5 rounded-xl border border-[#e7e7ea] bg-white p-2",
        pending && "opacity-60",
      )}
    >
      {STEPPER_STAGES.map((s, i) => {
        // A cancelled contract has no position in the stepper, so nothing reads
        // as reached — the header badge carries the cancellation instead.
        const done = !cancelled && i < current;
        const active = !cancelled && i === current;
        const date = dates[s.key];
        return (
          <button
            key={s.key}
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                void setContractStage(contractId, s.key);
              })
            }
            className={cn(
              "flex min-w-[128px] flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors",
              active
                ? "bg-[var(--accent-tint)] ring-1 ring-inset ring-[var(--accent-blue)]"
                : "hover:bg-[#fafafa]",
            )}
          >
            <span
              className={cn(
                "flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                done
                  ? "bg-[#1a7f3e] text-white"
                  : active
                    ? "bg-[var(--accent-blue)] text-white"
                    : "border-[1.5px] border-[#d4d4d8] bg-white text-[#a1a1aa]",
              )}
            >
              {done ? <Icon name="check" size={10} strokeWidth={3} /> : i + 1}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate text-[12px]",
                  done || active ? "font-semibold text-[#0a0a0a]" : "text-[#71717a]",
                )}
              >
                {s.label}
              </span>
              {date && <span className="block truncate text-[10.5px] text-[#a1a1aa]">{date}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A single contract checklist row with a tickable checkbox. */
export function ContractChecklistToggle({
  itemId,
  contractId,
  done,
}: {
  itemId: number;
  contractId: string;
  done: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          void toggleContractChecklistItem(itemId, contractId, !done);
        })
      }
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[5px]",
        done ? "bg-[#1a7f3e]" : "border-[1.5px] border-[#d4d4d8] bg-white",
        pending && "opacity-60",
      )}
      aria-label={done ? "Mark as not done" : "Mark as done"}
    >
      {done && <Icon name="check" size={11} strokeWidth={3} className="text-white" />}
    </button>
  );
}
