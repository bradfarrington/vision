import Link from "next/link";

import { getCustomerOptions } from "@/lib/data/customers";
import { LeadForm } from "@/components/crm/lead-form";

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const sp = await searchParams;
  const customers = await getCustomerOptions();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 overflow-y-auto px-[26px] py-[22px]">
      <div className="text-[12.5px] text-[#71717a]">
        <Link href="/leads" className="hover:text-[#3f3f46]">
          Leads
        </Link>
        <span className="mx-1 text-[#d4d4d8]">/</span>
        <span className="font-semibold text-[#0a0a0a]">New lead</span>
      </div>
      <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
        New lead
      </h1>
      {customers.length === 0 ? (
        <div className="rounded-xl border border-[#e7e7ea] bg-white p-6 text-center text-[13px] text-[#71717a]">
          You need a customer first.{" "}
          <Link href="/customers/new" className="font-semibold text-[var(--accent-blue)]">
            Create a customer →
          </Link>
        </div>
      ) : (
        <LeadForm customers={customers} defaultCustomerId={sp.customer} cancelHref="/leads" />
      )}
    </div>
  );
}
