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
  CardFieldsButton,
  ColumnsButton,
  FiltersButton,
  LeadCardFieldsProvider,
  LeadColumnsProvider,
  LeadTable,
} from "@/components/crm/leads-list";
import { DateRangeButton } from "@/components/crm/date-range-button";
import { LeadBoard } from "@/components/crm/lead-board";
import { ViewToggle } from "@/components/crm/view-toggle";
import {
  SummaryPanel,
  SummaryProvider,
  SummaryToggle,
} from "@/components/crm/collapsible-summary";
import { ViewStateSaver } from "@/components/crm/view-state";
import { resolveRange } from "@/lib/date-range";
import { getSavedViews, getSavedView } from "@/lib/data/saved-views";
import { ViewSwitcher } from "@/components/crm/view-switcher";

// Leads list — net-new (no design exists), built on the same shared list
// machinery as /customers: configurable + resizable + sortable columns saved per
// user, a filters popover with the advanced value builder, and continuous
// scroll, plus a kanban board view. The summary tiles above it are shared by
// both views; the per-stage breakdown lives on the board. See AGENTS.md § Lists.

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

  // Default arrangement is LEAD NUMBER ASCENDING — oldest enquiry at the top,
  // matching how /customers defaults to customer_number ascending. The sidebar
  // link carries no query, so a fresh visit (or "Clear all") always lands here.
  const sort = sp.sort ?? "lead_number";
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
    sort,
    dir,
  };
  // Board or list — both run the SAME filters, so switching view never changes
  // which leads you are looking at, only how they are arranged.
  const board = sp.view === "board";
  const [data, columnPref, cardPref, summaryPref, views, activeView] = await Promise.all([
    board ? getLeadBoard(filters) : getLeads({ ...filters, page: 1 }),
    getUserPref("leads_columns"),
    getUserPref("leads_card_fields"),
    getUserPref("leads_summary"),
    getSavedViews("leads"),
    getSavedView("leads", sp.sv),
  ]);

  // A saved view can pin its own column layout. When one does, it OWNS the
  // columns — changes are held for its Save rather than written to the user's
  // personal default (see DataListProvider's `persist`).
  const viewColumns = activeView?.columns ?? null;
  const columnLayout = viewColumns ?? columnPref;

  const boardData = board ? (data as Awaited<ReturnType<typeof getLeadBoard>>) : null;
  const listData = board ? null : (data as Awaited<ReturnType<typeof getLeads>>);
  const total = boardData ? boardData.total : listData!.total;
  const filterOptions = boardData ? boardData.filterOptions : listData!.filterOptions;
  // Both loaders return the pipeline aggregate in the same shape, so the
  // summary tiles above are identical in either view.
  const pipeline: StageBucket[] = boardData ? boardData.pipeline : listData!.pipeline;

  // Re-mount the table/board (resetting its scroll list) whenever the query
  // changes, so a new sort/filter/search starts from a fresh first chunk.
  //
  // Keyed on the RAW range params, never the resolved instants: a preset
  // resolves through `new Date()`, so `dateFrom`/`dateTo` differ on every
  // render — keying on those would remount the list on every server render,
  // throwing away the scroll position and refetching chunk 1 each time.
  const viewKey = JSON.stringify({
    search: sp.search,
    stage: sp.stage,
    columnFilters,
    valueFilters,
    range: sp.range,
    from: sp.from,
    to: sp.to,
    sort,
    dir,
    view: sp.view,
  });

  return (
    <LeadColumnsProvider saved={columnLayout} persist={!viewColumns}>
      {/* Which fields show on a board card — per user, like the columns. Wraps
          both the "Cards" toolbar button and the board so they share state. */}
      <LeadCardFieldsProvider saved={cardPref}>
      {/* Remembers this list's filters/sort for the session so returning here
          restores them instead of resetting to the default. */}
      <ViewStateSaver />
      {/* The page has NO side or bottom padding — the table is edge to edge and
          flush to the bottom, so every pixel goes to rows. The padding lives on
          the toolbar block below instead, which keeps its 26px gutter. */}
      <div className="flex flex-1 flex-col gap-[14px] overflow-hidden pt-[22px]">
        {/* Everything above the table keeps the page gutter. The summary
            provider spans both the toolbar's show/hide button and the tiles. */}
        <SummaryProvider layoutKey="leads_summary" initialHidden={summaryPref?.hidden === true}>
        <div className="flex flex-col gap-[14px] px-[26px]">
          {/* Header */}
          <div className="flex items-center gap-3">
            <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
              Leads
            </h1>
            {/* The view is the SUBJECT of the screen, so it sits on the title —
                not as a sixth button among the controls that modify it. */}
            <ViewSwitcher entity="leads" views={views} activeId={sp.sv} />
            <div className="ml-auto flex items-center gap-2.5">
              <SearchButton placeholder="Lead no., customer, address, product…" />
              {/* Ranges lead-date (when the enquiry arrived) — the date this list
                  is ordered by, so it's the one a range is about. */}
              <DateRangeButton />
              {/* A board has no columns to configure — it picks card fields
                  instead. */}
              {board ? <CardFieldsButton /> : <ColumnsButton />}
              <FiltersButton filterOptions={filterOptions} />
              <SummaryToggle />
              <ViewToggle />
              <Link href="/leads/new" className={cn(TOOLBAR_H, btnPrimary)}>
                <Icon name="plus" size={13} strokeWidth={2.2} /> New Lead
              </Link>
            </div>
          </div>

          {/* Summary tiles, identical in BOTH views, with their own collapse
              control on the right. The per-stage breakdown lives on the KANBAN,
              where each column header carries its own count and value and you
              can act on it — repeating it here as a strip of tiles said the
              same thing twice and cost the list a band of height. */}
          {/* Renders NOTHING when hidden, so the row collapses entirely rather
              than leaving an empty band behind. */}
          <SummaryPanel>
            <LeadSummary total={total} pipeline={pipeline} />
          </SummaryPanel>
        </div>
        </SummaryProvider>

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
      </LeadCardFieldsProvider>
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
          many, and how much — so they share one colour. That colour is the
          PLATFORM info blue, not the tenant accent: these figures sit beside
          Won-green and Lost-red and are read the same way, so a tenant whose
          brand is red would otherwise show "Live Leads" in the loss colour. */}
      <StatTile
        label="Live Leads"
        value={n(liveCount)}
        rule="bg-[var(--info)]"
        tone="text-[var(--info)]"
      />
      <StatTile
        label="Open Pipeline"
        value={gbpCompact(openValue)}
        rule="bg-[var(--info)]"
        tone="text-[var(--info)]"
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
