import Link from "next/link";
import { notFound } from "next/navigation";

import { getLead, type AddressParts, type LeadDetail } from "@/lib/data/leads";
import { getTenantOptionLists, type TenantOption } from "@/lib/data/customer-record";
import { getSalesStaff, type StaffOption } from "@/lib/data/staff";
import { gbp, humanLabel } from "@/lib/format";
import { Card, CardTitle, Icon, Pill, RefChip, btnPrimary, btnSecondary } from "@/components/crm/primitives";
import { EditableField, type EditableType } from "@/components/crm/editable-field";
import { updateLeadField } from "@/app/(app)/leads/actions";
import { addSalesStaff, deleteSalesStaff } from "@/app/(app)/customers/actions";
import { AddressMap } from "@/components/crm/address-map";
import { RememberedLink } from "@/components/crm/view-state";
import { Tabs } from "@/components/crm/tabs";
import { NotesPanel } from "@/components/crm/notes-panel";
import { DocumentsPanel } from "@/components/crm/documents-panel";
import { getUserOrder } from "@/lib/data/user-layouts";
import { ChecklistToggle, StageChanger } from "@/components/crm/lead-interactions";
import { cn } from "@/lib/utils";

// Lead detail — transcribed from `Vision CRM Screens.dc.html` screen 04.
export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const [opts, salesStaff, tabOrder] = await Promise.all([
    getTenantOptionLists([
      "lead_source",
      "lead_sub_source",
      "product_type",
      "quote_type",
      "payment_method",
      "result_reason",
      "salesperson_type",
      "document_category",
    ]),
    getSalesStaff(),
    getUserOrder("lead_tabs"),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto px-[26px] py-[22px]">
      {/* Back to the leads list, restoring its remembered filters/sort. The
          lead's name/ref lives in the identity row below — no breadcrumb. */}
      <RememberedLink
        href="/leads"
        className="inline-flex w-fit items-center gap-1 text-[12.5px] text-[#71717a] hover:text-[#3f3f46]"
      >
        <Icon name="chevron-left" size={14} strokeWidth={1.75} />
        Leads
      </RememberedLink>

      {/* Identity row */}
      <div className="flex items-center gap-3">
        <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
          {lead.title}
        </h1>
        <RefChip>{lead.ref}</RefChip>
        <StageChanger leadId={lead.id} status={lead.status} />
        {lead.priority && (
          <Pill tone="amber" className="bg-[var(--accent-tint)] text-[var(--accent-blue)]">
            Priority · {humanLabel(lead.priority)}
          </Pill>
        )}
        <span className="ml-1 text-[14px] font-bold text-[#0a0a0a]">{gbp(lead.value)}</span>
        <div className="ml-auto flex items-center gap-2.5">
          {lead.customer && (
            <Link className={btnSecondary} href={`/customers/${lead.customer.id}`}>
              <Icon name="user" size={13} strokeWidth={1.75} /> View customer
            </Link>
          )}
          <button className={btnSecondary} type="button">
            <Icon name="calendar" size={13} strokeWidth={1.75} /> Book survey
          </button>
          <button
            className={`${btnPrimary} shadow-[0_4px_12px_rgba(47,125,225,0.25)]`}
            type="button"
          >
            Convert to Contract <Icon name="arrow-right" size={13} />
          </button>
        </div>
      </div>

      {/* Real tabs, drag-reorderable and saved per user — the same shell the
          customer record uses. Quotes isn't here: it arrives with Phase 5, and a
          dead tab is worse than a missing one. */}
      <Tabs
        layoutKey="lead_tabs"
        savedOrder={tabOrder}
        tabs={[
          {
            label: "Overview",
            content: <OverviewTab lead={lead} opts={opts} salesStaff={salesStaff} />,
          },
          { label: "Activity", count: lead.activities.length, content: <ActivityPanel lead={lead} /> },
          {
            label: "Notes",
            count: lead.noteThread.length,
            content: lead.customer ? (
              // The shared notes panel: stamped, versioned, with attachments.
              // `fixedLeadId` files every new note against THIS lead while
              // keeping customer_id set, so it reads from both records.
              <NotesPanel
                customerId={lead.customer.id}
                fixedLeadId={lead.id}
                notes={lead.noteThread}
                documents={lead.documents}
                linkTargets={[]}
              />
            ) : (
              <NoCustomer what="Notes" />
            ),
          },
          {
            label: "Documents",
            count: lead.documents.filter((d) => d.leadId === lead.id).length,
            content: lead.customer ? (
              <DocumentsPanel
                ownerType="lead"
                ownerId={lead.id}
                customerId={lead.customer.id}
                documents={lead.documents}
                categoryOptions={opts.document_category ?? []}
              />
            ) : (
              <NoCustomer what="Documents" />
            ),
          },
          { label: "Checklist", count: lead.checklist.length, content: <ChecklistPanel lead={lead} /> },
        ]}
      />
    </div>
  );
}

