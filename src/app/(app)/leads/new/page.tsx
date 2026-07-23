import Link from "next/link";

import { getCustomerOptions } from "@/lib/data/customers";
import { getTenantOptionLists } from "@/lib/data/customer-record";
import { getSalesStaff } from "@/lib/data/staff";
import { LeadForm } from "@/components/crm/lead-form";
import { RememberedLink } from "@/components/crm/view-state";

// Lookups the create wizard offers as tenant-editable pick-lists.
const LOOKUP_KEYS = [
  "lead_source",
  "lead_sub_source",
  "product_type",
  "quote_type",
  "payment_method",
  "salesperson_type",
];

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const sp = await searchParams;
  const [customers, lookups, salesStaff] = await Promise.all([
    getCustomerOptions(),
    getTenantOptionLists(LOOKUP_KEYS),
    getSalesStaff(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[26px] py-[22px]">
      <div className="text-[12.5px] text-[#71717a]">
        <RememberedLink href="/leads" className="hover:text-[#3f3f46]">
          Leads
        </RememberedLink>
        <span className="mx-1 text-[#d4d4d8]">/</span>
        <span className="font-semibold text-[#0a0a0a]">New lead</span>
      </div>
      {customers.length === 0 ? (
        <div className="rounded-xl border border-[#e7e7ea] bg-white p-6 text-center text-[13px] text-[#71717a]">
          You need a customer first.{" "}
          <Link href="/customers/new" className="font-semibold text-[var(--accent-blue)]">
            Create a customer →
          </Link>
        </div>
      ) : (
        // The wizard renders its own sticky heading + step tracker, so the page
        // contributes only the breadcrumb.
        <LeadForm
          customers={customers}
          defaultCustomerId={sp.customer}
          cancelHref="/leads"
          heading="New Lead"
          lookups={lookups}
          salesStaff={salesStaff}
        />
      )}
    </div>
  );
}
