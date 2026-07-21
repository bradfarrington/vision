"use client";

import { useState, useTransition } from "react";

import { addLeadNote, setLeadStage, toggleChecklistItem } from "@/app/(app)/leads/actions";
import { LEAD_STAGES, leadStage, STAGE_TONE_CLASS } from "@/lib/leads";
import { Icon } from "./icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The stage badge in the lead-detail header, made interactive: pick a stage to
// move the lead through the pipeline. Backed by the setLeadStage server action.
export function StageChanger({
  leadId,
  status,
}: {
  leadId: string;
  status: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const stage = leadStage(status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] text-[11px] font-semibold ${STAGE_TONE_CLASS[stage.tone]} ${pending ? "opacity-60" : ""}`}
      >
        {stage.tone === "neutral" && <span className="size-1.5 rounded-full bg-[#71717a]" />}
        {stage.label}
        <Icon name="chevron-down" size={11} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {LEAD_STAGES.map((s) => (
          <DropdownMenuItem
            key={s.key}
            onClick={() =>
              startTransition(() => {
                void setLeadStage(leadId, s.key);
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

// A compact note composer for the lead-detail Notes panel.
export function NoteComposer({ leadId }: { leadId: string }) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    startTransition(() => {
      void addLeadNote(leadId, text);
      setValue("");
    });
  };

  return (
    <div className="mt-2 flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="Add a note…"
        className="w-full resize-y rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[12.5px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending || !value.trim()}
        className="self-start rounded-md bg-[var(--accent-blue)] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add note"}
      </button>
    </div>
  );
}

// A single checklist row with a tickable checkbox.
export function ChecklistToggle({
  itemId,
  leadId,
  done,
}: {
  itemId: number;
  leadId: string;
  done: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          void toggleChecklistItem(itemId, leadId, !done);
        })
      }
      className={`flex size-4 shrink-0 items-center justify-center rounded-[5px] ${
        done ? "bg-[#1a7f3e]" : "border-[1.5px] border-[#d4d4d8] bg-white"
      } ${pending ? "opacity-60" : ""}`}
      aria-label={done ? "Mark as not done" : "Mark as done"}
    >
      {done && <Icon name="check" size={11} strokeWidth={3} className="text-white" />}
    </button>
  );
}
