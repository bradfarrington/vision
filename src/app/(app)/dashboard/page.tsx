import { getSession } from "@/lib/company";
import { getDashboard, type Dashboard } from "@/lib/data/dashboard";
import { gbp, gbpCompact, weekdayDate } from "@/lib/format";
import { PIPELINE_STAGES } from "@/lib/leads";
import { Chip } from "@/components/ui/chip";
import { Avatar, Card, CardTitle, Icon, btnSecondary } from "@/components/crm/primitives";

// Dashboard v1 — transcribed from `Vision CRM Screens.dc.html` screen 01, wired
// to live tenant data (KPIs, pipeline by stage, lead sources, team, diary).
export default async function DashboardPage() {
  const [session, data] = await Promise.all([getSession(), getDashboard()]);
  const company = session?.company;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[26px] py-[22px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
          Dashboard
        </h1>
        <Chip tone="accent">{company?.name ?? "Vision"}</Chip>
        <div className="ml-auto flex items-center gap-2.5">
          <button className={btnSecondary} type="button">
            Last 90 days
            <Icon name="chevron-down" size={12} className="text-[#71717a]" />
          </button>
          <button className={btnSecondary} type="button">
            <Icon name="pencil" size={13} /> Edit layout
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="flex items-stretch gap-3.5">
        <div className="w-[300px] shrink-0 px-1 py-1.5">
          <div className="text-[13px] font-medium text-[#52525b]">Revenue</div>
          <div className="mt-0.5 font-[family-name:var(--font-inter-tight)] text-[42px] font-extrabold tracking-[-0.015em] text-[#0a0a0a]">
            {gbp(data.revenue)}
          </div>
          <div className="mt-2 text-[12px] text-[#71717a]">
            {data.dealsWon} {data.dealsWon === 1 ? "deal" : "deals"} won ·{" "}
            {data.totalLeads} leads all time
          </div>
        </div>
        <StatCard label="Deals Won" value={String(data.dealsWon)} />
        <StatCard label="Pipeline" value={gbpCompact(data.pipelineValue)} sub={`${data.liveCount} live`} />
        <StatCard label="Win Rate" value={data.winRate != null ? `${data.winRate}%` : "—"} />
        <StatCard label="Live Leads" value={String(data.liveCount)} />
      </div>

      {/* Pipeline by stage */}
      <Card className="!py-3.5">
        <div className="mb-2.5 flex items-center gap-2">
          <CardTitle className="text-[14px]">Pipeline by stage</CardTitle>
          <span className="text-[11.5px] text-[#71717a]">
            {data.liveCount} live · {gbpCompact(data.pipelineValue)}
          </span>
        </div>
        <PipelineBar data={data} />
      </Card>

      {/* Three panels */}
      <div className="grid flex-1 grid-cols-[1fr_1.15fr_1fr] gap-3.5">
        <LeadSources data={data} />
        <TeamPerformance data={data} />
        <TodaysDiary data={data} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 rounded-xl border border-[#e7e7ea] bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(10,10,10,0.06)]">
      <span className="text-[12.5px] font-medium text-[#52525b]">{label}</span>
      <span className="font-[family-name:var(--font-inter-tight)] text-[26px] font-extrabold text-[#0a0a0a]">
        {value}
      </span>
      {sub && <span className="text-[12px] text-[#71717a]">{sub}</span>}
    </div>
  );
}

function PipelineBar({ data }: { data: Dashboard }) {
  const byKey = new Map(data.pipeline.map((b) => [b.key, b]));
  const buckets = PIPELINE_STAGES.map((s) => ({
    stage: s,
    count: byKey.get(s.key)?.count ?? 0,
    value: byKey.get(s.key)?.value ?? 0,
  }));
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="flex items-end gap-2">
      {buckets.map((b) => (
        <div key={b.stage.key} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[11px] font-semibold text-[#3f3f46]">{b.count}</span>
          <div className="flex h-16 w-full items-end">
            <div
              className="w-full rounded-t-[4px] bg-[var(--accent-blue)]"
              style={{ height: `${Math.max(4, (b.count / max) * 100)}%`, opacity: b.count ? 1 : 0.25 }}
            />
          </div>
          <span className="flex items-center gap-1 text-[11px] text-[#71717a]">
            {b.stage.label}
          </span>
          <span className="text-[10.5px] text-[#a1a1aa]">{gbpCompact(b.value)}</span>
        </div>
      ))}
    </div>
  );
}

const SOURCE_COLORS = ["var(--accent-blue)", "#18181b", "#52525b", "#a1a1aa", "#d4d4d8"];

function LeadSources({ data }: { data: Dashboard }) {
  return (
    <Card className="flex flex-col gap-2.5">
      <CardTitle className="text-[15px]">Lead sources</CardTitle>
      {data.sources.length === 0 ? (
        <p className="text-[12.5px] text-[#71717a]">No lead sources recorded yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5 text-[12.5px]">
          {data.sources.map((s, i) => (
            <div key={s.source}>
              <div className="mb-1 flex justify-between">
                <span className="font-semibold text-[#3f3f46]">{s.source}</span>
                <span className="text-[#71717a]">
                  {s.count} · {s.pct}%
                </span>
              </div>
              <div className="h-[7px] w-full rounded-full bg-[#f4f4f5]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${s.pct}%`, background: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-auto border-t border-[#f4f4f5] pt-2.5 text-[12px] text-[#71717a]">
        {data.totalLeads} leads · source is <span className="font-mono">leads.source</span>
      </div>
    </Card>
  );
}

function TeamPerformance({ data }: { data: Dashboard }) {
  return (
    <Card className="flex flex-col gap-2.5">
      <CardTitle className="text-[15px]">Team performance</CardTitle>
      {data.team.length === 0 ? (
        <p className="text-[12.5px] text-[#71717a]">No salesperson data yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-[1.4fr_1fr_.7fr_.7fr] border-b border-[#f4f4f5] pb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#a1a1aa]">
            <span>Sales</span>
            <span className="text-right">Revenue</span>
            <span className="text-right">Leads</span>
            <span className="text-right">W/L</span>
          </div>
          {data.team.map((t) => (
            <div
              key={t.name}
              className="grid grid-cols-[1.4fr_1fr_.7fr_.7fr] items-center text-[12.5px]"
            >
              <span className="flex items-center gap-1.5 font-semibold text-[#0a0a0a]">
                <Avatar name={t.name} size={22} tone="accent" />
                <span className="truncate">{t.name}</span>
              </span>
              <span className="text-right font-semibold text-[#0a0a0a]">{gbp(t.revenue)}</span>
              <span className="text-right text-[#52525b]">{t.leads}</span>
              <span className="text-right text-[#52525b]">
                {t.won}/{t.lost}
              </span>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}

const DIARY_TONE: Record<string, string> = {
  accent: "bg-[var(--accent-tint)] text-[var(--accent-active)]",
  amber: "bg-[#fdf2dc] text-[#b86e00]",
  success: "bg-[#e7f4ec] text-[#1a7f3e]",
  neutral: "bg-[#f4f4f5] text-[#52525b]",
};

function TodaysDiary({ data }: { data: Dashboard }) {
  return (
    <Card className="flex flex-col gap-2.5">
      <CardTitle className="text-[15px]">Today&rsquo;s diary · {weekdayDate(new Date())}</CardTitle>
      {data.diary.length === 0 ? (
        <p className="text-[12.5px] text-[#71717a]">Nothing booked in today.</p>
      ) : (
        data.diary.map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-[12px]">
            <span className="w-9 font-mono text-[#71717a]">{d.time ?? "--:--"}</span>
            <span
              className={`flex-1 truncate rounded-[7px] px-2.5 py-[5px] font-semibold ${DIARY_TONE[d.tone]}`}
            >
              {d.label}
            </span>
          </div>
        ))
      )}
      <a href="/diary" className="mt-auto text-[12.5px] font-semibold text-[var(--accent-blue)]">
        Open diary →
      </a>
    </Card>
  );
}
