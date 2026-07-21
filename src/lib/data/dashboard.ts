import { createClient } from "@/lib/supabase/server";
import { isLiveLead } from "@/lib/leads";

export type SourceStat = { source: string; count: number; pct: number };
export type TeamStat = { name: string; revenue: number; leads: number; won: number; lost: number };
export type DiaryItem = {
  id: string;
  time: string | null;
  label: string;
  tone: "accent" | "amber" | "success" | "neutral";
};

export type Dashboard = {
  revenue: number;
  dealsWon: number;
  pipelineValue: number;
  liveCount: number;
  winRate: number | null;
  totalLeads: number;
  pipeline: { key: string; count: number; value: number }[];
  sources: SourceStat[];
  team: TeamStat[];
  diary: DiaryItem[];
};

type LeadAgg = {
  status: string | null;
  result: string | null;
  gross_value: number | null;
  estimated_value: number | null;
  source: string | null;
  salesman: string | null;
};

/** Live dashboard aggregates for the tenant (RLS-scoped). */
export async function getDashboard(): Promise<Dashboard> {
  const supabase = await createClient();

  const [{ data: leadsData, error }, diary] = await Promise.all([
    supabase
      .from("leads")
      .select("status, result, gross_value, estimated_value, source, salesman"),
    getTodaysDiary(supabase),
  ]);
  if (error) throw new Error(`getDashboard: ${error.message}`);

  const leads = (leadsData ?? []) as LeadAgg[];
  const valueOf = (l: LeadAgg) => Number(l.gross_value ?? l.estimated_value ?? 0);
  const isWon = (l: LeadAgg) => l.status === "won" || l.result === "won";
  const isLost = (l: LeadAgg) => l.status === "lost" || l.result === "lost";

  let revenue = 0;
  let dealsWon = 0;
  let pipelineValue = 0;
  let liveCount = 0;
  let wonCount = 0;
  let lostCount = 0;

  const sourceMap = new Map<string, number>();
  const teamMap = new Map<string, TeamStat>();
  const stageMap = new Map<string, { key: string; count: number; value: number }>();

  for (const l of leads) {
    const v = valueOf(l);
    if (isWon(l)) {
      revenue += v;
      dealsWon += 1;
      wonCount += 1;
    } else if (isLost(l)) {
      lostCount += 1;
    }
    if (isLiveLead(l.status)) {
      pipelineValue += v;
      liveCount += 1;
    }

    if (l.source) sourceMap.set(l.source, (sourceMap.get(l.source) ?? 0) + 1);

    if (l.salesman) {
      const t = teamMap.get(l.salesman) ?? { name: l.salesman, revenue: 0, leads: 0, won: 0, lost: 0 };
      t.leads += 1;
      if (isWon(l)) {
        t.revenue += v;
        t.won += 1;
      } else if (isLost(l)) {
        t.lost += 1;
      }
      teamMap.set(l.salesman, t);
    }

    const key = l.status ?? "new";
    const s = stageMap.get(key) ?? { key, count: 0, value: 0 };
    s.count += 1;
    s.value += v;
    stageMap.set(key, s);
  }

  const totalSourced = [...sourceMap.values()].reduce((a, b) => a + b, 0) || 1;
  const sources: SourceStat[] = [...sourceMap.entries()]
    .map(([source, count]) => ({ source, count, pct: Math.round((count / totalSourced) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const team = [...teamMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 4);

  const decided = wonCount + lostCount;
  const winRate = decided > 0 ? Math.round((wonCount / decided) * 100) : null;

  return {
    revenue,
    dealsWon,
    pipelineValue,
    liveCount,
    winRate,
    totalLeads: leads.length,
    pipeline: [...stageMap.values()],
    sources,
    team,
    diary,
  };
}

// Today's diary from fitting_appointments (`date` is stored as a YYYY-MM-DD
// text column). Colour-codes by work type per the design's diary legend.
async function getTodaysDiary(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<DiaryItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("fitting_appointments")
    .select("id, date, time, work_type, description")
    .eq("date", today)
    .order("time");

  return (data ?? []).map((a) => ({
    id: a.id,
    time: a.time ?? null,
    label: a.description ?? formatWorkType(a.work_type),
    tone: toneForWork(a.work_type),
  }));
}

function formatWorkType(t: string | null): string {
  if (!t) return "Appointment";
  return t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ");
}

function toneForWork(t: string | null): DiaryItem["tone"] {
  const s = (t ?? "").toLowerCase();
  if (s.includes("survey")) return "amber";
  if (s.includes("service")) return "success";
  if (s.includes("fit") || s.includes("install")) return "accent";
  return "neutral";
}
