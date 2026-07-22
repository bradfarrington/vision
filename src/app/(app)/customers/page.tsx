import Link from "next/link";

import {
  getCustomers,
  latestLeadActivity,
  CUSTOMERS_PAGE_SIZE,
  type ValueCondition,
} from "@/lib/data/customers";
import { getUserPref } from "@/lib/data/user-layouts";
import { Icon, btnPrimary } from "@/components/crm/primitives";
import { SearchBox } from "@/components/crm/list-controls";
import {
  ColumnsButton,
  CustomerColumnsProvider,
  CustomerTable,
  FiltersButton,
  type CustomerRowView,
} from "@/components/crm/customers-list";
import { ViewStateSaver } from "@/components/crm/view-state";

// Customers list — transcribed from `Vision CRM Screens.dc.html` screen 02.
// Search / filters / pagination are URL-driven so the server re-queries; the
// column layout is a per-user preference (see customers-list.tsx).

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

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  // Every `f_<column>` param is a customer-column filter; collect them for the
  // server to apply against its allowlist.
  const columnFilters: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith("f_") && typeof v === "string" && v !== "") columnFilters[k.slice(2)] = v;
  }

  // Advanced value conditions ride in one `fq` param as a JSON array; parse
  // defensively (getCustomers validates each field against its allowlist).
  const valueFilters = parseValueFilters(sp.fq);

  // Default arrangement is customer number ascending: the sidebar link to
  // /customers carries no query, so leaving and returning always lands here.
  const sort = sp.sort ?? "customer_number";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const [{ rows, total, page, pageCount, filterOptions }, columnPref] = await Promise.all([
    getCustomers({
      search: sp.search,
      hasLiveLead: sp.live === "1",
      page: sp.page ? Number(sp.page) : 1,
      columnFilters,
      valueFilters,
      sort,
      dir,
    }),
    getUserPref("customers_columns"),
  ]);

  const from = total === 0 ? 0 : (page - 1) * CUSTOMERS_PAGE_SIZE + 1;
  const to = Math.min(page * CUSTOMERS_PAGE_SIZE, total);

  // Derive each row's "last activity" here (the helper lives with the server
  // data layer), so the client table renders without re-importing server code.
  const views: CustomerRowView[] = rows.map((c) => ({ c, activity: latestLeadActivity(c) }));

  return (
    <CustomerColumnsProvider saved={columnPref}>
      {/* Remembers this list's filters/sort for the session so returning here
          restores them instead of resetting to the default. */}
      <ViewStateSaver />
      {/* saved carries { order, widths } — the provider sanitises the shape. */}
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
            <FiltersButton filterOptions={filterOptions} />
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
        </div>

        <CustomerTable
          views={views}
          total={total}
          page={page}
          pageCount={pageCount}
          from={from}
          to={to}
          sort={sort}
          dir={dir}
        />
      </div>
    </CustomerColumnsProvider>
  );
}
