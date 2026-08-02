import Link from "next/link";
import { notFound } from "next/navigation";

import { getContract, type ContractDetail, type FinanceLine } from "@/lib/data/contracts";
import { getTenantOptionLists, type TenantOption } from "@/lib/data/customer-record";
import { getSalesStaff, type StaffOption } from "@/lib/data/staff";
import { gbp, humanLabel } from "@/lib/format";
import type { AddressParts } from "@/lib/data/leads";
import { Card, CardTitle, Icon, Pill, RefChip, btnSecondary } from "@/components/crm/primitives";
import { EditableField, type EditableType } from "@/components/crm/editable-field";
import { updateContractField } from "@/app/(app)/contracts/actions";
import { addSalesStaff, deleteSalesStaff } from "@/app/(app)/customers/actions";
import { AddressMap } from "@/components/crm/address-map";
import { RememberedLink } from "@/components/crm/view-state";
import { Tabs } from "@/components/crm/tabs";
import { NotesPanel } from "@/components/crm/notes-panel";
import { DocumentsPanel } from "@/components/crm/documents-panel";
import { getUserOrder } from "@/lib/data/user-layouts";
import {
  ContractChecklistToggle,
  ContractStageChanger,
  StageStepper,
} from "@/components/crm/contract-interactions";
import { cn } from "@/lib/utils";

// Contract detail — transcribed from `Vision CRM Screens.dc.html` screen 05.
//
// FIVE tabs, not the design's nine: Communications, Fitting, Deliveries & stock
// and Service calls belong to Phases 6/7/8 and a dead tab is worse than a
// missing one (the same call that kept Quotes off the lead record until now).
export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) notFound();

  const [opts, salesStaff, tabOrder] = await Promise.all([
    getTenantOptionLists(["lead_source", "contract_type", "payment_method", "document_category"]),
    getSalesStaff(),
    getUserOrder("contract_tabs"),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto px-[26px] py-[22px]">
      {/* Back to the contracts list, restoring its remembered filters/sort. The
          contract's ref lives in the identity row below — no breadcrumb. */}
      <RememberedLink
        href="/contracts"
        className="inline-flex w-fit items-center gap-1 text-[12.5px] text-[#71717a] hover:text-[#3f3f46]"
      >
        <Icon name="chevron-left" size={14} strokeWidth={1.75} />
        Contracts
      </RememberedLink>

      {/* Identity row */}
      <div className="flex items-center gap-3">
        <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
          {contract.title}
        </h1>
        <RefChip>{contract.ref}</RefChip>
        <ContractStageChanger contractId={contract.id} stage={contract.stage} />
        {contract.onHold && <Pill tone="amber">On hold</Pill>}
        <span className="ml-1 text-[14px] font-bold text-[#0a0a0a]">{gbp(contract.value)}</span>
        {/* Provenance — where this job came from. The design's "↩ Converted from
            L-2103" line, as a link back to the enquiry. */}
        {contract.lead && (
          <Link
            href={`/leads/${contract.lead.id}`}
            className="flex items-center gap-1.5 text-[12px] text-[#71717a] hover:text-[#3f3f46]"
          >
            <Icon name="arrow-right" size={12} strokeWidth={1.75} />
            Converted from <RefChip>{contract.lead.ref}</RefChip>
          </Link>
        )}
        <div className="ml-auto flex items-center gap-2.5">
          {contract.customer && (
            <Link className={btnSecondary} href={`/customers/${contract.customer.id}`}>
              <Icon name="user" size={13} strokeWidth={1.75} /> View customer
            </Link>
          )}
        </div>
      </div>

      {/* The job's progress, and the control that moves it — every step is
          clickable, so the stepper isn't a picture of the state sitting next to
          the only thing that changes it. */}
      <StageStepper
        contractId={contract.id}
        stage={contract.stage}
        dates={{
          signed: fmtShort(contract.contractDate),
          survey: fmtShort(contract.surveyDate),
          ordered: fmtShort(contract.orderDate),
          delivery: null,
          installation: installRange(contract),
          complete: fmtShort(contract.completedDate),
        }}
      />

      <Tabs
        layoutKey="contract_tabs"
        savedOrder={tabOrder}
        tabs={[
          {
            label: "Overview",
            content: <OverviewTab contract={contract} opts={opts} salesStaff={salesStaff} />,
          },
          {
            label: "Financials",
            count: contract.financeLines.length,
            content: <FinancialsPanel contract={contract} />,
          },
          {
            label: "Notes",
            count: contract.noteThread.length,
            content: contract.customer ? (
              // The shared notes panel: stamped, versioned, with attachments.
              // `fixedLink` files every new note against THIS contract while
              // keeping customer_id set, so it reads from both records.
              <NotesPanel
                customerId={contract.customer.id}
                fixedLink={{ kind: "contract", id: contract.id }}
                notes={contract.noteThread}
                documents={contract.documents}
                linkTargets={[]}
              />
            ) : (
              <NoCustomer what="Notes" />
            ),
          },
          {
            label: "Documents",
            count: contract.documents.filter((d) => d.contractId === contract.id).length,
            content: contract.customer ? (
              <DocumentsPanel
                ownerType="contract"
                ownerId={contract.id}
                customerId={contract.customer.id}
                documents={contract.documents}
                categoryOptions={opts.document_category ?? []}
              />
            ) : (
              <NoCustomer what="Documents" />
            ),
          },
          {
            label: "Checklist",
            count: contract.checklist.length,
            content: <ChecklistPanel contract={contract} />,
          },
        ]}
      />
    </div>
  );
}

