import {
  getContractBoard,
  getContracts,
  type ContractFilters,
  type StageBucket,
  type ValueCondition,
} from "@/lib/data/contracts";
import { getUserPref } from "@/lib/data/user-layouts";
import { contractStage } from "@/lib/contracts";
import { gbpCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SearchButton } from "@/components/crm/list-controls";
import {
  CardFieldsButton,
  ColumnsButton,
  ContractCardFieldsProvider,
  ContractColumnsProvider,
  ContractTable,
  FiltersButton,
} from "@/components/crm/contracts-list";
import { DateRangeButton } from "@/components/crm/date-range-button";
import { ContractBoard } from "@/components/crm/contract-board";
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

// Contracts list — transcribed from design screen 05's world, built on the same
// shared list machinery as /customers and /leads (configurable + resizable +
// sortable columns saved per user, a filters popover with the advanced value
// builder, continuous scroll) plus the shared kanban board.
//
// There is deliberately NO "New Contract" button: a contract is created by
// CONVERTING a lead ("Convert to Contract" on the lead record), which is what
// contracts.lead_id being not null means. See AGENTS.md § Phase 5.

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

export default async function ContractsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // Every `f_<column>` param is a contract-column filter; collect them for the
  // server to apply against its allowlist.
  const columnFilters: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith("f_") && typeof v === "string" && v !== "") columnFilters[k.slice(2)] = v;
  }

  const valueFilters = parseValueFilters(sp.fq);

  // The URL carries the PRESET KEY (a rolling window), not the dates it means.
  // Only `range=custom` carries explicit from/to. See lib/date-range.
  const { from: dateFrom, to: dateTo } = resolveRange(sp.range, { from: sp.from, to: sp.to });

  // Default arrangement is CONTRACT NUMBER ASCENDING, matching how /leads and
  // /customers default to their own reference ascending. The sidebar link
  // carries no query, so a fresh visit (or "Clear all") always lands here.
  const sort = sp.sort ?? "contract_number";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const filters: ContractFilters = {
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
  // which contracts you are looking at, only how they are arranged.
  const board = sp.view === "board";
  const [data, columnPref, cardPref, summaryPref, views, activeView] = await Promise.all([
    board ? getContractBoard(filters) : getContracts({ ...filters, page: 1 }),
    getUserPref("contracts_columns"),
    getUserPref("contracts_card_fields"),
    getUserPref("contracts_summary"),
    getSavedViews("contracts"),
    getSavedView("contracts", sp.sv),
  ]);

  // A saved view can pin its own column layout. When one does, it OWNS the
  // columns — changes are held for its Save rather than written to the user's
  // personal default (see DataListProvider's `persist`).
  const viewColumns = activeView?.columns ?? null;
  const columnLayout = viewColumns ?? columnPref;

  const boardData = board ? (data as Awaited<ReturnType<typeof getContractBoard>>) : null;
  const listData = board ? null : (data as Awaited<ReturnType<typeof getContracts>>);
  const total = boardData ? boardData.total : listData!.total;
  const filterOptions = boardData ? boardData.filterOptions : listData!.filterOptions;
  // Both loaders return the pipeline aggregate in the same shape, so the
  // summary tiles above are identical in either view.
  const pipeline: StageBucket[] = boardData ? boardData.pipeline : listData!.pipeline;

  // Re-mount the table/board (resetting its scroll list) whenever the query
  // changes. Keyed on the RAW range params, never the resolved instants: a
  // preset resolves through `new Date()`, so keying on those would remount on
  // every server render and throw away the scroll position.
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
    <ContractColumnsProvider saved={columnLayout} persist={!viewColumns}>
      <ContractCardFieldsProvider saved={cardPref}>
        {/* Remembers this list's filters/sort for the session so returning here
            restores them instead of resetting to the default. */}
        <ViewStateSaver />
        {/* The page has NO side or bottom padding — the table is edge to edge
            and flush to the bottom, so every pixel goes to rows. */}
        <div className="flex flex-1 flex-col gap-[14px] overflow-hidden pt-[22px]">
          <SummaryProvider
            layoutKey="contracts_summary"
            initialHidden={summaryPref?.hidden === true}
          >
            <div className="flex flex-col gap-[14px] px-[26px]">
              {/* Header */}
              <div className="flex items-center gap-3">
                <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
                  Contracts
                </h1>
                {/* The view is the SUBJECT of the screen, so it sits on the
                    title — not among the controls that modify it. */}
                <ViewSwitcher entity="contracts" views={views} activeId={sp.sv} />
                <div className="ml-auto flex items-center gap-2.5">
                  <SearchButton placeholder="Contract no., customer, address, type…" />
                  {/* Ranges contract_date (when it was signed) — the date this
                      list is ordered by, so it's the one a range is about. */}
                  <DateRangeButton />
                  {/* A board has no columns to configure — it picks card fields
                      instead. */}
                  {board ? <CardFieldsButton /> : <ColumnsButton />}
                  <FiltersButton filterOptions={filterOptions} />
                  <SummaryToggle />
                  <ViewToggle />
                  {/* No "New Contract": a contract is CONVERTED from a lead. */}
                </div>
              </div>

              {/* Summary tiles, identical in BOTH views. The per-stage breakdown
                  lives on the KANBAN, where each column header carries its own
                  count and value and you can act on it. */}
              <SummaryPanel>
                <ContractSummary total={total} pipeline={pipeline} />
              </SummaryPanel>
            </div>
          </SummaryProvider>

          {boardData ? (
            <ContractBoard key={viewKey} columns={boardData.columns} filters={filters} />
          ) : (
            <ContractTable
              key={viewKey}
              initialViews={listData!.rows}
              total={total}
              filters={filters}
              sort={sort}
              dir={dir}
            />
          )}
        </div>
      </ContractCardFieldsProvider>
    </ContractColumnsProvider>
  );
}

