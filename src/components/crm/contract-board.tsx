"use client";

import { loadContractBoardColumn, moveContractToStage } from "@/app/(app)/contracts/actions";
import { contractStage } from "@/lib/contracts";
import { Board, type BoardColumnData, type BoardSpec } from "@/components/crm/board";
import type { ContractFilters, ContractRow } from "@/lib/data/contracts";

// The contracts kanban = a BoardSpec fed to the shared board in `board.tsx`,
// the second consumer after leads. Dragging a card moves the JOB along its
// stepper (Signed → Survey → Ordered → Delivery → Installation → Complete),
// stamping that stage's date the first time it is reached.

const CONTRACTS_BOARD: BoardSpec<ContractRow, ContractFilters> = {
  name: "contracts",
  stageOf: (ct) => ct.stage ?? "signed",
  withStage: (ct, stage) => ({ ...ct, stage }),
  resolveStage: contractStage,
  rowHref: (ct) => `/contracts/${ct.id}`,
  defaultStage: "signed",
  noun: "contract",
  loadColumn: loadContractBoardColumn,
  moveToStage: moveContractToStage,
};

export function ContractBoard({
  columns,
  filters,
}: {
  columns: BoardColumnData<ContractRow>[];
  filters: ContractFilters;
}) {
  return <Board spec={CONTRACTS_BOARD} columns={columns} filters={filters} />;
}
