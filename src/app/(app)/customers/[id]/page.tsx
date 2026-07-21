import Link from "next/link";
import { notFound } from "next/navigation";

import { getCustomer, type CustomerDetail } from "@/lib/data/customers";
import { gbp } from "@/lib/format";
import { isLiveLead } from "@/lib/leads";
import {
  Avatar,
  Card,
  CardTitle,
  Icon,
  btnPrimary,
  btnSecondary,
} from "@/components/crm/primitives";
import { IllustrativeMap } from "@/components/crm/illustrative-map";
import { LeadCard, ContractCard } from "@/components/crm/lead-card";

// Customer detail — transcribed from `Vision CRM Screens.dc.html` screen 03.
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const liveLeads = customer.leads.filter((l) => isLiveLead(l.status)).length;
  const lifetimeValue = customer.leads
    .filter((l) => l.status === "won")
    .reduce((sum, l) => sum + Number(l.gross_value ?? 0), 0);

  const typeLabel =
    customer.customerType === "commercial" ? "Commercial" : "Residential";

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[26px] py-[22px]">
      {/* Breadcrumb */}
      <div className="text-[12.5px] text-[#71717a]">
        <Link href="/customers" className="hover:text-[#3f3f46]">
          Customers
        </Link>
        <span className="mx-1 text-[#d4d4d8]">/</span>
        <span className="font-semibold text-[#0a0a0a]">{customer.displayName}</span>
      </div>

      {/* Identity header */}
      <div className="flex items-center gap-3.5">
        <Avatar name={customer.displayName} size={46} />
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
              {customer.displayName}
            </h1>
            <span className="rounded-full bg-[#f4f4f5] px-[9px] py-[3px] text-[11px] font-semibold text-[#52525b]">
              {typeLabel}
            </span>
          </div>
          <div className="mt-0.5 text-[12.5px] text-[#71717a]">
            Customer since {longDate(customer.createdAt)}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <button className={btnSecondary} type="button">
            <Icon name="message" size={13} strokeWidth={1.75} /> Message
          </button>
          <Link href={`/customers/${customer.id}/edit`} className={btnSecondary}>
            Edit
          </Link>
          <Link href={`/leads/new?customer=${customer.id}`} className={btnPrimary}>
            <Icon name="plus" size={13} strokeWidth={2.2} /> New Lead
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 gap-[18px]">
        {/* Left column */}
        <div className="flex w-[350px] shrink-0 flex-col gap-3.5">
          <ContactCard customer={customer} />
          <AddressCard customer={customer} />
          <Card className="flex-1">
            <CardTitle className="mb-2">Customer notes</CardTitle>
            <p className="text-[12.5px] leading-[1.6] text-[#3f3f46]">
              {customer.notes ?? "No notes recorded for this customer yet."}
            </p>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="font-[family-name:var(--font-inter-tight)] text-[16px] font-bold text-[#0a0a0a]">
              Leads &amp; contracts
            </h2>
            <span className="text-xs text-[#71717a]">
              {customer.leadCount} {plural(customer.leadCount, "lead")} · {liveLeads} live ·{" "}
              {customer.contractCount} {plural(customer.contractCount, "contract")}
              {lifetimeValue > 0 && (
                <>
                  {" "}
                  · lifetime value{" "}
                  <strong className="text-[#0a0a0a]">{gbp(lifetimeValue)}</strong>
                </>
              )}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {customer.leads.length === 0 && customer.contracts.length === 0 ? (
              <Card className="text-center text-[12.5px] text-[#71717a]">
                No leads yet.{" "}
                <Link
                  href={`/leads/new?customer=${customer.id}`}
                  className="font-semibold text-[var(--accent-blue)]"
                >
                  Create the first lead →
                </Link>
              </Card>
            ) : (
              customer.leads.map((lead) => (
                <div key={lead.id} className="flex flex-col gap-3">
                  <LeadCard lead={lead} />
                  {customer.contracts
                    .filter((ct) => ct.lead_id === lead.id)
                    .map((ct) => (
                      <ContractCard key={ct.id} contract={ct} />
                    ))}
                </div>
              ))
            )}
            {/* Contracts with no matching lead in this view. */}
            {customer.contracts
              .filter((ct) => !customer.leads.some((l) => l.id === ct.lead_id))
              .map((ct) => (
                <ContractCard key={ct.id} contract={ct} />
              ))}
          </div>

          <div className="mt-auto flex items-center gap-6 rounded-xl border border-[#e7e7ea] bg-[#fafafa] px-[18px] py-3 text-xs text-[#52525b]">
            <span className="font-bold text-[#0a0a0a]">Recent activity</span>
            <span className="truncate">
              A full activity timeline lands with the comms module.
            </span>
            <Link
              href="#"
              className="ml-auto font-semibold text-[var(--accent-blue)]"
            >
              View all →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactCard({ customer }: { customer: CustomerDetail }) {
  const rows: [string, string | null][] = [
    ["Mobile", customer.mobile],
    ["Phone", customer.phone],
    ["Email", customer.email],
    ["Home telephone", customer.homeTelephone],
    ["Work telephone", customer.workTelephone],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <Card>
      <CardTitle className="mb-2">Contact</CardTitle>
      {rows.length === 0 ? (
        <p className="py-1 text-[12.5px] text-[#71717a]">No contact details on file.</p>
      ) : (
        rows.map(([label, value], i) => (
          <div
            key={label}
            className={`flex justify-between gap-3 py-2 text-[12.5px] ${
              i < rows.length - 1 ? "border-b border-[#f4f4f5]" : ""
            }`}
          >
            <span className="text-[#71717a]">{label}</span>
            <span className="font-medium text-[#3f3f46]">{value}</span>
          </div>
        ))
      )}
    </Card>
  );
}

function AddressCard({ customer }: { customer: CustomerDetail }) {
  const line1 = [customer.houseName, customer.houseNumber, customer.street]
    .filter(Boolean)
    .join(" ")
    .trim();
  const line2 = [customer.town, customer.county].filter(Boolean).join(", ");
  const hasAddress = line1 || line2 || customer.postcode;

  return (
    <Card>
      <CardTitle className="mb-2">Address</CardTitle>
      {hasAddress ? (
        <>
          <div className="text-[13px] leading-[1.55]">
            {line1 && <div>{line1}</div>}
            {line2 && <div>{line2}</div>}
            {customer.postcode && (
              <div className="font-mono font-semibold text-[#0a0a0a]">
                {customer.postcode}
              </div>
            )}
          </div>
          {customer.whatThreeWords && (
            <span className="mt-2.5 inline-flex rounded-full bg-[#f4f4f5] px-[9px] py-[3px] font-mono text-[11px] font-semibold text-[#52525b]">
              {customer.whatThreeWords}
            </span>
          )}
          <IllustrativeMap className="mt-3" />
        </>
      ) : (
        <p className="py-1 text-[12.5px] text-[#71717a]">No address on file.</p>
      )}
    </Card>
  );
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

function longDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
