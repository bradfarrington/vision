import Link from "next/link";

import { gbp } from "@/lib/format";
import { leadRef, contractRef } from "@/lib/leads";
import type { CustomerLead, ContractSummary } from "@/lib/data/customers";
import { StageBadge, Pill, RefChip } from "./primitives";

// Horizontal lead card as used on the customer-detail "Leads & Contracts"
// column (design screen 03), pared back to what the column is scanned for:
// reference · what it is · what it's worth · where it's up to. Dates, source,
// salesperson and the follow-up are all one click away on the lead itself.
export function LeadCard({ lead }: { lead: CustomerLead }) {
  const value = lead.gross_value ?? lead.estimated_value;
  const dimmed = lead.status === "lost";

  return (
    <Link
      href={`/leads/${lead.id}`}
      className={`flex items-center gap-3.5 rounded-xl border border-[#e7e7ea] bg-white px-[18px] py-3.5 shadow-[0_1px_3px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#fafafa] ${
        dimmed ? "opacity-75" : ""
      }`}
    >
      <RefChip>{leadRef(lead.lead_number)}</RefChip>
      <div className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#0a0a0a]">
        {lead.product_type ?? lead.product_interest_1 ?? "Lead"}
      </div>
      <div className="shrink-0 text-[14px] font-bold text-[#0a0a0a]">{gbp(value)}</div>
      <StageBadge status={lead.status} />
      <span className="shrink-0 text-[#a1a1aa]">›</span>
    </Link>
  );
}

// `fromLead` is the originating lead's reference (L-2431). The card used to sit
// nested under that lead behind a connector elbow; now that leads and contracts
// stand in their own columns, the line of descent is stated in words — inline
// beside the title, so the card stays one line like the lead card.
export function ContractCard({
  contract,
  fromLead,
}: {
  contract: ContractSummary;
  fromLead?: string;
}) {
  return (
    <div className="rounded-xl border border-[#e7e7ea] bg-white px-[18px] py-4 shadow-[0_4px_12px_rgba(10,10,10,0.06)]">
      <div className="flex items-center gap-3.5">
        <RefChip inverted>{contractRef(contract.contract_number)}</RefChip>
        <div className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#0a0a0a]">
          {contract.contract_type ?? "Contract"}
          {fromLead && <span className="font-normal text-[#a1a1aa]"> from {fromLead}</span>}
        </div>
        <div className="shrink-0 text-[14px] font-bold text-[#0a0a0a]">
          {gbp(contract.gross_value)}
        </div>
        <Pill tone="amber">{contract.status ?? "In progress"}</Pill>
        <span className="shrink-0 text-[#a1a1aa]">›</span>
      </div>
    </div>
  );
}
