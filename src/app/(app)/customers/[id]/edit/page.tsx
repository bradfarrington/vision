import Link from "next/link";
import { notFound } from "next/navigation";

import { getCustomer } from "@/lib/data/customers";
import { getTenantOptionLists } from "@/lib/data/customer-record";
import { CustomerForm } from "@/components/crm/customer-form";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, lookups] = await Promise.all([
    getCustomer(id),
    getTenantOptionLists(["title", "locality", "town", "county"]),
  ]);
  if (!customer) notFound();

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[26px] py-[22px]">
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
      <CustomerForm
        cancelHref={`/customers/${customer.id}`}
        heading={`Edit ${customer.displayName}`}
        lookups={lookups}
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
