import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getCustomerRecord,
  getRelationshipTypes,
  type CustomerRecord,
  type RelationshipType,
} from "@/lib/data/customer-record";
import {
  updateCustomerField,
  updateContactField,
  updateRelationshipField,
} from "@/app/(app)/customers/actions";
import { gbp } from "@/lib/format";
import { isLiveLead } from "@/lib/leads";
import {
  Avatar,
  Card,
  CardTitle,
  Icon,
  Pill,
  RefChip,
  btnPrimary,
  btnSecondary,
} from "@/components/crm/primitives";
import { EditableField, type EditableType } from "@/components/crm/editable-field";
import { AddContactButton, ContactCardActions } from "@/components/crm/contact-actions";
import {
  RelationshipAdder,
  RelationshipRemove,
  RelationshipTypeEditor,
} from "@/components/crm/relationship-controls";
import { IllustrativeMap } from "@/components/crm/illustrative-map";
import { LeadCard, ContractCard } from "@/components/crm/lead-card";
import { Tabs } from "@/components/crm/tabs";

// Customer detail — the full contact record across tabs, every field editable
// inline (click a value to edit; Enter/blur saves).
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCustomerRecord(id);
  if (!c) notFound();

  const relationshipTypes = await getRelationshipTypes();
  const typeLabel = c.customer_type === "commercial" ? "Commercial" : "Residential";

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden px-[26px] py-[22px]">
      <div className="text-[12.5px] text-[#71717a]">
        <Link href="/customers" className="hover:text-[#3f3f46]">Customers</Link>
        <span className="mx-1 text-[#d4d4d8]">/</span>
        <span className="font-semibold text-[#0a0a0a]">{c.displayName}</span>
      </div>

      <div className="flex items-center gap-3.5">
        <Avatar name={c.displayName} size={46} />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
              {c.displayName}
            </h1>
            <span className="rounded-full bg-[#f4f4f5] px-[9px] py-[3px] text-[11px] font-semibold text-[#52525b]">
              {typeLabel}
            </span>
            {c.customer_number != null && <RefChip>{custNo(c.customer_number)}</RefChip>}
            {c.bad_payer && <Pill tone="danger">Payment risk</Pill>}
            {c.do_not_contact && <Pill tone="danger">Do not contact</Pill>}
            {c.customer_moved_away && <Pill tone="amber">Moved away</Pill>}
          </div>
          <div className="mt-0.5 text-[12.5px] text-[#71717a]">
            Customer since {longDate(c.created_at)}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <button className={btnSecondary} type="button">
            <Icon name="message" size={13} strokeWidth={1.75} /> Message
          </button>
          <Link href={`/leads/new?customer=${c.id}`} className={btnPrimary}>
            <Icon name="plus" size={13} strokeWidth={2.2} /> New Lead
          </Link>
        </div>
      </div>

      {c.flash_note && (
        <div className="rounded-lg border border-[#f6e0b8] bg-[#fdf2dc] px-3.5 py-2.5 text-[12.5px] font-medium text-[#b86e00]">
          <span className="font-bold">Alert note: </span>
          {c.flash_note}
        </div>
      )}

      <Tabs
        tabs={[
          { label: "Overview", content: <OverviewTab c={c} /> },
          { label: "Contacts", count: c.contacts.length, content: <ContactsTab c={c} /> },
          {
            label: "Relationships",
            count: c.relationships.length,
            content: <RelationshipsTab c={c} types={relationshipTypes} />,
          },
          { label: "Address & access", content: <AddressTab c={c} /> },
          { label: "Billing & account", content: <BillingTab c={c} /> },
          { label: "Marketing & permissions", content: <MarketingTab c={c} /> },
          { label: "Additional info", count: c.customFields.length, content: <CustomTab c={c} /> },
          { label: "Documents", count: c.documents.length, content: <DocumentsTab c={c} /> },
          { label: "Notes", count: c.customerNotes.length, content: <NotesTab c={c} /> },
        ]}
      />
    </div>
  );
}

const TYPE_OPTS = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
];

