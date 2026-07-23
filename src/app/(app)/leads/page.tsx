import Link from "next/link";

import { getLeads, type LeadFilters, type StageBucket, type ValueCondition } from "@/lib/data/leads";
import { getUserPref } from "@/lib/data/user-layouts";
import { PIPELINE_STAGES, leadStage } from "@/lib/leads";
import { gbpCompact } from "@/lib/format";
import { Icon, btnPrimary } from "@/components/crm/primitives";
import { SearchBox } from "@/components/crm/list-controls";
import {
  ColumnsButton,
  FiltersButton,
  LeadColumnsProvider,
  LeadTable,
} from "@/components/crm/leads-list";
import { ViewStateSaver } from "@/components/crm/view-state";

// Leads list — net-new (no design exists), built on the same shared list
// machinery as /customers: configurable + resizable + sortable columns saved per
// user, a filters popover with the advanced value builder, and continuous
// scroll. The pipeline strip above it is this list's own addition — a one-click
// stage filter that also states where the money is. See AGENTS.md § Lists.

type SearchParams = Promise<Record<string, string | undefined>>;

/** Parse the `fq` param (JSON array of {f,op,v}); tolerate anything malformed. */
function parseValueFilters(raw: string | undefined): ValueCondition[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (c): c is ValueCondition =>
          c && typeof c.f === "string" && typeof c.op === "string" && typeof c.v === "string",
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // Every `f_<column>` param is a lead-column filter; collect them for the
  // server to apply against its allowlist.
  const columnFilters: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith("f_") && typeof v === "string" && v !== "") columnFilters[k.slice(2)] = v;
  }

  const valueFilters = parseValueFilters(sp.fq);

  // Default arrangement is newest lead first — the sidebar link carries no
  // query, so leaving and returning always lands here.
  const sort = sp.sort ?? null;
  const dir = sp.dir === "desc" ? "desc" : "asc";
  // The list scrolls continuously — the first chunk renders server-side, and
  // LeadTable fetches further chunks (via loadLeadRows) as it scrolls.
  const filters: LeadFilters = {
    search: sp.search,
    stage: sp.stage,
    columnFilters,
    valueFilters,
    ...(sort ? { sort, dir } : {}),
  };
  const [{ rows, total, pipeline, filterOptions }, columnPref] = await Promise.all([
    getLeads({ ...filters, page: 1 }),
    getUserPref("leads_columns"),
  ]);

  const stageHref = (key: string | null) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k !== "stage" && typeof v === "string" && v !== "") params.set(k, v);
    }
    if (key) params.set("stage", key);
    const qs = params.toString();
    return qs ? `/leads?${qs}` : "/leads";
  };

  // Re-mount the table (resetting its scroll list) whenever the query changes,
  // so a new sort/filter/search starts from a fresh first chunk.
  const viewKey = JSON.stringify({
    search: sp.search,
    stage: sp.stage,
    columnFilters,
    valueFilters,
    sort,
    dir,
  });

  return (
    <LeadColumnsProvider saved={columnPref}>
      {/* Remembers this list's filters/sort for the session so returning here
          restores them instead of resetting to the default. */}
      <ViewStateSaver />
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
            <ColumnsButton />
            <FiltersButton filterOptions={filterOptions} />
            <Link href="/leads/new" className={btnPrimary}>
              <Icon name="plus" size={13} strokeWidth={2.2} /> New Lead
            </Link>
          </div>
        </div>

        {/* Pipeline summary — a fixed set of stage tiles, each a one-click
            filter. Shown in stage order and filled with zeroes so the strip is
            stable regardless of what data exists. */}
        <div className="flex gap-2.5">
          {pipelineSummary(pipeline).map((b) => {
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
                  {stage.tone === "neutral" && <span className="size-1.5 rounded-full bg-[#71717a]" />}
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

        {/* Search */}
        <div className="flex items-center gap-2">
          <SearchBox placeholder="Lead no., product, source, town…" />
        </div>

        <LeadTable
          key={viewKey}
          initialViews={rows}
          total={total}
          filters={filters}
          sort={sort}
          dir={dir}
        />
      </div>
    </LeadColumnsProvider>
  );
}

// Show the fixed pipeline stages in order, filling zero-count stages so the bar
// is stable regardless of what data exists.
function pipelineSummary(pipeline: StageBucket[]): StageBucket[] {
  const byKey = new Map(pipeline.map((b) => [b.key, b]));
  return PIPELINE_STAGES.map((s) => byKey.get(s.key) ?? { key: s.key, count: 0, value: 0 });
}
