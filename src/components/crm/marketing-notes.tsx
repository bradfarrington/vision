"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addMarketingNote, deleteMarketingNote } from "@/app/(app)/customers/actions";
import type { MarketingNote } from "@/lib/data/customer-record";

// Marketing notes thread: an inline composer plus stamped entries (author + date).
export function MarketingNotes({
  customerId,
  notes,
}: {
  customerId: string;
  notes: MarketingNote[];
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function add() {
    const text = value.trim();
    if (!text) return;
    setError(null);
    start(async () => {
      const res = await addMarketingNote(customerId, text);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setValue("");
      router.refresh();
    });
  }

  return (
    <div className="mt-3">
      <div className="mb-2 text-[12px] font-medium text-[#52525b]">Marketing notes</div>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="Add a note…"
        className="w-full resize-y rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[12.5px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
      />
      {error && <p className="mt-1 text-[11px] font-medium text-[#d64545]">{error}</p>}
      <div className="mt-1.5">
        <button
          type="button"
          onClick={add}
          disabled={pending || !value.trim()}
          className="rounded-md bg-[var(--accent-blue)] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add note"}
        </button>
      </div>

      <div className="mt-3 flex flex-col">
        {notes.length === 0 ? (
          <p className="py-1 text-[12px] text-[#71717a]">No marketing notes yet.</p>
        ) : (
          notes.map((n, i) => (
            <div
              key={n.id}
              className={`group py-2.5 ${i < notes.length - 1 ? "border-b border-[#f4f4f5]" : ""}`}
            >
              <p className="text-[12.5px] text-[#3f3f46]">{n.content}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[11px] text-[#a1a1aa]">
                  {n.author ?? "—"} · {fmt(n.created_at)}
                </span>
                <NoteRemove customerId={customerId} noteId={n.id} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NoteRemove({ customerId, noteId }: { customerId: string; noteId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deleteMarketingNote(customerId, noteId);
          router.refresh();
        })
      }
      className="text-[11px] font-semibold text-[#d64545] opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
    >
      Remove
    </button>
  );
}

function fmt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
