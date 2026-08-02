"use server";

import { findSlots, type SlotRequest, type SlotSuggestion } from "@/lib/data/availability";

/** Search the diary for windows where the whole team is free. */
export async function searchSlots(req: SlotRequest): Promise<SlotSuggestion[]> {
  try {
    return await findSlots(req);
  } catch {
    // Availability is an assist. A failure here must return "no slots" rather
    // than taking the screen down — and it must never return a WRONG slot,
    // which is why this catches rather than falling back to something naive.
    return [];
  }
}