/**
 * Overview — a BENTO of independent column stacks (the house style, see
 * AGENTS.md § Bento layout), not a row-aligned grid.
 */
function OverviewTab({
  contract,
  opts,
  salesStaff,
}: {
  contract: ContractDetail;
  opts: Record<string, TenantOption[]>;
  salesStaff: StaffOption[];
}) {
  return (
    <div className="grid max-w-[1320px] items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="flex flex-col gap-4">
        <ContractPanel contract={contract} opts={opts} salesStaff={salesStaff} />
        <GuaranteePanel contract={contract} opts={opts} />
      </div>
      <div className="flex flex-col gap-4">
        {/* The customer themselves, so their address can be read directly
            against the site address just below it. */}
        <CustomerPanel contract={contract} />
        <AddressesPanel contract={contract} />
      </div>
      <div className="flex flex-col gap-4">
        {/* "Where is this?" is its own question — the map is its own card. */}
        {contract.site.postcode && (
          <Card>
            <CardTitle className="mb-2 text-[14px]">Location</CardTitle>
            <AddressMap
              height={220}
              {...contract.site.fields}
              what3words={contract.site.whatThreeWords}
            />
          </Card>
        )}
        <ProductsPanel contract={contract} />
      </div>
    </div>
  );
}

function ContractPanel({
  contract,
  opts,
  salesStaff,
}: {
  contract: ContractDetail;
  opts: Record<string, TenantOption[]>;
  salesStaff: StaffOption[];
}) {
  return (
    <Card>
      <CardTitle className="mb-2 text-[14px]">Contract</CardTitle>
      <FieldRow label="Contract no.">{contract.contractNumber ?? "—"}</FieldRow>
      <EC contractId={contract.id} label="Contract Date" field="contract_date" value={contract.contractDate} type="date" />
      <EC contractId={contract.id} label="Type" field="contract_type" value={contract.contractType} type="lookup" listKey="contract_type" opts={opts} />
      <EC contractId={contract.id} label="Value" field="gross_value" value={contract.value} type="number" />
      {/* Carried across at conversion; the contract owns its copy from then on. */}
      <EC
        contractId={contract.id}
        label="Salesperson"
        field="salesman"
        value={contract.salesman}
        type="lookup"
        lookupOptions={salesStaff}
        onAddNew={addSalesStaff}
        onDeleteOption={deleteSalesStaff}
      />
      <EC contractId={contract.id} label="Source" field="source" value={contract.source} type="lookup" listKey="lead_source" opts={opts} />
      <EC contractId={contract.id} label="Sales Area" field="sales_area" value={contract.salesArea} />
      <EC contractId={contract.id} label="Install Manager" field="installation_manager" value={contract.installationManager} />
      <EC contractId={contract.id} label="Est. Fitting Days" field="estimated_fitting_days" value={contract.estimatedFittingDays} type="number" />
      <EC contractId={contract.id} label="Supply Only" field="supply_only" value={contract.supplyOnly} type="boolean" />
      <EC contractId={contract.id} label="On Hold" field="on_hold" value={contract.onHold} type="boolean" />
      {contract.onHold && (
        <EC contractId={contract.id} label="Hold Reason" field="hold_reason" value={contract.holdReason} type="textarea" />
      )}
      <EC contractId={contract.id} label="Office Ref" field="office_reference" value={contract.officeReference} />
      <FieldRow label="Status" border={false}>
        <Pill tone={contract.cancelled ? "danger" : "success"}>
          {humanLabel(contract.cancelled ? "cancelled" : (contract.status ?? "active"))}
        </Pill>
      </FieldRow>
    </Card>
  );
}

