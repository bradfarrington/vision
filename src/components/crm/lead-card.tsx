import Link from "next/link";

import { gbp } from "@/lib/format";
import { isLiveLead, leadRef, contractRef } from "@/lib/leads";
import type { CustomerLead, ContractSummary } from "@/lib/data/customers";
import { StageBadge, Pill, RefChip } from "./primitives";

// Horizontal lead card as used on the customer-detail "Leads & contracts"
// column (design screen 03). ID chip · title + meta · value · status · chevron.
export function LeadCard({ lead }: { lead: CustomerLead }) {
  const value = lead.gross_value ?? lead.estimated_value;
  const meta = [
    lead.lead_date && `Received ${dateLong(lead.lead_date)}`,
    lead.source && (lead.sub_source ? `${lead.source} / ${lead.sub_source}` : lead.source),
    lead.salesman,
  ]
    .filter(Boolean)
    .join(" · ");
  const dimmed = lead.status === "lost";

  return (
    <Link
      href={`/leads/${lead.id}`}
      className={`flex items-center gap-3.5 rounded-xl border border-[#e7e7ea] bg-white px-[18px] py-3.5 shadow-[0_1px_3px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#fafafa] ${
        dimmed ? "opacity-75" : ""
      }`}
    >
      <RefChip>{leadRef(lead.lead_number)}</RefChip>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-[#0a0a0a]">
          {lead.product_type ?? lead.product_interest_1 ?? "Lead"}
          {lead.product_interest_2 && (
            <span className="font-normal text-[#71717a]">
              {" "}
              + {lead.product_interest_2} interest
            </span>
          )}
        </div>
        {meta && <div className="mt-0.5 truncate text-[11.5px] text-[#71717a]">{meta}</div>}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[14px] font-bold text-[#0a0a0a]">{gbp(value)}</div>
        {lead.follow_up_date && isLiveLead(lead.status) && (
          <div className="text-[11px] font-semibold text-[#b86e00]">
            follow-up {dateShort(lead.follow_up_date)}
          </div>
        )}
      </div>
      <StageBadge status={lead.status} />
      <span className="shrink-0 text-[#a1a1aa]">›</span>
    </Link>
  );
}

// `fromLead` is the originating lead's reference (L-2431). The card used to sit
// nested under that lead behind a connector elbow; now that leads and contracts
// stand in their own columns, the line of descent has to be stated in words.
export function ContractCard({
  contract,
  fromLead,
}: {
  contract: ContractSummary;
  fromLead?: string;
}) {
  const meta = [
    contract.contract_date && `Signed ${dateLong(contract.contract_date)}`,
    fromLead && `from ${fromLead}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-xl border border-[#e7e7ea] bg-white px-[18px] py-4 shadow-[0_4px_12px_rgba(10,10,10,0.06)]">
      <div className="flex items-center gap-3.5">
        <RefChip inverted>{contractRef(contract.contract_number)}</RefChip>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-[#0a0a0a]">
            {contract.contract_type ?? "Contract"}
          </div>
          {meta && <div className="mt-0.5 truncate text-[11.5px] text-[#71717a]">{meta}</div>}
        </div>
        <div className="shrink-0 text-right text-[14px] font-bold text-[#0a0a0a]">
          {gbp(contract.gross_value)}
        </div>
        <Pill tone="amber">{contract.status ?? "In progress"}</Pill>
        <span className="shrink-0 text-[#a1a1aa]">›</span>
      </div>
    </div>
  );
}

function dateLong(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function dateShort(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
