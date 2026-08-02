"use client";

import { loadBoardColumn, moveLeadToStage } from "@/app/(app)/leads/actions";
import { leadStage } from "@/lib/leads";
import { Board, type BoardColumnData, type BoardSpec } from "@/components/crm/board";
import type { LeadFilters, LeadRow } from "@/lib/data/leads";

// The leads kanban = a BoardSpec fed to the shared board in `board.tsx` (drag +
// optimistic move, per-column infinite scroll, fixed-height columns, the
// drag-vs-click threshold). Only what makes this board ABOUT LEADS lives here.

const LEADS_BOARD: BoardSpec<LeadRow, LeadFilters> = {
  name: "leads",
  stageOf: (l) => l.status ?? "new",
  withStage: (l, stage) => ({ ...l, status: stage }),
  resolveStage: leadStage,
  rowHref: (l) => `/leads/${l.id}`,
  defaultStage: "new",
  noun: "lead",
  loadColumn: loadBoardColumn,
  moveToStage: moveLeadToStage,
};

export function LeadBoard({
  columns,
  filters,
}: {
  columns: BoardColumnData<LeadRow>[];
  filters: LeadFilters;
}) {
  return <Board spec={LEADS_BOARD} columns={columns} filters={filters} />;
}