// --- Tabs -------------------------------------------------------------------
function OverviewTab({ c }: { c: CustomerRecord }) {
  const liveLeads = c.leads.filter((l) => isLiveLead(l.status)).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle className="mb-2">Identity</CardTitle>
          <Row label="Customer no." mono>{c.customer_number != null ? custNo(c.customer_number) : "—"}</Row>
          <E c={c} label="Type" field="customer_type" value={c.customer_type} type="select" options={TYPE_OPTS} />
          <E c={c} label="Title" field="title" value={c.title} />
          <E c={c} label="First name" field="first_name" value={c.first_name} />
          <E c={c} label="Last name" field="last_name" value={c.last_name} />
          <E c={c} label="2nd first name" field="first_name_2" value={c.first_name_2} />
          <E c={c} label="2nd last name" field="last_name_2" value={c.last_name_2} />
          <E c={c} label="Salutation" field="salutation" value={c.salutation} last={c.customer_type !== "commercial"} />
          {c.customer_type === "commercial" && (
            <E c={c} label="Company" field="company_name" value={c.company_name} last />
          )}
        </Card>
        <Card>
          <CardTitle className="mb-2">Key contact</CardTitle>
          <E c={c} label="Mobile" field="mobile" value={c.mobile} />
          <E c={c} label="Phone" field="phone" value={c.phone} />
          <E c={c} label="Email" field="email" value={c.email} />
          <E c={c} label="Home tel" field="home_telephone" value={c.home_telephone} last />
        </Card>
        <Card>
          <CardTitle className="mb-2">Flags</CardTitle>
          <E c={c} label="Do not contact" field="do_not_contact" value={c.do_not_contact} type="boolean" danger />
          <E c={c} label="Payment risk" field="bad_payer" value={c.bad_payer} type="boolean" danger />
          <E c={c} label="Moved away" field="customer_moved_away" value={c.customer_moved_away} type="boolean" danger />
          <E c={c} label="Alert note" field="flash_note" value={c.flash_note} type="textarea" last />
        </Card>
      </div>

      <div className="flex items-center gap-2.5">
        <h2 className="font-[family-name:var(--font-inter-tight)] text-[16px] font-bold text-[#0a0a0a]">
          Leads &amp; contracts
        </h2>
        <span className="text-xs text-[#71717a]">
          {c.leadCount} {c.leadCount === 1 ? "lead" : "leads"} · {liveLeads} live · {c.contractCount}{" "}
          {c.contractCount === 1 ? "contract" : "contracts"}
          {c.lifetimeValue > 0 && (
            <> · lifetime value <strong className="text-[#0a0a0a]">{gbp(c.lifetimeValue)}</strong></>
          )}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {c.leads.length === 0 && c.contracts.length === 0 ? (
          <Card className="text-center text-[12.5px] text-[#71717a]">
            No leads yet.{" "}
            <Link href={`/leads/new?customer=${c.id}`} className="font-semibold text-[var(--accent-blue)]">
              Create the first lead →
            </Link>
          </Card>
        ) : (
          c.leads.map((lead) => (
            <div key={lead.id} className="flex flex-col gap-3">
              <LeadCard lead={lead} />
              {c.contracts.filter((ct) => ct.lead_id === lead.id).map((ct) => (
                <ContractCard key={ct.id} contract={ct} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ContactsTab({ c }: { c: CustomerRecord }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] text-[#71717a]">
          {c.contacts.length} {c.contacts.length === 1 ? "contact" : "contacts"} linked to this account
        </span>
        <div className="ml-auto">
          <AddContactButton customerId={c.id} />
        </div>
      </div>
      {c.contacts.length === 0 ? (
        <Empty>No linked contacts yet — add one above.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {c.contacts.map((ct) => (
            <Card key={ct.id}>
              <div className="flex items-center gap-2.5">
                <Avatar name={ct.name || "?"} size={34} />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <EditableField
                    id={ct.id}
                    field="name"
                    value={ct.name}
                    action={updateContactField}
                    placeholder="Name"
                    className="!text-left font-semibold text-[#0a0a0a]"
                  />
                  {ct.is_default && <Pill tone="success">Default</Pill>}
                </div>
              </div>
              <div className="mt-3">
                <CRow id={ct.id} label="Role" field="position_role" value={ct.position_role} />
                <CRow id={ct.id} label="Email" field="email" value={ct.email} />
                <CRow id={ct.id} label="Phone" field="phone" value={ct.phone} last />
              </div>
              <ContactCardActions customerId={c.id} contactId={ct.id} isDefault={!!ct.is_default} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CRow({
  id,
  label,
  field,
  value,
  last,
}: {
  id: string;
  label: string;
  field: string;
  value: string | null;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 text-[12.5px] ${last ? "" : "border-b border-[#f4f4f5]"}`}>
      <span className="shrink-0 text-[#71717a]">{label}</span>
      <EditableField id={id} field={field} value={value} action={updateContactField} />
    </div>
  );
}

function RelationshipsTab({
  c,
  types,
}: {
  c: CustomerRecord;
  types: RelationshipType[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        <div className="ml-auto">
          <RelationshipAdder customerId={c.id} types={types} />
        </div>
      </div>
      {c.relationships.length === 0 ? (
        <Empty>
          No linked customers yet. Link family, neighbours or referrers so their
          history is one click away.
        </Empty>
      ) : (
        <div className="flex flex-wrap gap-3">
          {c.relationships.map((r) => (
            <Card key={r.id} className="flex w-fit min-w-[260px] max-w-sm flex-col gap-3">
              <div className="flex items-start gap-3">
                <Avatar name={r.related?.name ?? "?"} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {r.related ? (
                      <Link
                        href={`/customers/${r.related.id}`}
                        className="truncate font-[family-name:var(--font-inter-tight)] text-[15px] font-bold text-[#0a0a0a] hover:text-[var(--accent-blue)]"
                      >
                        {r.related.name}
                      </Link>
                    ) : (
                      <span className="text-[#71717a]">Unknown customer</span>
                    )}
                    {r.related?.customerNumber != null && (
                      <span className="font-mono text-[11px] text-[#a1a1aa]">
                        {String(r.related.customerNumber).padStart(4, "0")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5">
                    <RelationshipTypeEditor
                      variant="pill"
                      relationshipId={r.id}
                      viewerIsA={r.viewerIsA}
                      value={r.label}
                      types={types}
                      nameSuffix={c.first_name}
                      possessive={r.symmetric}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-[#fafafa] px-3 py-2">
                <EditableField
                  id={r.id}
                  field="notes"
                  value={r.notes}
                  action={updateRelationshipField}
                  type="textarea"
                  placeholder="Add a note…"
                  className="!block w-full !text-left text-[12px] text-[#3f3f46]"
                />
              </div>

              <div className="flex items-center border-t border-[#f4f4f5] pt-2.5">
                {r.related && (
                  <Link
                    href={`/customers/${r.related.id}`}
                    className="text-[11.5px] font-semibold text-[var(--accent-blue)]"
                  >
                    Open record →
                  </Link>
                )}
                <RelationshipRemove customerId={c.id} relationshipId={r.id} className="ml-auto" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddressTab({ c }: { c: CustomerRecord }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle className="mb-2">Address</CardTitle>
        <E c={c} label="House name" field="house_name" value={c.house_name} />
        <E c={c} label="House number" field="house_number" value={c.house_number} />
        <E c={c} label="Street" field="street" value={c.street} />
        <E c={c} label="Locality" field="locality" value={c.locality} />
        <E c={c} label="Town" field="town" value={c.town} />
        <E c={c} label="County" field="county" value={c.county} />
        <E c={c} label="Postcode" field="postcode" value={c.postcode} mono />
        <E c={c} label="what3words" field="what_3_words" value={c.what_3_words} mono />
        <E c={c} label="Business address" field="business_address" value={c.business_address} type="boolean" last />
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle className="mb-2">Phones</CardTitle>
          <E c={c} label="Home tel" field="home_telephone" value={c.home_telephone} />
          <E c={c} label="Work tel" field="work_telephone" value={c.work_telephone} />
          <E c={c} label="Mobile 1" field="mobile" value={c.mobile} />
          <E c={c} label="Mobile 2" field="mobile_2" value={c.mobile_2} />
          <E c={c} label="Fax / alt" field="fax_alt_no" value={c.fax_alt_no} />
          <E c={c} label="WhatsApp opt-out" field="no_whatsapp" value={c.no_whatsapp} type="boolean" last />
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <CardTitle>Access notes</CardTitle>
            <EditableField id={c.id} field="directions" value={c.directions} action={updateCustomerField} type="textarea" placeholder="Add access notes…" className="text-[12px] font-semibold text-[var(--accent-blue)]" />
          </div>
          <p className="text-[12.5px] leading-[1.6] text-[#3f3f46]">
            {c.directions ?? "No access notes recorded."}
          </p>
          {(c.postcode || c.what_3_words) && <IllustrativeMap className="mt-3" />}
        </Card>
      </div>
    </div>
  );
}

function BillingTab({ c }: { c: CustomerRecord }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle className="mb-2">Invoice address</CardTitle>
        <E c={c} label="Invoice name" field="invoice_name" value={c.invoice_name} />
        <E c={c} label="Address 1" field="invoice_address_1" value={c.invoice_address_1} />
        <E c={c} label="Address 2" field="invoice_address_2" value={c.invoice_address_2} />
        <E c={c} label="Address 3" field="invoice_address_3" value={c.invoice_address_3} />
        <E c={c} label="Address 4" field="invoice_address_4" value={c.invoice_address_4} />
        <E c={c} label="Postcode" field="invoice_postcode" value={c.invoice_postcode} mono />
        <E c={c} label="Invoice tel" field="invoice_tel" value={c.invoice_tel} last />
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle className="mb-2">Account settings</CardTitle>
          <E c={c} label="Payment terms" field="payment_terms" value={c.payment_terms} />
          <E c={c} label="Early-payment terms" field="settlement_disc_terms" value={c.settlement_disc_terms} />
          <E c={c} label="Early-payment %" field="settlement_disc_pct" value={c.settlement_disc_pct} type="number" />
          <E c={c} label="VAT after discount" field="calculate_vat_on_reduced" value={c.calculate_vat_on_reduced} type="boolean" />
          <E c={c} label="In accounts system" field="account_created_in_package" value={c.account_created_in_package} type="boolean" />
          <E c={c} label="Accounts reference" field="default_account_reference" value={c.default_account_reference} mono />
          <E c={c} label="Sales manager" field="sales_manager" value={c.sales_manager} />
          <E c={c} label="VAT no." field="vat_no" value={c.vat_no} mono />
          <E c={c} label="CIS reg" field="cis_reg" value={c.cis_reg} mono last />
        </Card>
        <Card>
          <CardTitle className="mb-2">Ledger accounts</CardTitle>
          {c.accountReferences.length === 0 ? (
            <p className="py-1 text-[12px] text-[#71717a]">No ledger accounts.</p>
          ) : (
            c.accountReferences.map((r, i) => (
              <Row key={r.id} label={r.reference ?? "—"} mono last={i === c.accountReferences.length - 1}>
                {r.acc_name ?? "—"}
              </Row>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}

function MarketingTab({ c }: { c: CustomerRecord }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle className="mb-2">Consent</CardTitle>
        <div className="grid grid-cols-2 gap-x-4">
          <E c={c} label="No postal mktg" field="no_postal_marketing" value={c.no_postal_marketing} type="boolean" danger />
          <E c={c} label="No email mktg" field="no_email_marketing" value={c.no_email_marketing} type="boolean" danger />
          <E c={c} label="No SMS mktg" field="no_sms_marketing" value={c.no_sms_marketing} type="boolean" danger />
          <E c={c} label="No phone mktg" field="no_telephone_marketing" value={c.no_telephone_marketing} type="boolean" danger />
          <E c={c} label="Phone opt-in" field="phone_opt_in" value={c.phone_opt_in} type="boolean" />
          <E c={c} label="Letter opt-in" field="letter_opt_in" value={c.letter_opt_in} type="boolean" />
          <E c={c} label="Email opt-in" field="email_opt_in" value={c.email_opt_in} type="boolean" />
          <E c={c} label="SMS opt-in" field="sms_opt_in" value={c.sms_opt_in} type="boolean" last />
        </div>
      </Card>
      <Card>
        <CardTitle className="mb-2">Marketing</CardTitle>
        <E c={c} label="Marketing source" field="marketing_code" value={c.marketing_code} />
        <E c={c} label="Consent date" field="opt_in_date" value={c.opt_in_date} type="date" />
        <E c={c} label="Consent by" field="opted_in_by" value={c.opted_in_by} />
        <E c={c} label="Consent document" field="opt_in_document" value={c.opt_in_document} last />
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#52525b]">Marketing notes</span>
            <EditableField id={c.id} field="marketing_notes" value={c.marketing_notes} action={updateCustomerField} type="textarea" placeholder="Edit…" className="text-[12px] font-semibold text-[var(--accent-blue)]" />
          </div>
          <p className="text-[12.5px] leading-[1.6] text-[#3f3f46]">{c.marketing_notes ?? "—"}</p>
        </div>
      </Card>
    </div>
  );
}

function CustomTab({ c }: { c: CustomerRecord }) {
  if (c.customFields.length === 0)
    return <Empty>No custom fields defined. Add them in settings to capture bespoke info here.</Empty>;
  return (
    <Card className="max-w-3xl">
      {c.customFields.map((f, i) => (
        <Row key={f.definitionId} label={f.question} last={i === c.customFields.length - 1}>
          {f.value ?? "—"}
        </Row>
      ))}
    </Card>
  );
}

function DocumentsTab({ c }: { c: CustomerRecord }) {
  if (c.documents.length === 0) return <Empty>No documents attached to this customer.</Empty>;
  return (
    <Card className="max-w-3xl">
      {c.documents.map((d, i) => (
        <div
          key={d.id}
          className={`flex items-center gap-2.5 py-2.5 text-[12.5px] ${
            i < c.documents.length - 1 ? "border-b border-[#f4f4f5]" : ""
          }`}
        >
          <Icon name="file" size={15} strokeWidth={1.75} className="text-[var(--accent-blue)]" />
          <span className="font-semibold text-[#0a0a0a]">{d.name}</span>
          {d.category && <Pill tone="neutral">{d.category}</Pill>}
          <span className="ml-auto text-[11px] text-[#a1a1aa]">{fileSize(d.file_size)}</span>
        </div>
      ))}
    </Card>
  );
}

function NotesTab({ c }: { c: CustomerRecord }) {
  if (c.customerNotes.length === 0) return <Empty>No customer notes yet.</Empty>;
  return (
    <Card className="max-w-3xl">
      {c.customerNotes.map((n, i) => (
        <div key={n.id} className={`py-2.5 ${i < c.customerNotes.length - 1 ? "border-b border-[#f4f4f5]" : ""}`}>
          <p className="text-[12.5px] text-[#3f3f46]">{n.content}</p>
          <p className="mt-1 text-[11px] text-[#a1a1aa]">{longDate(n.created_at)}</p>
        </div>
      ))}
    </Card>
  );
}

// --- editable row + read row ------------------------------------------------
function E({
  c,
  label,
  field,
  value,
  type = "text",
  options,
  mono,
  danger,
  last,
}: {
  c: CustomerRecord;
  label: string;
  field: string;
  value: string | number | boolean | null;
  type?: EditableType;
  options?: { value: string; label: string }[];
  mono?: boolean;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 text-[12.5px] ${last ? "" : "border-b border-[#f4f4f5]"}`}>
      <span className="shrink-0 text-[#71717a]">{label}</span>
      <EditableField
        id={c.id}
        field={field}
        value={value}
        action={updateCustomerField}
        type={type}
        options={options}
        mono={mono}
        booleanDanger={danger}
      />
    </div>
  );
}

function Row({
  label,
  children,
  mono,
  last,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-3 py-2 text-[12.5px] ${last ? "" : "border-b border-[#f4f4f5]"}`}>
      <span className="shrink-0 text-[#71717a]">{label}</span>
      <span className={`text-right font-medium text-[#3f3f46] ${mono ? "font-mono" : ""}`}>{children}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-[12.5px] text-[#71717a]">{children}</p>
    </div>
  );
}

function custNo(n: number): string {
  return String(n).padStart(4, "0");
}

function longDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} KB`;
  return `${bytes} B`;
}
