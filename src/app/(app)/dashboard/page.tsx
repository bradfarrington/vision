import { getSession } from "@/lib/company";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";

// Phase 3 dashboard: proves the themed app shell end to end. Live KPIs, pipeline
// and diary widgets land in Phase 4 — this is the frame they'll drop into.
export default async function DashboardPage() {
  const session = await getSession();
  const company = session?.company;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[26px] py-[22px]">
      <div className="flex items-center gap-3">
        <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[var(--foreground)]">
          Dashboard
        </h1>
        <Chip tone="accent">{company?.name ?? "Vision"}</Chip>
        <div className="ml-auto flex items-center gap-2.5">
          <Button variant="outline" size="lg">
            Last 90 days
          </Button>
          <Button size="lg">Edit layout</Button>
        </div>
      </div>

      <p className="max-w-2xl text-sm text-[var(--text-muted)]">
        The themed app shell is live — icon rail, topbar and content panel, all
        rebranded from{" "}
        <span className="font-medium text-[var(--foreground)]">
          {company?.name ?? "your company"}
        </span>
        &rsquo;s brand colour. Live KPIs, the pipeline and today&rsquo;s diary
        arrive in Phase 4.
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_PLACEHOLDERS.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1.5 rounded-xl border border-[var(--hairline)] bg-card p-4 shadow-[0_1px_3px_rgba(16,20,24,0.06)]"
          >
            <span className="text-[12.5px] font-medium text-[var(--text-muted)]">
              {stat.label}
            </span>
            <span className="font-[family-name:var(--font-inter-tight)] text-[26px] font-extrabold tracking-[-0.01em] text-[var(--foreground)]">
              {stat.value}
            </span>
            <Chip tone={stat.tone} className="self-start">
              {stat.delta}
            </Chip>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--accent-blue)] p-5 text-white shadow-[0_1px_3px_rgba(16,20,24,0.06)]">
          <div className="text-[10.5px] font-bold tracking-[0.12em] text-white/75 uppercase">
            Accent surface
          </div>
          <div className="mt-1 font-[family-name:var(--font-inter-tight)] text-2xl font-extrabold">
            Tenant brand
          </div>
          <p className="mt-2 text-sm text-white/75">
            This panel is filled with the live tenant accent — switch tenants and
            it re-colours here and across every active nav item and CTA.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--hairline)] bg-card p-5 shadow-[0_1px_3px_rgba(16,20,24,0.06)] lg:col-span-2">
          <div className="font-[family-name:var(--font-inter-tight)] text-[15px] font-bold text-[var(--foreground)]">
            Status chips
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone="accent">Active</Chip>
            <Chip tone="success">Won</Chip>
            <Chip tone="warning">Awaiting decision</Chip>
            <Chip tone="danger">Overdue</Chip>
            <Chip tone="neutral">Draft</Chip>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Semantic tones are platform-fixed; only the accent tone rebrands per
            tenant.
          </p>
        </div>
      </div>
    </div>
  );
}

const STAT_PLACEHOLDERS = [
  { label: "Revenue", value: "£486k", delta: "↑ 12.4%", tone: "success" as const },
  { label: "Deals won", value: "61", delta: "↑ 5", tone: "success" as const },
  { label: "Pipeline", value: "£214k", delta: "37 live", tone: "accent" as const },
  { label: "Win rate", value: "38%", delta: "↑ 3.1 pts", tone: "success" as const },
];
