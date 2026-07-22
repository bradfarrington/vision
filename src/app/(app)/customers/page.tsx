import Link from "next/link";

import {
  getCustomers,
  latestLeadActivity,
  CUSTOMERS_PAGE_SIZE,
} from "@/lib/data/customers";
import { getUserOrder } from "@/lib/data/user-layouts";
import { Icon, btnPrimary } from "@/components/crm/primitives";
import { SearchBox } from "@/components/crm/list-controls";
import {
  ColumnsButton,
  CustomerColumnsProvider,
  CustomerTable,
  FiltersButton,
  type CustomerRowView,
} from "@/components/crm/customers-list";

// Customers list — transcribed from `Vision CRM Screens.dc.html` screen 02.
// Search / filters / pagination are URL-driven so the server re-queries; the
// column layout is a per-user preference (see customers-list.tsx).

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
  const [{ rows, total, page, pageCount, towns }, columnPref] = await Promise.all([
    getCustomers({
      search: sp.search,
      town: sp.town,
      hasLiveLead: sp.live === "1",
      page: sp.page ? Number(sp.page) : 1,
    }),
    getUserOrder("customers_columns"),
  ]);

  const from = total === 0 ? 0 : (page - 1) * CUSTOMERS_PAGE_SIZE + 1;
  const to = Math.min(page * CUSTOMERS_PAGE_SIZE, total);

  // Derive each row's "last activity" here (the helper lives with the server
  // data layer), so the client table renders without re-importing server code.
  const views: CustomerRowView[] = rows.map((c) => ({ c, activity: latestLeadActivity(c) }));

  return (
    <CustomerColumnsProvider saved={columnPref}>
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
            <ColumnsButton />
            <FiltersButton towns={towns} />
            <button className="inline-flex items-center gap-[7px] rounded-lg border border-[#e7e7ea] bg-white px-3 py-2 text-[13px] font-semibold text-[#3f3f46] transition-colors hover:bg-[#fafafa]" type="button">
              <Icon name="export" size={13} /> Export
            </button>
            <Link href="/customers/new" className={btnPrimary}>
              <Icon name="plus" size={13} strokeWidth={2.2} /> New Customer
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <SearchBox placeholder="Name, postcode, phone…" />
          <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-[#71717a]">
            Sort: Last activity
            <Icon name="chevron-down" size={11} className="text-[#71717a]" />
          </span>
        </div>

        <CustomerTable
          views={views}
          total={total}
          page={page}
          pageCount={pageCount}
          from={from}
          to={to}
        />
      </div>
    </CustomerColumnsProvider>
  );
}