/**
 * Guarantees live on the contract for now. The design notes that warranties
 * belong on the PRODUCT record rather than the contract ("10-yr warranty held on
 * product record →", screen 05) — that arrives with the stock phase; these
 * columns already exist and are what a job's paperwork is filed under today.
 */
function GuaranteePanel({
  contract,
  opts,
}: {
  contract: ContractDetail;
  opts: Record<string, TenantOption[]>;
}) {
  void opts;
  return (
    <Card>
      <CardTitle className="mb-2 text-[14px]">Guarantee &amp; sign-off</CardTitle>
      <EC contractId={contract.id} label="Guarantee No." field="guarantee_number" value={contract.guaranteeNumber} />
      <EC contractId={contract.id} label="Guarantee Date" field="guarantee_date" value={contract.guaranteeDate} type="date" />
      <EC contractId={contract.id} label="IBG Ref" field="insurance_backed_guarantee_ref" value={contract.insuranceBackedGuaranteeRef} />
      <EC contractId={contract.id} label="Signboard Left" field="signboard_left" value={contract.signboardLeft} type="boolean" />
      <EC contractId={contract.id} label="Notes" field="notes" value={contract.notes} type="textarea" />
    </Card>
  );
}

function ProductsPanel({ contract }: { contract: ContractDetail }) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <CardTitle className="text-[14px]">Products</CardTitle>
        {contract.products.length > 0 && (
          <span className="text-[12px] font-medium text-[#a1a1aa]">{contract.products.length}</span>
        )}
      </div>
      {contract.products.length === 0 ? (
        <p className="py-1 text-[12px] text-[#71717a]">
          No products on this contract yet. They arrive with the quote that raised it.
        </p>
      ) : (
        contract.products.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              "flex items-start justify-between gap-2.5 py-[7px] text-[12px]",
              i < contract.products.length - 1 && "border-b border-[#f4f4f5]",
            )}
          >
            <span className="min-w-0">
              <span className="block font-semibold text-[#0a0a0a]">{p.name}</span>
              {p.description && (
                <span className="mt-0.5 block text-[11.5px] text-[#71717a]">{p.description}</span>
              )}
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-semibold text-[#0a0a0a]">{gbp(p.totalPrice)}</span>
              {p.quantity != null && p.quantity > 1 && (
                <span className="block text-[11px] text-[#a1a1aa]">×{p.quantity}</span>
              )}
            </span>
          </div>
        ))
      )}
    </Card>
  );
}

/**
 * Financials — what the job is worth, what has been paid, what is outstanding.
 * The balance is computed the same way the customer record's Financials panel
 * computes it: contract value minus everything recorded as paid on
 * `finance_lines`.
 */
