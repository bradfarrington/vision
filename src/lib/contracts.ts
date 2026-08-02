// Contract stage model — the counterpart of `lib/leads.ts` for the job AFTER
// it is won. The stage is keyed off `contracts.stage`; `contracts.status` and
// `contract_cancelled` mark the closed outcome, exactly as `leads.result` sits
// beside `leads.status`.
//
// Stages are transcribed from the design's stepper (screen 05 "Contract
// detail"): Signed → Survey → Ordered → Delivery → Installation → Complete.
// Tones reuse the SAME canonical badge palette as leads (see AGENTS.md § Phase
// 4) via `StageTone`, so a stage badge reads identically wherever it appears.

import type { StageTone } from "@/lib/leads";

export type ContractStage = {
  /** DB value stored in `contracts.stage`. */
  key: string;
  /** Human label for badges + board column headers. */
  label: string;
  /** Visual treatment for the badge — shared with the lead stage badges. */
  tone: StageTone;
  /** A contract in this stage is still in flight (counts toward "open"). */
  open: boolean;
  /**
   * The column on `contracts` holding the date this stage was reached, or null
   * where the stage has no date of its own. Drives the stepper's sub-labels.
   * Signed reads `contract_date`, which predates this model.
   */
  dateColumn: string | null;
};

// Stepper order, left → right. `stage` strings map straight to these keys.
export const CONTRACT_STAGES: ContractStage[] = [
  { key: "signed", label: "Signed", tone: "neutral", open: true, dateColumn: "contract_date" },
  { key: "survey", label: "Survey", tone: "neutral", open: true, dateColumn: "survey_date" },
  { key: "ordered", label: "Ordered", tone: "outline", open: true, dateColumn: "order_date" },
  // Delivery has no contract-level date: delivery_lines carries its own
  // per-line due dates, and a single date here would disagree with them.
  { key: "delivery", label: "Delivery", tone: "outline", open: true, dateColumn: null },
  { key: "installation", label: "Installation", tone: "dark", open: true, dateColumn: "install_start_date" },
  { key: "complete", label: "Complete", tone: "success", open: false, dateColumn: "completed_date" },
  { key: "cancelled", label: "Cancelled", tone: "danger", open: false, dateColumn: "cancel_date" },
];

const STAGE_BY_KEY = new Map(CONTRACT_STAGES.map((s) => [s.key, s]));

/**
 * The stages shown as the stepper / KPI buckets. Excludes cancelled for the
 * same reason PIPELINE_STAGES excludes lost: it is not a step on the way to
 * anywhere, it is where a job stops. The BOARD still iterates the full
 * CONTRACT_STAGES, because a kanban must have somewhere to drop every state.
 */
export const STEPPER_STAGES = CONTRACT_STAGES.filter((s) => s.key !== "cancelled");

/** Resolve a `contracts.stage` value to its stage, tolerating unknown strings. */
export function contractStage(stage: string | null | undefined): ContractStage {
  if (stage && STAGE_BY_KEY.has(stage)) return STAGE_BY_KEY.get(stage)!;
  // Unknown/legacy stage → show it verbatim as a neutral, open stage, the same
  // fallback leadStage() uses. Never render a raw snake_case value.
  return {
    key: stage ?? "signed",
    label: stage ? titleCase(stage) : "Signed",
    tone: "neutral",
    open: true,
    dateColumn: null,
  };
}

/** True while the contract is still in flight (not complete/cancelled). */
export function isOpenContract(stage: string | null | undefined): boolean {
  return contractStage(stage).open;
}

/** Zero-based position in the stepper, for rendering steps as done/current/todo. */
export function stageIndex(stage: string | null | undefined): number {
  return STEPPER_STAGES.findIndex((s) => s.key === contractStage(stage).key);
}

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