/**
 * Overview — a BENTO of independent column stacks (the house style, see
 * AGENTS.md § Bento layout), not a row-aligned grid: the Lead card is a dozen
 * rows and the Location card is a fixed-height map, so a row grid would stretch
 * one to the other's height.
 */
function OverviewTab({
  lead,
  opts,
  salesStaff,
}: {
  lead: LeadDetail;
  opts: Record<string, TenantOption[]>;
  salesStaff: StaffOption[];
}) {
  return (
    <div className="grid max-w-[1320px] items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="flex flex-col gap-4">
        <LeadPanel lead={lead} opts={opts} salesStaff={salesStaff} />
      </div>
      <div className="flex flex-col gap-4">
        {/* The customer themselves — name, home address, phone — so their
            address can be read against the site address just below it. */}
        <CustomerPanel lead={lead} />
        <AddressesPanel lead={lead} />
      </div>
      <div className="flex flex-col gap-4">
        {/* "Where is this?" is its own question — the map is its own card rather
            than decoration wedged under the address rows. */}
        {lead.site.postcode && (
          <Card>
            <CardTitle className="mb-2 text-[14px]">Location</CardTitle>
            <AddressMap
              height={220}
              {...lead.site.fields}
              what3words={lead.site.whatThreeWords}
            />
          </Card>
        )}
        <ChecklistPanel lead={lead} />
      </div>
    </div>
  );
}

