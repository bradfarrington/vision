"use client";

import { durationLabel } from "@/lib/appointments";
import type { ListColumn } from "@/components/crm/data-list";
import type { CardFieldsSpec } from "@/components/crm/card-fields";
import type { DiaryEvent } from "@/lib/data/appointments";

// ---------------------------------------------------------------------------
// WHICH FIELDS SHOW ON A DIARY CARD — the same machine the kanban uses
// (`card-fields.tsx`), pointed at appointments instead of leads. Per user, per
// tenant: a fitter wants the site address and the access notes; the office
// wants the reference and who's on it. Neither has to win.
//
// The registry is `ListColumn<DiaryEvent>[]` because that IS the shape
// card-fields consumes — the diary has no table to share it with, but reusing
// the type means the picker, its drag-reorder and its persistence all work
// unchanged.
//
// TIME AND DURATION ARE OFF BY DEFAULT. On the day grid the block's POSITION
// says when it is and its HEIGHT says how long — printing both again inside a
// 34px box spent the whole card on what the grid already draws. They're still
// available (the week grid has no time axis, so some people will want them).
// ---------------------------------------------------------------------------

const line = (text: string | null | undefined, className: string) =>
  text ? <span className={className}>{text}</span> : null;

export const APPOINTMENT_FIELDS: ListColumn<DiaryEvent>[] = [
  {
    key: "ref",
    label: "Reference",
    group: "Job",
    w: 0,
    cardBare: true,
    cardCell: (e) =>
      line(e.contractRef ?? e.leadRef, "font-mono text-[10px] font-bold text-[#0a0a0a]"),
  },
  {
    key: "customer",
    label: "Customer",
    group: "Job",
    w: 0,
    cardBare: true,
    // Shares the reference's line: on a block two rows tall, "C-1892" and the
    // name are one fact — who the job is for — and spending two of the three
    // available lines saying it left no room for anything else.
    cardInline: true,
    cardCell: (e) => line(e.customerName, "truncate text-[11px] font-semibold"),
  },
  {
    key: "type",
    label: "Appointment type",
    group: "Job",
    w: 0,
    cardBare: true,
    cardCell: (e) => line(e.type ?? e.title, "block truncate text-[10px] text-[#52525b]"),
  },
  {
    key: "site",
    label: "Site address",
    group: "Where",
    w: 0,
    cardBare: true,
    cardCell: (e) => line(e.siteAddress, "block truncate text-[10px] text-[#52525b]"),
  },
  {
    key: "town",
    label: "Town",
    group: "Where",
    w: 0,
    cardBare: true,
    cardCell: (e) => line(e.siteTown, "block truncate text-[10px] text-[#52525b]"),
  },
  {
    key: "postcode",
    label: "Postcode",
    group: "Where",
    w: 0,
    cardBare: true,
    cardCell: (e) => line(e.sitePostcode, "block truncate text-[10px] font-medium text-[#52525b]"),
  },
  {
    key: "time",
    label: "Start time",
    group: "When",
    w: 0,
    cardBare: true,
    cardCell: (e) =>
      line(
        new Date(e.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        "text-[10px] font-bold tabular-nums text-[#0a0a0a]",
      ),
  },
  {
    key: "duration",
    label: "How long",
    group: "When",
    w: 0,
    cardBare: true,
    cardCell: (e) => line(durationLabel(e.duration), "text-[10px] text-[#71717a]"),
  },
  {
    key: "staff",
    label: "Who's going",
    group: "Job",
    w: 0,
    cardBare: true,
    cardCell: (e) =>
      line(e.staffNames.join(", ") || e.assignedTo, "block truncate text-[10px] text-[#52525b]"),
  },
  {
    key: "comments",
    label: "Comments",
    group: "Job",
    w: 0,
    cardBare: true,
    // Clamped to two lines: comments are free text and a card must not grow
    // with the data (AGENTS.md § the overview is BOUNDED BY DESIGN).
    cardCell: (e) =>
      e.notes ? (
        <span className="line-clamp-2 text-[10px] leading-tight text-[#52525b]">{e.notes}</span>
      ) : null,
  },
  {
    key: "status",
    label: "Status",
    group: "Job",
    w: 0,
    cardBare: true,
    cardCell: (e) =>
      e.status && e.status !== "confirmed" ? (
        <span className="text-[9px] font-bold uppercase tracking-[0.04em] text-[#a1a1aa]">
          {e.status}
        </span>
      ) : null,
  },
];

/** The card as it was before it was configurable, minus time and duration. */
export const DEFAULT_APPOINTMENT_FIELDS = ["ref", "customer", "type"];

export const APPOINTMENT_CARD_SPEC: CardFieldsSpec<DiaryEvent> = {
  name: "diary",
  layoutKey: "diary_card_fields",
  fields: APPOINTMENT_FIELDS,
  groupOrder: ["Job", "Where", "When"],
  defaultVisible: DEFAULT_APPOINTMENT_FIELDS,
  record: (e) => e as unknown as Record<string, unknown>,
};