function FinancialsPanel({ contract }: { contract: ContractDetail }) {
  const outstanding = contract.balance;
  return (
    <div className="flex max-w-[1320px] flex-col gap-4">
      <div className="flex flex-wrap items-stretch gap-2.5">
        <StatTile label="Contract Value" value={gbp(contract.value)} rule="bg-[#a1a1aa]" tone="text-[#0a0a0a]" />
        <StatTile label="Paid" value={gbp(contract.paid)} rule="bg-[#1a7f3e]" tone="text-[#1a7f3e]" />
        {/* Outstanding is red only when there IS something outstanding — a
            settled contract showing a red zero would cry wolf. */}
        <StatTile
          label="Outstanding"
          value={gbp(outstanding)}
          rule={outstanding > 0 ? "bg-[#d64545]" : "bg-[#a1a1aa]"}
          tone={outstanding > 0 ? "text-[#d64545]" : "text-[#0a0a0a]"}
        />
      </div>

      <Card>
        <CardTitle className="mb-2 text-[14px]">Finance lines</CardTitle>
        {contract.financeLines.length === 0 ? (
          <p className="py-1 text-[12px] text-[#71717a]">
            Nothing recorded against this contract yet — charges, invoices and payments will show
            here.
          </p>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-2 border-b border-[#e7e7ea] pb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[#a1a1aa]">
              <span>Type</span>
              <span>Invoice</span>
              <span className="text-right">Charge</span>
              <span className="text-right">Paid</span>
              <span className="text-right">Date</span>
            </div>
            {contract.financeLines.map((f) => (
              <FinanceRow key={f.id} line={f} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function FinanceRow({ line }: { line: FinanceLine }) {
  return (
    <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-2 border-b border-[#f4f4f5] py-[7px] text-[12px] last:border-b-0">
      <span className="min-w-0 truncate font-semibold text-[#0a0a0a]">
        {humanLabel(line.lineType)}
      </span>
      <span className="min-w-0 truncate text-[#3f3f46]">{line.invoiceNumber ?? "—"}</span>
      <span className="text-right text-[#3f3f46]">
        {line.chargeAmount != null ? gbp(line.chargeAmount) : "—"}
      </span>
      <span className="text-right font-medium text-[#1a7f3e]">
        {line.paymentAmount != null ? gbp(line.paymentAmount) : "—"}
      </span>
      <span className="text-right text-[#71717a]">{fmtShort(line.paymentDate) ?? "—"}</span>
    </div>
  );
}

function StatTile({
  label,
  value,
  rule,
  tone,
}: {
  label: string;
  value: string;
  rule: string;
  tone: string;
}) {
  return (
    <div className="relative min-w-[164px] overflow-hidden rounded-xl border border-[#e7e7ea] bg-white px-3.5 py-2.5">
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", rule)} />
      <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">{label}</div>
      <div
        className={cn(
          "font-[family-name:var(--font-inter-tight)] text-[18px] font-extrabold tracking-[-0.01em]",
          tone,
        )}
      >
        {value}
      </div>
    </div>
  );
}

function EC({
  contractId,
  label,
  field,
  value,
  type = "text",
  listKey,
  opts,
  lookupOptions,
  onAddNew,
  onDeleteOption,
}: {
  contractId: string;
  label: string;
  field: string;
  value: string | number | boolean | null;
  type?: EditableType;
  /** tenant_options list_key — its options are read from `opts`. */
  listKey?: string;
  opts?: Record<string, TenantOption[]>;
  /** Bespoke option source (e.g. staff), used instead of listKey/opts. */
  lookupOptions?: TenantOption[];
  onAddNew?: (label: string) => Promise<{ label?: string; error?: string }>;
  onDeleteOption?: (id: string) => Promise<{ error?: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 border-b border-[#f4f4f5] py-1.5 text-[12px]">
      <span className="text-[#71717a]">{label}</span>
      <EditableField
        id={contractId}
        field={field}
        value={value}
        action={updateContractField}
        type={type}
        listKey={listKey}
        lookupOptions={lookupOptions ?? (listKey ? (opts?.[listKey] ?? []) : undefined)}
        onAddNew={onAddNew}
        onDeleteOption={onDeleteOption}
      />
    </div>
  );
}

function CustomerPanel({ contract }: { contract: ContractDetail }) {
  const c = contract.customer;
  if (!c) return null;
  const a = c.address;
  const hasAddress = a.line1 || a.line2 || a.postcode;
  const hasContact = c.mobile || c.home || c.email;
  return (
    <Card>
      <div className="mb-1.5 flex items-center justify-between">
        <CardTitle className="text-[14px]">Customer</CardTitle>
        <Link
          href={`/customers/${c.id}`}
          className="text-[12px] font-medium text-[var(--accent-blue)] hover:underline"
        >
          View →
        </Link>
      </div>

      <div className="text-[13px] font-semibold text-[#0a0a0a]">{c.name}</div>

      {hasAddress ? (
        <div className="mt-1 text-[12.5px] leading-[1.5] text-[#3f3f46]">
          {[a.line1, a.line2].filter(Boolean).join(", ")}
          {a.postcode && (
            <>
              {" · "}
              <span className="font-mono font-semibold text-[#0a0a0a]">{a.postcode}</span>
            </>
          )}
        </div>
      ) : (
        <div className="mt-1 text-[12.5px] text-[#a1a1aa]">No address on file</div>
      )}

      {hasContact && (
        <div className="mt-2 flex flex-col gap-1 border-t border-[#f4f4f5] pt-2">
          <ContactRow icon="phone" label="Mobile" value={c.mobile} />
          <ContactRow icon="phone" label="Home" value={c.home} />
          <ContactRow icon="envelope" label="Email" value={c.email} />
        </div>
      )}
    </Card>
  );
}

function ContactRow({
  icon,
  label,
  value,
}: {
  icon: "phone" | "envelope";
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-[12px]">
      <span className="flex items-center gap-1.5 text-[#71717a]">
        <Icon name={icon} size={12} strokeWidth={1.75} /> {label}
      </span>
      <span className="text-right font-medium text-[#3f3f46]">{value}</span>
    </div>
  );
}

function AddressesPanel({ contract }: { contract: ContractDetail }) {
  return (
    <Card className="min-h-0 flex-1 overflow-y-auto">
      <div className="mb-1.5 flex items-center justify-between">
        <CardTitle className="text-[14px]">Addresses</CardTitle>
        {/* Deliberate wording: these were COPIED from the lead at conversion and
            the contract owns them now — a later edit to the lead won't change a
            signed contract. See AGENTS.md § Site address. */}
        <span className="text-[11px] text-[#a1a1aa]">held on this contract</span>
      </div>

      <AddressRow
        label="Site address"
        same={contract.siteSameAsCustomer}
        address={contract.site}
        note={contract.siteDirections}
        noun="contract"
      />
      <div className="mt-2 border-t border-[#f4f4f5] pt-2">
        <SameLine label="Invoice" same={contract.invoiceSameAsCustomer} noun="contract" />
        {!contract.invoiceSameAsCustomer && contract.invoiceName && (
          <div className="mt-1 text-[12.5px] text-[#3f3f46]">{contract.invoiceName}</div>
        )}
      </div>
    </Card>
  );
}

function ChecklistPanel({ contract }: { contract: ContractDetail }) {
  return (
    <Card className="min-h-0 flex-1 overflow-y-auto">
      <CardTitle className="mb-2 text-[14px]">Checklist</CardTitle>
      {contract.checklist.length === 0 ? (
        <p className="py-1 text-[12px] text-[#71717a]">No checklist items on this contract.</p>
      ) : (
        contract.checklist.map((item, i) => {
          const done = item.status === "completed" || item.status === "complete";
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-2.5 py-[7px] text-[12.5px]",
                i < contract.checklist.length - 1 && "border-b border-[#f4f4f5]",
              )}
            >
              <ContractChecklistToggle itemId={item.id} contractId={contract.id} done={done} />
              <span className={done ? "text-[#71717a] line-through" : "font-semibold text-[#3f3f46]"}>
                {item.action_name}
              </span>
              <span className="ml-auto text-[11px] text-[#a1a1aa]">
                {done
                  ? `${fmt(item.completed_at)}${item.completed_by_name ? ` · ${item.completed_by_name}` : ""}`
                  : item.due_date
                    ? `due ${fmtShort(item.due_date)}`
                    : ""}
              </span>
            </div>
          );
        })
      )}
    </Card>
  );
}

// --- small building blocks -------------------------------------------------
function FieldRow({
  label,
  children,
  border = true,
}: {
  label: string;
  children: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-2.5 py-1.5 text-[12px]",
        border && "border-b border-[#f4f4f5]",
      )}
    >
      <span className="text-[#71717a]">{label}</span>
      <span className="text-right font-medium text-[#3f3f46]">{children}</span>
    </div>
  );
}

function SameLine({ label, same, noun }: { label: string; same: boolean; noun: string }) {
  // No green "same as customer" pill — the Customer card sits right beside this,
  // so you compare the two addresses directly. Only the DIFFERENT case still
  // flags itself (amber), because that's the exception worth noticing.
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] font-semibold text-[#0a0a0a]">{label}</span>
      <span className={cn("text-[11.5px]", same ? "text-[#a1a1aa]" : "font-semibold text-[#b86e00]")}>
        {same ? "Same as customer" : `Different · this ${noun}`}
      </span>
    </div>
  );
}

function AddressRow({
  label,
  same,
  address,
  note,
  noun,
}: {
  label: string;
  same: boolean;
  address: AddressParts;
  note?: string | null;
  noun: string;
}) {
  const hasAddress = address.line1 || address.line2 || address.postcode;
  return (
    <div>
      <SameLine label={label} same={same} noun={noun} />
      {hasAddress && (
        <div className="mt-1 text-[12.5px] leading-[1.5] text-[#3f3f46]">
          {[address.line1, address.line2].filter(Boolean).join(", ")}
          {address.postcode && (
            <>
              {" · "}
              <span className="font-mono font-semibold text-[#0a0a0a]">{address.postcode}</span>
            </>
          )}
          {address.whatThreeWords && (
            <>
              {" · "}
              <span className="font-mono">{address.whatThreeWords}</span>
            </>
          )}
        </div>
      )}
      {note && <div className="mt-1 text-[12px] text-[#71717a]">{note}</div>}
    </div>
  );
}

function NoCustomer({ what }: { what: string }) {
  return (
    <Card>
      <CardTitle className="mb-1 text-[14px]">{what}</CardTitle>
      <p className="text-[12.5px] text-[#71717a]">
        {what} need the owning customer — this contract isn&rsquo;t linked to one yet.
      </p>
    </Card>
  );
}

/** "21–22 Jul" when the install spans days, one date when it doesn't. */
function installRange(contract: ContractDetail): string | null {
  const from = fmtShort(contract.installStartDate);
  const to = fmtShort(contract.installEndDate);
  if (!from) return to;
  if (!to || to === from) return from;
  return `${from} – ${to}`;
}

function fmt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtShort(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
