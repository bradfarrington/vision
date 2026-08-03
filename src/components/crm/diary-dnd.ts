"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { moveBooking } from "@/app/(app)/diary/actions";
import { suitsCategory } from "@/lib/appointments";
import { useDialogs } from "./dialogs";
import type { MenuTarget } from "./appointment-menu";
import type { BookingSeed } from "./booking-dialog";
import type { DiaryEvent } from "@/lib/data/appointments";
import type { DiaryStaff } from "@/lib/data/staff";

// ---------------------------------------------------------------------------
// Moving a job around the diary, shared by the day grid and the week grid.
//
// The two layouts are different enough that they each own their own droppables
// — a day cell is (person, time), a week cell is (person, half-day) — but
// everything that happens AFTER the drop is identical, and that's the part
// worth having one copy of: the suitability check, the optimistic move, the
// revert, and the right-click menu's state.
// ---------------------------------------------------------------------------

export function useDiaryMoves({
  initial,
  staff,
}: {
  initial: DiaryEvent[];
  staff: DiaryStaff[];
}) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const [events, setEvents] = useState(initial);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [seed, setSeed] = useState<BookingSeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startMove] = useTransition();

  /** Open the booking dialog on an existing appointment. */
  const edit = useCallback((e: DiaryEvent) => {
    setSeed({
      id: e.id,
      startsAt: new Date(e.startsAt),
      duration: e.duration ?? 60,
      type: e.type,
      title: e.title,
      notes: e.notes,
      staffIds: e.staffIds,
      status: e.status,
      leadId: e.leadId,
      contractId: e.contractId,
      customerId: e.customerId,
    });
  }, []);

  /**
   * Drop a job on someone, at a time.
   *
   * `staffId` null means the Unassigned column — dropping there deliberately
   * takes everybody off it, which is how you hand a job back to be re-allocated.
   */
  const move = useCallback(
    async (id: string, startsAt: Date, staffId: string | null) => {
      const job = events.find((e) => e.id === id);
      if (!job) return;

      const nextStaff = staffId ? [staffId] : [];
      const sameTime = +new Date(job.startsAt) === +startsAt;
      const sameStaff = job.staffIds.join(",") === nextStaff.join(",");
      if (sameTime && sameStaff) return;

      // Is it their kind of work? A WARNING, not a wall — see the note on
      // suitsCategory. The message names the mismatch rather than saying "not
      // allowed", because the person dragging usually knows something we don't.
      const person = staffId ? staff.find((s) => s.id === staffId) : null;
      if (person && !suitsCategory(person.role, job.category)) {
        const ok = await confirm({
          title: `Put this on ${person.name}?`,
          message: `${person.name} is ${article(person.role)} and this is ${article(job.category)} job. That may be exactly right — the diary just doesn't know it. Nothing else changes.`,
          confirmLabel: "Assign anyway",
          tone: "warning",
        });
        if (!ok) return;
      }

      // Optimistic: the block lands where you dropped it immediately. A job
      // that hangs in its old slot until a round-trip finishes reads as broken.
      const before = events;
      setEvents((list) =>
        list.map((e) =>
          e.id === id
            ? {
                ...e,
                startsAt: startsAt.toISOString(),
                staffIds: nextStaff,
                staffNames: person ? [person.name] : [],
              }
            : e,
        ),
      );
      setError(null);

      startMove(async () => {
        const res = await moveBooking(id, startsAt.toISOString(), nextStaff);
        if (res.error) {
          setEvents(before);
          setError(res.error);
          return;
        }
        router.refresh();
      });
    },
    [events, staff, confirm, router],
  );

  return { events, move, menu, setMenu, seed, setSeed, edit, error, setError };
}

/** "an installer" / "a surveyor" — small, but it's the difference between a
 *  sentence and a slug in a message someone reads mid-drag. */
function article(word: string | null | undefined): string {
  const w = (word ?? "").toLowerCase().trim() || "unassigned";
  return /^[aeiou]/.test(w) ? `an ${w}` : `a ${w}`;
}
