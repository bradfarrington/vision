import Link from "next/link";

import { CustomerForm } from "@/components/crm/customer-form";
import { getTenantOptionLists } from "@/lib/data/customer-record";
import { getSalesStaff } from "@/lib/data/staff";

// Lookups the create form offers as tenant-editable pick-lists.
const LOOKUP_KEYS = ["title", "locality", "town", "county", "payment_terms", "marketing_source", "consent_by"];

export default async function NewCustomerPage() {
  const [lookups, salesUsers] = await Promise.all([
    getTenantOptionLists(LOOKUP_KEYS),
    getSalesStaff(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[26px] py-[22px]">
      <div className="text-[12.5px] text-[#71717a]">
        <Link href="/customers" className="hover:text-[#3f3f46]">
          Customers
        </Link>
        <span className="mx-1 text-[#d4d4d8]">/</span>
        <span className="font-semibold text-[#0a0a0a]">New customer</span>
      </div>
      <CustomerForm
        cancelHref="/customers"
        heading="New customer"
        lookups={lookups}
        salesUsers={salesUsers}
      />
    </div>
  );
}
