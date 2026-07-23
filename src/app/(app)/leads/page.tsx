import Link from "next/link";

import {
  getLeadBoard,
  getLeads,
  type LeadFilters,
  type StageBucket,
  type ValueCondition,
} from "@/lib/data/leads";
import { getUserPref } from "@/lib/data/user-layouts";
import { leadStage } from "@/lib/leads";
import { gbpCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Icon, TOOLBAR_H, btnPrimary } from "@/components/crm/primitives";
import { SearchButton } from "@/components/crm/list-controls";
import {
  ColumnsButton,
  FiltersButton,
  LeadColumnsProvider,
  LeadTable,
} from "@/components/crm/leads-list";
import { DateRangeButton } from "@/components/crm/date-range-button";
import { LeadBoard } from "@/components/crm/lead-board";
import { ViewToggle } from "@/components/crm/view-toggle";
import { ViewStateSaver } from "@/components/crm/view-state";
import { resolveRange } from "@/lib/date-range";

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

  // The URL carries the PRESET KEY (a rolling window), not the dates it means —
  // so a shared "Last 90 days" link still means the last 90 days next month.
  // Only `range=custom` carries explicit from/to. See lib/date-range.
  const { from: dateFrom, to: dateTo } = resolveRange(sp.range, { from: sp.from, to: sp.to });

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
    dateFrom,
    dateTo,
    ...(sort ? { sort, dir } : {}),
  };
  // Board or list — both run the SAME filters, so switching view never changes
  // which leads you are looking at, only how they are arranged.
  const board = sp.view === "board";
  const [data, columnPref] = await Promise.all([
    board ? getLeadBoard(filters) : getLeads({ ...filters, page: 1 }),
    getUserPref("leads_columns"),
  ]);

  const boardData = board ? (data as Awaited<ReturnType<typeof getLeadBoard>>) : null;
  const listData = board ? null : (data as Awaited<ReturnType<typeof getLeads>>);
  const total = boardData ? boardData.total : listData!.total;
  const filterOptions = boardData ? boardData.filterOptions : listData!.filterOptions;
  // Both loaders return the pipeline aggregate in the same shape, so the
  // summary tiles above are identical in either view.
  const pipeline: StageBucket[] = boardData ? boardData.pipeline : listData!.pipeline;

  // Re-mount the table (resetting its scroll list) whenever the query changes,
  // so a new sort/filter/search starts from a fresh first chunk.
  const viewKey = JSON.stringify({
    search: sp.search,
    stage: sp.stage,
    columnFilters,
    valueFilters,
    dateFrom,
    dateTo,
    sort,
    dir,
    view: sp.view,
  });

  return (
    <LeadColumnsProvider saved={columnPref}>
      {/* Remembers this list's filters/sort for the session so returning here
          restores them instead of resetting to the default. */}
      <ViewStateSaver />
      {/* The page has NO side or bottom padding — the table is edge to edge and
          flush to the bottom, so every pixel goes to rows. The padding lives on
          the toolbar block below instead, which keeps its 26px gutter. */}
      <div className="flex flex-1 flex-col gap-[14px] overflow-hidden pt-[22px]">
        {/* Everything above the table keeps the page gutter. */}
        <div className="flex flex-col gap-[14px] px-[26px]">
          {/* Header */}
          <div className="flex items-center gap-3">
            <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
              Leads
            </h1>
            <div className="ml-auto flex items-center gap-2.5">
              <SearchButton placeholder="Lead no., customer, address, product…" />
              {/* Ranges lead-date (when the enquiry arrived) — the date this list
                  is ordered by, so it's the one a range is about. */}
              <DateRangeButton />
              {/* A board has no columns to configure. */}
              {!board && <ColumnsButton />}
              <FiltersButton filterOptions={filterOptions} />
              <Link href="/leads/new" className={cn(TOOLBAR_H, btnPrimary)}>
                <Icon name="plus" size={13} strokeWidth={2.2} /> New Lead
              </Link>
            </div>
          </div>

          {/* Pipeline summary — a fixed set of stage tiles, each a one-click
              filter. Shown in stage order and filled with zeroes so the strip is
              stable regardless of what data exists.

              Styled as STAT TILES, matching the customer overview's strip: a 3px
              coloured rule down the leading edge, an uppercase label, and the
              count with its value inline. Two lines instead of three, so the
              strip costs the table far less height than the old stacked cards. */}
          {/* Each tile is sized BY ITS OWN CONTENT, between a min and a max — not
              an equal share of the row. Stage names vary in length, and stretching
              them all to match left "Won" swimming in white space. Past the max a
              long name WRAPS (never truncates — a stage the tenant renamed must
              stay readable), which grows that tile; `items-stretch` keeps the row
              level so one tall tile doesn't leave the others short. */}
          {/* Summary tiles + the view toggle share a row, identically in BOTH
              views. The per-stage breakdown lives on the KANBAN, where each
              column header carries its own count and value and you can act on
              it — repeating it here as a strip of tiles said the same thing
              twice and cost the list a band of height. */}
          <div className="flex items-end justify-between gap-3">
            <LeadSummary total={total} pipeline={pipeline} />
            <div className="shrink-0">
              <ViewToggle />
            </div>
          </div>
        </div>

        {boardData ? (
          <LeadBoard key={viewKey} columns={boardData.columns} filters={filters} />
        ) : (
          <LeadTable
            key={viewKey}
            initialViews={listData!.rows}
            total={total}
            filters={filters}
            sort={sort}
            dir={dir}
          />
        )}
      </div>
    </LeadColumnsProvider>
  );
}

