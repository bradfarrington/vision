// Lead pipeline stage + status model. The pipeline stage is keyed off
// `leads.status`; `leads.result` marks the closed outcome (alive/won/lost).
// Badge geometry + palette are transcribed from the Vision design system block
// (see AGENTS.md § Phase 4). Semantic colours are platform-fixed; only the
// accent tone rebrands per tenant.

export type StageTone = "neutral" | "outline" | "dark" | "success" | "danger" | "amber";

export type LeadStage = {
  /** DB value stored in `leads.status`. */
  key: string;
  /** Human label for badges + pipeline headers. */
  label: string;
  /** Visual treatment for the badge. */
  tone: StageTone;
  /** A lead in this stage is still open (counts toward "live"). */
  live: boolean;
};

// Pipeline order, left → right. `status` strings map straight to these keys.
export const LEAD_STAGES: LeadStage[] = [
  { key: "new", label: "New", tone: "neutral", live: true },
  { key: "contacted", label: "Contacted", tone: "neutral", live: true },
  { key: "survey_booked", label: "Survey booked", tone: "outline", live: true },
  { key: "quoted", label: "Quoted", tone: "dark", live: true },
  { key: "won", label: "Won", tone: "success", live: false },
  { key: "lost", label: "Lost", tone: "danger", live: false },
];

const STAGE_BY_KEY = new Map(LEAD_STAGES.map((s) => [s.key, s]));

/** The pipeline stages shown as columns / KPI buckets (excludes lost). */
export const PIPELINE_STAGES = LEAD_STAGES.filter((s) => s.key !== "lost");

/** Resolve a `leads.status` value to its stage, tolerating unknown strings. */
export function leadStage(status: string | null | undefined): LeadStage {
  if (status && STAGE_BY_KEY.has(status)) return STAGE_BY_KEY.get(status)!;
  // Unknown/legacy status → show it verbatim as a neutral, open stage.
  return {
    key: status ?? "new",
    label: status ? titleCase(status) : "New",
    tone: "neutral",
    live: true,
  };
}

/** True when the lead is still open (not won/lost). */
export function isLiveLead(status: string | null | undefined): boolean {
  return leadStage(status).live;
}

// Tailwind class strings per tone — mirrors the design's exact hex values so
// badges read identically to the handoff.
export const STAGE_TONE_CLASS: Record<StageTone, string> = {
  neutral: "bg-[#f4f4f5] text-[#3f3f46]",
  outline: "border border-[#e7e7ea] bg-white text-[#3f3f46]",
  dark: "bg-[#18181b] text-white",
  success: "bg-[#e7f4ec] text-[#1a7f3e]",
  danger: "bg-[#fdecec] text-[#d64545]",
  amber: "bg-[#fdf2dc] text-[#b86e00]",
};

/** Human reference for a lead: L-2417. */
export function leadRef(leadNumber: number | null | undefined): string {
  return leadNumber != null ? `L-${leadNumber}` : "L-—";
}

/** Human reference for a contract: C-1892. */
export function contractRef(contractNumber: number | null | undefined): string {
  return contractNumber != null ? `C-${contractNumber}` : "C-—";
}

/** Human reference for a document: D-104. */
export function documentRef(documentNumber: number | null | undefined): string {
  return documentNumber != null ? `D-${documentNumber}` : "D-—";
}

/** Human reference for a note: N-18. */
export function noteRef(noteNumber: number | null | undefined): string {
  return noteNumber != null ? `N-${noteNumber}` : "N-—";
}

function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
