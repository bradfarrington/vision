import Link from "next/link";

import { getLeads, LEADS_PAGE_SIZE, type LeadRow, type StageBucket } from "@/lib/data/leads";
import { PIPELINE_STAGES, leadStage } from "@/lib/leads";
import { gbp, gbpCompact } from "@/lib/format";
import { Avatar, Icon, StageBadge, btnPrimary, btnSecondary } from "@/components/crm/primitives";
import { FilterDropdown, Pagination, SearchBox } from "@/components/crm/list-controls";

// Leads list — net-new (no design exists), built to mirror the Customers-list
// template plus a stage-pipeline summary. See AGENTS.md § Phase 4.
const GRID = "grid-cols-[2.3fr_2fr_1.2fr_1fr_1.1fr_1.3fr_28px]";

type SearchParams = Promise<{
  search?: string;
  stage?: string;
  source?: string;
  page?: string;
}>;

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { rows, total, page, pageCount, sources, pipeline } = await getLeads({
    search: sp.search,
    stage: sp.stage,
    source: sp.source,
    page: sp.page ? Number(sp.page) : 1,
  });

  const from = total === 0 ? 0 : (page - 1) * LEADS_PAGE_SIZE + 1;
  const to = Math.min(page * LEADS_PAGE_SIZE, total);

  const stageHref = (key: string | null) => {
    const params = new URLSearchParams();
    if (sp.search) params.set("search", sp.search);
    if (sp.source) params.set("source", sp.source);
    if (key) params.set("stage", key);
    const qs = params.toString();
    return qs ? `/leads?${qs}` : "/leads";
  };

  return (
    <div className="flex flex-1 flex-col gap-[14px] overflow-hidden px-[26px] py-[22px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
          Leads
        </h1>
        <span className="rounded-full bg-[#f4f4f5] px-[10px] py-[3px] text-xs font-semibold text-[#52525b]">
          {total.toLocaleString("en-GB")}
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <button className={btnSecondary} type="button">
            <Icon name="export" size={13} /> Export
          </button>
          <Link href="/leads/new" className={btnPrimary}>
            <Icon name="plus" size={13} strokeWidth={2.2} /> New Lead
          </Link>
        </div>
      </div>

      {/* Pipeline summary */}
      <div className="flex gap-2.5">
        {pipeline_summary(pipeline).map((b) => {
          const stage = leadStage(b.key);
          const active = sp.stage === b.key;
          return (
            <Link
              key={b.key}
              href={stageHref(active ? null : b.key)}
              className={`flex flex-1 flex-col gap-1 rounded-xl border px-4 py-3 transition-colors ${
                active
                  ? "border-[var(--accent-blue)] bg-[var(--accent-tint)]"
                  : "border-[#e7e7ea] bg-white hover:bg-[#fafafa]"
              }`}
            >
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#52525b]">
                {stage.tone === "neutral" && (
                  <span className="size-1.5 rounded-full bg-[#71717a]" />
                )}
                {stage.label}
              </span>
              <span className="font-[family-name:var(--font-inter-tight)] text-[22px] font-extrabold text-[#0a0a0a]">
                {b.count}
              </span>
              <span className="text-[11.5px] text-[#71717a]">{gbpCompact(b.value)}</span>
            </Link>
          );
        })}
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2">
        <SearchBox placeholder="Lead no., product, source…" />
        <FilterDropdown
          param="source"
          label="Source"
          options={sources.map((s) => ({ value: s, label: s }))}
        />
        {sp.stage && (
          <Link
            href={stageHref(null)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-blue)] bg-[var(--accent-tint)] px-3 py-[7px] text-[12.5px] font-semibold text-[var(--accent-blue)]"
          >
            Stage: {leadStage(sp.stage).label} <span aria-hidden>✕</span>
          </Link>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-[#71717a]">
          Sort: Newest
          <Icon name="chevron-down" size={11} className="text-[#71717a]" />
        </span>
      </div>

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e7e7ea]">
        <div
          className={`grid ${GRID} items-center border-b border-[#e7e7ea] bg-[#fafafa] px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]`}
        >
          <span>Lead</span>
          <span>Customer</span>
          <span>Stage</span>
          <span>Value</span>
          <span>Source</span>
          <span>Received · follow-up</span>
          <span />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            rows.map((l) => <LeadRowItem key={l.id} l={l} />)
          )}
        </div>
        <div className="flex items-center border-t border-[#e7e7ea] bg-[#fafafa] px-4 py-3 text-[12.5px] text-[#71717a]">
          <span>
            {total === 0 ? "No leads" : `Showing ${from}–${to} of ${total.toLocaleString("en-GB")}`}
          </span>
          <Pagination page={page} pageCount={pageCount} />
        </div>
      </div>
    </div>
  );
}

function LeadRowItem({ l }: { l: LeadRow }) {
  return (
    <Link
      href={`/leads/${l.id}`}
      className={`grid ${GRID} items-center border-b border-[#f4f4f5] px-4 py-[11px] text-[13px] transition-colors last:border-b-0 hover:bg-[#fafafa]`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex shrink-0 items-center rounded-md bg-[#f4f4f5] px-2 py-1 font-mono text-[11px] font-bold text-[#3f3f46]">
          {l.ref}
        </span>
        <span className="min-w-0 truncate font-semibold text-[#0a0a0a]">{l.title}</span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <Avatar name={l.customerName} size={26} />
        <span className="min-w-0">
          <span className="block truncate text-[#3f3f46]">{l.customerName}</span>
          {l.customerTown && (
            <span className="block truncate text-[11.5px] text-[#71717a]">{l.customerTown}</span>
          )}
        </span>
      </span>
      <span>
        <StageBadge status={l.status} />
      </span>
      <span className="font-semibold text-[#0a0a0a]">{gbp(l.value)}</span>
      <span className="truncate text-[#3f3f46]">{l.source ?? "—"}</span>
      <span className="min-w-0">
        <span className="block truncate text-[#3f3f46]">{dateShort(l.leadDate)}</span>
        {l.followUpDate && l.live && (
          <span className="block truncate text-[11.5px] font-semibold text-[#b86e00]">
            follow-up {dateShort(l.followUpDate)}
          </span>
        )}
      </span>
      <span className="text-center text-[#a1a1aa]">›</span>
    </Link>
  );
}

// Show the fixed pipeline stages in order, filling zero-count stages so the bar
// is stable regardless of what data exists.
function pipeline_summary(pipeline: StageBucket[]): StageBucket[] {
  const byKey = new Map(pipeline.map((b) => [b.key, b]));
  return PIPELINE_STAGES.map(
    (s) => byKey.get(s.key) ?? { key: s.key, count: 0, value: 0 },
  );
}

function dateShort(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-sm font-semibold text-[#3f3f46]">No leads found</p>
      <p className="text-[12.5px] text-[#71717a]">Adjust your filters or create a new lead.</p>
    </div>
  );
}
