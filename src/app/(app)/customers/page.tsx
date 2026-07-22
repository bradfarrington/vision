import Link from "next/link";

import {
  getCustomers,
  latestLeadActivity,
  CUSTOMERS_PAGE_SIZE,
  type CustomerRow,
} from "@/lib/data/customers";
import { Avatar, CountPill, Icon, btnPrimary, btnSecondary } from "@/components/crm/primitives";
import {
  FilterDropdown,
  Pagination,
  SearchBox,
  TogglePill,
} from "@/components/crm/list-controls";

// Customers list — transcribed from `Vision CRM Screens.dc.html` screen 02.
// Search / filters / pagination are all URL-driven so the server re-queries.
const GRID = "grid-cols-[44px_2.1fr_2.1fr_1.3fr_.9fr_1fr_1.7fr_40px]";

type SearchParams = Promise<{
  search?: string;
  town?: string;
  live?: string;
  page?: string;
}>;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { rows, total, page, pageCount, towns } = await getCustomers({
    search: sp.search,
    town: sp.town,
    hasLiveLead: sp.live === "1",
    page: sp.page ? Number(sp.page) : 1,
  });

  const from = total === 0 ? 0 : (page - 1) * CUSTOMERS_PAGE_SIZE + 1;
  const to = Math.min(page * CUSTOMERS_PAGE_SIZE, total);

  return (
    <div className="flex flex-1 flex-col gap-[14px] overflow-hidden px-[26px] py-[22px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
          Customers
        </h1>
        <span className="rounded-full bg-[#f4f4f5] px-[10px] py-[3px] text-xs font-semibold text-[#52525b]">
          {total.toLocaleString("en-GB")}
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <button className={btnSecondary} type="button">
            <Icon name="columns" size={13} /> Columns
          </button>
          <button className={btnSecondary} type="button">
            <Icon name="filters" size={13} /> Filters
          </button>
          <button className={btnSecondary} type="button">
            <Icon name="export" size={13} /> Export
          </button>
          <Link href="/customers/new" className={btnPrimary}>
            <Icon name="plus" size={13} strokeWidth={2.2} /> New Customer
          </Link>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2">
        <SearchBox placeholder="Name, postcode, phone…" />
        <FilterDropdown
          param="town"
          label="Town"
          options={towns.map((t) => ({ value: t, label: t }))}
        />
        <TogglePill param="live" label="Has Live Lead" />
        <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-[#71717a]">
          Sort: Last activity
          <Icon name="chevron-down" size={11} className="text-[#71717a]" />
        </span>
      </div>

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e7e7ea]">
        {/* Header row */}
        <div
          className={`grid ${GRID} items-center border-b border-[#e7e7ea] bg-[#fafafa] px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]`}
        >
          <span>
            <span className="inline-block size-[15px] rounded-[4px] border-[1.5px] border-[#d4d4d8]" />
          </span>
          <span>Customer</span>
          <span>Installation address</span>
          <span>Phone</span>
          <span>Leads</span>
          <span>Contracts</span>
          <span>Last activity</span>
          <span />
        </div>

        {/* Rows */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            rows.map((c) => <CustomerRowItem key={c.id} c={c} />)
          )}
        </div>

        {/* Footer / pagination */}
        <div className="flex items-center border-t border-[#e7e7ea] bg-[#fafafa] px-4 py-3 text-[12.5px] text-[#71717a]">
          <span>
            {total === 0
              ? "No customers"
              : `Showing ${from}–${to} of ${total.toLocaleString("en-GB")}`}
          </span>
          <Pagination page={page} pageCount={pageCount} />
        </div>
      </div>
    </div>
  );
}

function CustomerRowItem({ c }: { c: CustomerRow }) {
  const activity = latestLeadActivity(c);
  return (
    <Link
      href={`/customers/${c.id}`}
      className={`grid ${GRID} items-center border-b border-[#f4f4f5] px-4 py-[11px] text-[13px] transition-colors last:border-b-0 hover:bg-[#fafafa]`}
    >
      <span>
        <span className="inline-block size-[15px] rounded-[4px] border-[1.5px] border-[#d4d4d8]" />
      </span>
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={c.displayName} size={32} />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-[#0a0a0a]">
            {c.displayName}
          </span>
          {c.email && (
            <span className="block truncate text-[11.5px] text-[#71717a]">
              {c.email}
            </span>
          )}
        </span>
      </span>
      <span className="min-w-0 pr-2">
        <span className="block truncate text-[#3f3f46]">
          {c.addressLine ?? "—"}
        </span>
        <span className="block truncate text-[11.5px] text-[#71717a]">
          {c.town ? `${c.town} · ` : ""}
          {c.postcode && <span className="font-mono">{c.postcode}</span>}
        </span>
      </span>
      <span className="text-[#3f3f46]">{c.phone ?? "—"}</span>
      <span>
        <CountPill total={c.leadCount} live={c.liveLeadCount} />
      </span>
      <span>
        <CountPill total={c.contractCount} />
      </span>
      <span className="min-w-0 pr-2">
        <span className="block truncate font-medium text-[#3f3f46]">
          {activity.primary}
        </span>
        <span
          className={`block truncate text-[11.5px] ${
            activity.amber ? "font-semibold text-[#b86e00]" : "text-[#71717a]"
          }`}
        >
          {activity.secondary}
        </span>
      </span>
      <span className="text-center text-[#a1a1aa]">›</span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-sm font-semibold text-[#3f3f46]">No customers found</p>
      <p className="text-[12.5px] text-[#71717a]">
        Try a different search or clear your filters.
      </p>
    </div>
  );
}
