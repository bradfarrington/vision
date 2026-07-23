import { getCustomerAsMatch } from "@/lib/data/customer-match";
import { getTenantOptionLists } from "@/lib/data/customer-record";
import { getSalesStaff } from "@/lib/data/staff";
import { LeadForm } from "@/components/crm/lead-form";
import { RememberedLink } from "@/components/crm/view-state";

// Lookups the create wizard offers as tenant-editable pick-lists. The capture
// step now mints customers too, so it needs the customer-side lists (title,
// locality/town/county) alongside the lead's own.
const LOOKUP_KEYS = [
  "lead_source",
  "lead_sub_source",
  "product_type",
  "quote_type",
  "payment_method",
  "salesperson_type",
  "title",
  "locality",
  "town",
  "county",
];

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const sp = await searchParams;
  const [lookups, salesStaff, linked] = await Promise.all([
    getTenantOptionLists(LOOKUP_KEYS),
    getSalesStaff(),
    // Arriving from a customer record's "New lead" button — already answered.
    sp.customer ? getCustomerAsMatch(sp.customer) : Promise.resolve(null),
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
      {/* No "you need a customer first" gate any more: the capture step creates
          one when the caller isn't on the book. */}
      <LeadForm
        initialLinked={linked}
        cancelHref="/leads"
        heading="New Lead"
        lookups={lookups}
        salesStaff={salesStaff}
      />
    </div>
  );
}
