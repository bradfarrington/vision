"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setAppointmentNotes } from "@/app/(app)/diary/actions";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The comment on an appointment — "gate code 4821", "ring on arrival, dog in
// the garden", "second fix only".
//
// It was already stored (`appointments.notes`, set in the booking dialog) and
// already displayed on the lead's Appointments card and the contract's Fitting
// tab, but there was no way to ADD one from either — you had to reopen the
// whole booking. That's the difference between a field that exists and a field
// people use, and it matters here because the comment is the thing the person
// going most needs to read.
//
// Inline, click-to-edit, like every other field in the CRM (§ Customer record
// & inline editing) rather than a dialog for one line of text.
// ---------------------------------------------------------------------------

export function AppointmentComment({
  id,
  value,
  className,
  placeholder = "Add a comment…",
}: {
  id: string;
  value: string | null;
  className?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    const next = draft.trim();
    if (next === (value ?? "").trim()) {
      setEditing(false);
      return;
    }
    start(async () => {
      const res = await setAppointmentNotes(id, next);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value ?? "");
          setEditing(true);
        }}
        // `w-full max-w-full` is load-bearing: a <button> SHRINK-TO-FITS its
        // content, so `min-w-0` can't hold it — a long unbroken comment made
        // the button wider than its table cell and printed straight over the
        // columns to its right. Width from the cell, then clamp inside it.
        className={cn(
          "group flex w-full max-w-full min-w-0 items-start gap-1 text-left",
          value ? "text-[#71717a]" : "text-[#a1a1aa]",
          className,
        )}
      >
        <Icon
          name="message"
          size={11}
          strokeWidth={1.9}
          className="mt-[2px] shrink-0 opacity-0 transition-opacity group-hover:opacity-70"
        />
        {/* `break-words` matters as much as the clamp: a run of text with no
            spaces (a pasted reference, a URL) cannot wrap without it, so it
            would be clipped mid-character instead of reading as two lines. */}
        <span
          className={cn("min-w-0 flex-1", value ? "line-clamp-2 break-words" : "italic")}
        >
          {value || placeholder}
        </span>
      </button>
    );
  }

  return (
    <span className={cn("flex min-w-0 flex-col gap-1", className)}>
      <textarea
        autoFocus
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Enter saves, Shift+Enter is a new line, Escape abandons — the same
          // keys the notes composer uses.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={save}
        placeholder={placeholder}
        className="w-full rounded-md border border-[#d4d4d8] px-2 py-1 text-[11.5px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
      />
      {pending && <span className="text-[10.5px] text-[#a1a1aa]">Saving…</span>}
      {error && <span className="text-[10.5px] font-medium text-[#d64545]">{error}</span>}
    </span>
  );
}
