"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { moveBooking } from "@/app/(app)/diary/actions";
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
// worth having one copy of: the optimistic move, the revert, and the
// right-click menu's state. (Suitability is enforced on the way DOWN, by the
// grids — an unsuitable column isn't a drop target at all.)
// ---------------------------------------------------------------------------

export function useDiaryMoves({
  initial,
  staff,
}: {
  initial: DiaryEvent[];
  staff: DiaryStaff[];
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initial);

  // The local list is ONLY ever ahead of the server for the length of a drag.
  // The moment the server sends a new one — after a move lands, after the
  // booking dialog saves an edit, after any `router.refresh()` — that becomes
  // the truth and the optimistic copy is thrown away.
  //
  // Without this the state silently outlived its data: editing an appointment's
  // time in the dialog wrote to the database and refreshed the page, and the
  // diary carried on drawing the old time because it was rendering from a list
  // captured before the edit.
  const [rendered, setRendered] = useState(initial);
  if (rendered !== initial) {
    setRendered(initial);
    setEvents(initial);
  }
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

      // Suitability is enforced by the GRIDS, not here: a column that can't
      // take the job is a disabled droppable drawn red-dashed, so an invalid
      // move never reaches this. A confirm at this point would be a second,
      // quieter answer to a question already answered on the way down.
      const person = staffId ? staff.find((s) => s.id === staffId) : null;

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
    [events, staff, router],
  );

  return { events, move, menu, setMenu, seed, setSeed, edit, error, setError };
}