/** A tab that needs the owning customer (for file storage) but hasn't got one. */
function NoCustomer({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-sm font-semibold text-[#3f3f46]">{what} need a customer</p>
      <p className="text-[12.5px] text-[#71717a]">
        Link this lead to a customer first — that&rsquo;s where its files and notes are filed.
      </p>
    </div>
  );
}

function LeadPanel({
  lead,
  opts,
  salesStaff,
}: {
  lead: LeadDetail;
  opts: Record<string, TenantOption[]>;
  salesStaff: StaffOption[];
}) {
  return (
    <Card>
      <CardTitle className="mb-1.5 text-[14px]">Lead</CardTitle>
      <FieldRow label="Lead No.">
        <span className="font-mono font-semibold">{lead.leadNumber ?? "—"}</span>
      </FieldRow>
      <EL leadId={lead.id} label="Date Received" field="lead_date" value={lead.leadDate} type="date" />
      {/* Salesperson comes from staff_members (not auth users), so it carries its
          own add/retire handlers rather than a tenant_options list_key. */}
      <EL
        leadId={lead.id}
        label="Salesperson"
        field="salesman"
        value={lead.salesman}
        type="lookup"
        lookupOptions={salesStaff}
        onAddNew={addSalesStaff}
        onDeleteOption={deleteSalesStaff}
      />
      <EL leadId={lead.id} label="Salesperson Type" field="salesperson_type" value={lead.salespersonType} type="lookup" listKey="salesperson_type" opts={opts} />
      <EL leadId={lead.id} label="Source" field="source" value={lead.source} type="lookup" listKey="lead_source" opts={opts} />
      <EL leadId={lead.id} label="Sub-Source" field="sub_source" value={lead.subSource} type="lookup" listKey="lead_sub_source" opts={opts} />
      <EL leadId={lead.id} label="Main Interest" field="product_type" value={lead.productType} type="lookup" listKey="product_type" opts={opts} />
      <EL leadId={lead.id} label="Second Interest" field="product_interest_2" value={lead.productInterest2} type="lookup" listKey="product_type" opts={opts} />
      <EL leadId={lead.id} label="Windows" field="window_count" value={lead.windowCount} type="number" />
      <EL leadId={lead.id} label="Follow-Up Date" field="follow_up_date" value={lead.followUpDate} type="date" />
      <EL leadId={lead.id} label="Quote Type" field="quote_type" value={lead.quoteType} type="lookup" listKey="quote_type" opts={opts} />
      <EL leadId={lead.id} label="Quote Date" field="quote_date" value={lead.quoteDate} type="date" />
      <EL leadId={lead.id} label="Payment Method" field="payment_method" value={lead.paymentMethod} type="lookup" listKey="payment_method" opts={opts} />
      <EL leadId={lead.id} label="Result Reason" field="result_reason" value={lead.resultReason} type="lookup" listKey="result_reason" opts={opts} />
      <FieldRow label="Result" last border={false}>
        <Pill tone={lead.result === "lost" ? "danger" : "success"}>{humanLabel(lead.result ?? "alive")}</Pill>
      </FieldRow>
    </Card>
  );
}

function EL({
  leadId,
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
  leadId: string;
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
        id={leadId}
        field={field}
        value={value}
        action={updateLeadField}
        type={type}
        listKey={listKey}
        lookupOptions={lookupOptions ?? (listKey ? (opts?.[listKey] ?? []) : undefined)}
        onAddNew={onAddNew}
        onDeleteOption={onDeleteOption}
      />
    </div>
  );
}

function CustomerPanel({ lead }: { lead: LeadDetail }) {
  const c = lead.customer;
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

function AddressesPanel({ lead }: { lead: LeadDetail }) {
  return (
    <Card className="min-h-0 flex-1 overflow-y-auto">
      <div className="mb-1.5 flex items-center justify-between">
        <CardTitle className="text-[14px]">Addresses</CardTitle>
        <span className="text-[11px] text-[#a1a1aa]">held on this lead</span>
      </div>

      {/* ONE site address — installation and fitting are the same place, so
          they're no longer two rows. Directions (fitting_directions) ride on it. */}
      <AddressRow
        label="Site address"
        same={lead.siteSameAsCustomer}
        address={lead.site}
        note={lead.siteDirections}
      />
      <div className="mt-2 border-t border-[#f4f4f5] pt-2">
        <SameLine label="Invoice" same={lead.invoiceSameAsCustomer} />
      </div>
      {/* The real map, on the SITE address — that's the address a surveyor or
          fitter is actually travelling to. */}
      {lead.site.postcode && (
        <AddressMap
          className="mt-3"
          height={190}
          {...lead.site.fields}
          what3words={lead.site.whatThreeWords}
        />
      )}
    </Card>
  );
}

function ActivityPanel({ lead }: { lead: LeadDetail }) {
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden !px-0 !py-0">
      <div className="flex items-center border-b border-[#f4f4f5] px-[18px] py-3.5">
        <CardTitle className="text-[15px]">Activity</CardTitle>
        <span className="ml-auto text-[11.5px] text-[#71717a]">
          {lead.activities.length} {lead.activities.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[18px] py-4">
        {lead.activities.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
            <p className="text-[13px] font-semibold text-[#3f3f46]">No activity yet</p>
            <p className="text-[12px] text-[#71717a]">
              Emails, calls and status changes will appear here as the comms module lands.
            </p>
          </div>
        ) : (
          lead.activities.map((a) => (
            <div key={a.id} className="flex gap-3">
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#f4f4f5] text-[#3f3f46]">
                <Icon name={iconForActivity(a.type)} size={14} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-[#3f3f46]">
                  <span className="font-semibold text-[#0a0a0a]">{humanLabel(a.type)}</span>
                  <span className="text-[#a1a1aa]"> · {fmtDateTime(a.created_at)}</span>
                </div>
                <p className="mt-1 text-[12.5px] text-[#3f3f46]">{a.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function ChecklistPanel({ lead }: { lead: LeadDetail }) {
  return (
    <Card className="min-h-0 flex-1 overflow-y-auto">
      <CardTitle className="mb-2 text-[14px]">Checklist</CardTitle>
      {lead.checklist.length === 0 ? (
        <p className="py-1 text-[12px] text-[#71717a]">No checklist items on this lead.</p>
      ) : (
        lead.checklist.map((item, i) => {
          const done = item.status === "completed";
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2.5 py-[7px] text-[12.5px] ${
                i < lead.checklist.length - 1 ? "border-b border-[#f4f4f5]" : ""
              }`}
            >
              <ChecklistToggle itemId={item.id} leadId={lead.id} done={done} />
              <span
                className={
                  done ? "text-[#71717a] line-through" : "font-semibold text-[#3f3f46]"
                }
              >
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
  last?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-2.5 py-1.5 text-[12px] ${border ? "border-b border-[#f4f4f5]" : ""}`}
    >
      <span className="text-[#71717a]">{label}</span>
      <span className="text-right font-medium text-[#3f3f46]">{children}</span>
    </div>
  );
}

function SameLine({ label, same }: { label: string; same: boolean }) {
  // No green "same as customer" pill — the Customer card sits right beside this,
  // so you compare the two addresses directly. Only the DIFFERENT case still
  // flags itself (amber), because that's the exception worth noticing.
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] font-semibold text-[#0a0a0a]">{label}</span>
      <span
        className={cn(
          "text-[11.5px]",
          same ? "text-[#a1a1aa]" : "font-semibold text-[#b86e00]",
        )}
      >
        {same ? "Same as customer" : "Different · this lead"}
      </span>
    </div>
  );
}

function AddressRow({
  label,
  same,
  address,
  note,
}: {
  label: string;
  same: boolean;
  address: AddressParts;
  note?: string | null;
}) {
  const hasAddress = address.line1 || address.line2 || address.postcode;
  return (
    <div>
      <SameLine label={label} same={same} />
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

function iconForActivity(type: string): "envelope" | "phone" | "message" | "eye" | "calendar" {
  const t = type.toLowerCase();
  if (t.includes("email")) return "envelope";
  if (t.includes("call") || t.includes("phone")) return "phone";
  if (t.includes("sms") || t.includes("message")) return "message";
  if (t.includes("view") || t.includes("quote")) return "eye";
  return "calendar";
}

function fmt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtShort(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
