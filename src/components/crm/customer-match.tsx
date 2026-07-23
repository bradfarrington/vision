"use client";

import { useEffect, useState } from "react";

import { findCustomerMatches } from "@/app/(app)/leads/actions";
import type { CustomerMatch, MatchCriteria } from "@/lib/data/customer-match";
import { customerRef } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { Avatar, RefChip } from "./primitives";
import { Icon } from "./icon";

// ---------------------------------------------------------------------------
// "Do we already know them?" — the matching half of the lead capture step.
//
// It suggests, it never decides. Linking is always a click, because two
// different Smiths in the same town are a real thing and merging them is
// unrecoverable. Each candidate says WHY it matched so the person on the phone
// can judge it — "Same mobile" is proof, "Same surname" is a coincidence.
// ---------------------------------------------------------------------------

/** How long the typing has to settle before we go looking. */
const DEBOUNCE_MS = 400;

/**
 * Debounced candidate lookup. The matches are owned by the FORM, not the panel,
 * because the review step needs them too — that is where "you're about to
 * create a second Margaret Ellison" has to be caught.
 */
export function useCustomerMatches(criteria: MatchCriteria, enabled: boolean) {
  const [state, setState] = useState<{ matches: CustomerMatch[]; searching: boolean }>({
    matches: [],
    searching: false,
  });
  // Serialised so the effect re-runs on VALUE change, not on the new object
  // identity a parent render produces on every keystroke.
  const key = JSON.stringify(criteria);
  // Derived, not state: "nothing worth searching on yet" is a property of what
  // has been typed, so it needs no effect to maintain.
  const active = enabled && worthAsking(criteria);

  useEffect(() => {
    if (!active) return;
    // Only the newest lookup may write state — a slow earlier one must not land
    // on top of results for details that have since changed.
    let cancelled = false;
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, searching: true }));
      const found = await findCustomerMatches(JSON.parse(key) as MatchCriteria);
      if (cancelled) return;
      setState({ matches: found, searching: false });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, active]);

  return active ? state : EMPTY;
}

const EMPTY = { matches: [] as CustomerMatch[], searching: false };

/** Enough of a signal to be worth a query — a bare first name is not one. */
function worthAsking(c: MatchCriteria): boolean {
  return (
    (c.lastName ?? "").trim().length >= 2 ||
    (c.companyName ?? "").trim().length >= 3 ||
    (c.email ?? "").includes("@") ||
    digits(c.mobile) >= 9 ||
    digits(c.homeTelephone) >= 9 ||
    (c.postcode ?? "").replace(/[^a-z0-9]/gi, "").length >= 5
  );
}

export function CustomerMatchPanel({
  matches,
  searching,
  linked,
  onLink,
  onUnlink,
}: {
  matches: CustomerMatch[];
  searching: boolean;
  linked: CustomerMatch | null;
  onLink: (m: CustomerMatch) => void;
  onUnlink: () => void;
}) {
  if (linked) return <LinkedBanner match={linked} onUnlink={onUnlink} />;

  if (matches.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#e7e7ea] bg-[#fafafa] px-3.5 py-2.5 text-[12.5px] text-[#a1a1aa]">
        {searching
          ? "Checking the customer book…"
          : "No match yet — a new customer will be created from these details."}
      </div>
    );
  }

  const strong = matches.some((m) => m.strength === "strong");

  return (
    <div className="overflow-hidden rounded-lg border border-[#e7e7ea] bg-white">
      <div className="flex items-center gap-2 border-b border-[#f4f4f5] bg-[#fafafa] px-3.5 py-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#71717a]">
          {strong ? "We may already have them" : "Possible matches"}
        </span>
        <span className="ml-auto text-[11.5px] text-[#a1a1aa]">
          {matches.length} {matches.length === 1 ? "match" : "matches"}
        </span>
      </div>
      <ul className="divide-y divide-[#f4f4f5]">
        {matches.map((m) => (
          <MatchRow key={m.id} match={m} onLink={() => onLink(m)} />
        ))}
      </ul>
      <div className="border-t border-[#f4f4f5] bg-[#fafafa] px-3.5 py-2 text-[11.5px] text-[#a1a1aa]">
        None of these? Carry on — a new customer will be created from what you enter.
      </div>
    </div>
  );
}

export function MatchRow({ match, onLink }: { match: CustomerMatch; onLink: () => void }) {
  const strong = match.strength === "strong";
  const place = [match.addressLine, match.town, match.postcode].filter(Boolean).join(", ");
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      {/* The strength rule, not a badge: it colours the row's leading edge the
          way a stage rule does, without spending a line on a word. */}
      <span
        aria-hidden
        className={cn(
          "h-9 w-[3px] shrink-0 rounded-full",
          strong ? "bg-[var(--accent-blue)]" : "bg-[#e7e7ea]",
        )}
      />
      <Avatar name={match.name} size={30} tone={strong ? "accent" : "neutral"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-[#0a0a0a]">{match.name}</span>
          <RefChip className="px-1.5 py-0.5 text-[10.5px]">
            {customerRef(match.customerNumber)}
          </RefChip>
        </div>
        <div className="truncate text-[11.5px] text-[#71717a]">
          {place || "No address on file"}
          {match.leadCount > 0 && (
            <span className="text-[#a1a1aa]">
              {` · ${match.leadCount} ${match.leadCount === 1 ? "lead" : "leads"}`}
            </span>
          )}
        </div>
        {match.reasons.length > 0 && (
          <div
            className={cn(
              "mt-0.5 truncate text-[11.5px] font-semibold",
              strong ? "text-[var(--accent-blue)]" : "text-[#a1a1aa]",
            )}
          >
            {match.reasons.join(" · ")}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onLink}
        className={cn(
          "shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors",
          strong
            ? "bg-[var(--accent-blue)] text-white hover:brightness-95"
            : "border border-[#d4d4d8] bg-white text-[#3f3f46] hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]",
        )}
      >
        This is them
      </button>
    </li>
  );
}

function LinkedBanner({ match, onUnlink }: { match: CustomerMatch; onUnlink: () => void }) {
  const place = [match.addressLine, match.town, match.postcode].filter(Boolean).join(", ");
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--accent-blue)] bg-[var(--accent-tint)] px-3.5 py-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-blue)] text-white">
        <Icon name="check" size={13} strokeWidth={2.6} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-[#0a0a0a]">{match.name}</span>
          <RefChip className="px-1.5 py-0.5 text-[10.5px]">
            {customerRef(match.customerNumber)}
          </RefChip>
        </div>
        <div className="truncate text-[11.5px] text-[#71717a]">
          {place ? `${place} · ` : ""}This lead goes on their record
        </div>
      </div>
      <button
        type="button"
        onClick={onUnlink}
        className="shrink-0 text-[12px] font-semibold text-[var(--accent-blue)] hover:underline"
      >
        Not them
      </button>
    </div>
  );
}

function digits(v: string | undefined): number {
  return (v ?? "").replace(/\D/g, "").length;
}
