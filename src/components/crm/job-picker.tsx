"use client";

import { useEffect, useRef, useState } from "react";

import { findJobs } from "@/app/(app)/diary/actions";
import type { JobOption } from "@/lib/data/jobs";
import { Combo } from "./combo";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// "Which job is this for?" — the contract or lead an appointment belongs to.
//
// SEARCHES THE SERVER as you type rather than filtering a preloaded list. A
// firm with 4,000 contracts is exactly where a capped client-side list goes
// silently wrong (AGENTS.md § Capture first, match second — the 500-name
// customer picker was deleted for that), and this list can only grow.
//
// The SCOPE toggle is the point of the control: a booking is almost always for
// work still to do, so "Open" — live leads and contracts still in flight — is
// the default and keeps the list short. "All" reaches back for the finished job
// that needs a remedial visit, which is a real errand and the only reason to
// show hundreds of completed contracts.
//
// It's the shared `Combo`, not a bespoke menu: same trigger, same search box,
// same fixed-positioned menu that can't be clipped by the dialog.
// ---------------------------------------------------------------------------

export type JobLink = {
  kind: "contract" | "lead";
  id: string;
  customerId: string | null;
};

/** `contract:<uuid>` — the value a Combo option carries. */
function encode(j: JobOption): string {
  return `${j.kind}:${j.id}`;
}

/**
 * "C-1892 · Margaret Ellison — Windows & doors (Signed)". One line, because a
 * Combo row is one line: reference first (it's the identity you'd quote), then
 * who it's for, then what it is.
 */
function describe(j: JobOption): string {
  const parts = [j.ref];
  if (j.customerName) parts.push(j.customerName);
  const head = parts.join(" · ");
  return `${head} — ${j.title}${j.stageLabel ? ` (${j.stageLabel})` : ""}`;
}

export function JobPicker({
  value,
  onChange,
}: {
  value: JobLink | null;
  onChange: (link: JobLink | null) => void;
}) {
  const [scope, setScope] = useState<"open" | "all">("open");
  const [options, setOptions] = useState<JobOption[]>([]);
  const [loading, setLoading] = useState(false);
  // The chosen job's row survives a later search that doesn't return it, so the
  // trigger keeps reading "C-1892 · …" instead of falling back to a raw id.
  const [chosen, setChosen] = useState<JobOption | null>(null);
  const seq = useRef(0);

  const run = (query: string, forScope: "open" | "all") => {
    const mine = ++seq.current;
    setLoading(true);
    findJobs({ query, scope: forScope })
      .then((rows) => {
        // Out-of-order responses: only the newest query may paint.
        if (mine !== seq.current) return;
        setOptions(rows);
        setLoading(false);
      })
      .catch(() => {
        if (mine !== seq.current) return;
        // Fails soft — the appointment can be booked unlinked and joined up
        // afterwards; losing the booking over a lookup would be worse.
        setOptions([]);
        setLoading(false);
      });
  };

  // Debounced, like the wizard's duplicate matcher: a query per keystroke would
  // be a query per keystroke.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const search = (query: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(query, scope), 250);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const rows = chosen && !options.some((o) => o.id === chosen.id) ? [chosen, ...options] : options;

  return (
    <div className="flex flex-col gap-1.5">
      <Combo
        options={rows.map((j) => ({ id: j.id, value: encode(j), label: describe(j) }))}
        value={value ? `${value.kind}:${value.id}` : null}
        onChange={(v) => {
          if (!v) {
            setChosen(null);
            onChange(null);
            return;
          }
          const job = rows.find((j) => encode(j) === v) ?? null;
          setChosen(job);
          const [kind, id] = v.split(":");
          onChange(
            kind === "contract" || kind === "lead"
              ? { kind, id, customerId: job?.customerId ?? null }
              : null,
          );
        }}
        onSearch={search}
        loading={loading}
        placeholder="Not linked — pick a contract or lead…"
        searchPlaceholder="Search by reference, customer or product…"
        emptyLabel={
          scope === "open"
            ? "Nothing open matches — try All jobs."
            : "No contracts or leads match."
        }
      />

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-[#a1a1aa]">Show</span>
        {(
          [
            { key: "open" as const, label: "Open jobs" },
            { key: "all" as const, label: "All jobs" },
          ]
        ).map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              setScope(s.key);
              // Re-ask immediately — the toggle IS a search, so waiting for the
              // next keystroke would look like it had done nothing.
              run("", s.key);
            }}
            className={cn(
              "rounded-md border px-2 py-[3px] text-[11px] font-medium transition-colors",
              scope === s.key
                ? "border-[var(--accent-blue)] bg-[var(--accent-tint)] text-[var(--accent-active)]"
                : "border-[#e7e7ea] bg-white text-[#71717a] hover:bg-[#fafafa]",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
