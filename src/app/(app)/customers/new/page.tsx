import Link from "next/link";

import { CustomerForm } from "@/components/crm/customer-form";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 overflow-y-auto px-[26px] py-[22px]">
      <div className="text-[12.5px] text-[#71717a]">
        <Link href="/customers" className="hover:text-[#3f3f46]">
          Customers
        </Link>
        <span className="mx-1 text-[#d4d4d8]">/</span>
        <span className="font-semibold text-[#0a0a0a]">New customer</span>
      </div>
      <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
        New customer
      </h1>
      <CustomerForm cancelHref="/customers" />
    </div>
  );
}