/**
 * The list's headline figures, as stat tiles — the same row in list and board
 * view. Derived from the pipeline aggregate already loaded, so it costs no
 * query.
 *
 * "In flight" is every stage still open (not complete, not cancelled) — the
 * figure a job board is actually about. Everything here respects the current
 * filters and date range, like the rest of the screen.
 */
function ContractSummary({ total, pipeline }: { total: number; pipeline: StageBucket[] }) {
  const open = pipeline.filter((b) => contractStage(b.key).open);
  const openCount = open.reduce((n, b) => n + b.count, 0);
  const openValue = open.reduce((n, b) => n + b.value, 0);
  const completeValue = pipeline.find((b) => b.key === "complete")?.value ?? 0;
  const cancelledValue = pipeline.find((b) => b.key === "cancelled")?.value ?? 0;
  const n = (v: number) => v.toLocaleString("en-GB");

  return (
    <div className="flex min-w-0 flex-wrap items-stretch gap-2.5">
      <StatTile label="Total Contracts" value={n(total)} rule="bg-[#a1a1aa]" tone="text-[#0a0a0a]" />
      {/* "In Progress" is the DESIGN's own word for a live contract (the status
          pill on screen 05) — it was briefly "In Flight", which is jargon that
          needed explaining, and a tile label that needs explaining is the wrong
          label. It and Order Book are the SAME population counted two ways —
          how many, and how much — so they share one colour. That colour is the
          PLATFORM info blue, not the tenant accent: these figures sit beside
          Completed-green and Cancelled-red and are read the same way, so a
          tenant branded red would otherwise show live work in the loss colour.
          See AGENTS.md § UI build method. */}
      <StatTile
        label="In Progress"
        value={n(openCount)}
        rule="bg-[var(--info)]"
        tone="text-[var(--info)]"
      />
      <StatTile
        label="Order Book"
        value={gbpCompact(openValue)}
        rule="bg-[var(--info)]"
        tone="text-[var(--info)]"
      />
      <StatTile
        label="Completed"
        value={gbpCompact(completeValue)}
        rule="bg-[#1a7f3e]"
        tone="text-[#1a7f3e]"
      />
      <StatTile
        label="Cancelled"
        value={gbpCompact(cancelledValue)}
        rule="bg-[#d64545]"
        tone="text-[#d64545]"
      />
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