/**
 * The list's headline figures, as stat tiles — the same row in list and board
 * view. Derived from the pipeline aggregate already loaded, so it costs no
 * query.
 *
 * "Open" is every stage still live (not won, not lost) — the figure a pipeline
 * is actually about. Everything here respects the current filters and date
 * range, like the rest of the screen.
 */
function LeadSummary({ total, pipeline }: { total: number; pipeline: StageBucket[] }) {
  const live = pipeline.filter((b) => leadStage(b.key).live);
  const liveCount = live.reduce((n, b) => n + b.count, 0);
  const openValue = live.reduce((n, b) => n + b.value, 0);
  const wonValue = pipeline.find((b) => b.key === "won")?.value ?? 0;
  const lostValue = pipeline.find((b) => b.key === "lost")?.value ?? 0;
  const n = (v: number) => v.toLocaleString("en-GB");

  return (
    <div className="flex min-w-0 flex-wrap items-stretch gap-2.5">
      <StatTile label="Total Leads" value={n(total)} rule="bg-[#a1a1aa]" tone="text-[#0a0a0a]" />
      {/* Live and Open pipeline are the SAME population counted two ways — how
          many, and how much — so they share the accent. */}
      <StatTile
        label="Live Leads"
        value={n(liveCount)}
        rule="bg-[var(--accent-blue)]"
        tone="text-[var(--accent-blue)]"
      />
      <StatTile
        label="Open Pipeline"
        value={gbpCompact(openValue)}
        rule="bg-[var(--accent-blue)]"
        tone="text-[var(--accent-blue)]"
      />
      <StatTile label="Won" value={gbpCompact(wonValue)} rule="bg-[#1a7f3e]" tone="text-[#1a7f3e]" />
      <StatTile label="Lost" value={gbpCompact(lostValue)} rule="bg-[#d64545]" tone="text-[#d64545]" />
    </div>
  );
}

function StatTile({
  label,
  value,
  rule,
  tone,
}: {
  label: string;
  value: string;
  rule: string;
  tone: string;
}) {
  return (
    <div className="relative min-w-[148px] max-w-[240px] overflow-hidden rounded-xl border border-[#e7e7ea] bg-white px-3.5 py-2.5">
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", rule)} />
      <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
        {label}
      </div>
      <div
        className={cn(
          "font-[family-name:var(--font-inter-tight)] text-[18px] font-extrabold tracking-[-0.01em]",
          tone,
        )}
      >
        {value}
      </div>
    </div>
  );
}
