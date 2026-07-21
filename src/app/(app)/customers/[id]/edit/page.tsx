import Link from "next/link";
import { notFound } from "next/navigation";

import { getCustomer } from "@/lib/data/customers";
import { CustomerForm } from "@/components/crm/customer-form";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 overflow-y-auto px-[26px] py-[22px]">
      <div className="text-[12.5px] text-[#71717a]">
        <Link href="/customers" className="hover:text-[#3f3f46]">
          Customers
        </Link>
        <span className="mx-1 text-[#d4d4d8]">/</span>
        <Link href={`/customers/${customer.id}`} className="hover:text-[#3f3f46]">
          {customer.displayName}
        </Link>
        <span className="mx-1 text-[#d4d4d8]">/</span>
        <span className="font-semibold text-[#0a0a0a]">Edit</span>
      </div>
      <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
        Edit {customer.displayName}
      </h1>
      <CustomerForm
        cancelHref={`/customers/${customer.id}`}
        initial={{
          id: customer.id,
          customer_type: customer.customerType,
          title: customer.title,
          first_name: customer.firstName,
          last_name: customer.lastName,
          company_name: customer.companyName,
          email: customer.email,
          phone: customer.phone,
          mobile: customer.mobile,
          home_telephone: customer.homeTelephone,
          house_name: customer.houseName,
          house_number: customer.houseNumber,
          street: customer.street,
          locality: customer.locality,
          town: customer.town,
          county: customer.county,
          postcode: customer.postcode,
          what_3_words: customer.whatThreeWords,
          notes: customer.notes,
        }}
      />
    </div>
  );
}
