import Link from "next/link";
import { notFound } from "next/navigation";

import { getCustomerRecord, type CustomerRecord } from "@/lib/data/customer-record";
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
import { IllustrativeMap } from "@/components/crm/illustrative-map";
import { LeadCard, ContractCard } from "@/components/crm/lead-card";
import { Tabs } from "@/components/crm/tabs";

// Customer detail — the full contact record, organised into tabs. Read view for
// now; inline editing lands in the next pass.
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCustomerRecord(id);
  if (!c) notFound();

  const typeLabel = c.customer_type === "commercial" ? "Commercial" : "Residential";

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden px-[26px] py-[22px]">
      {/* Breadcrumb */}
      <div className="text-[12.5px] text-[#71717a]">
        <Link href="/customers" className="hover:text-[#3f3f46]">Customers</Link>
        <span className="mx-1 text-[#d4d4d8]">/</span>
        <span className="font-semibold text-[#0a0a0a]">{c.displayName}</span>
      </div>

      {/* Identity header */}
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
            {c.customer_number != null && <RefChip>C-{c.customer_number}</RefChip>}
            {c.bad_payer && <Pill tone="danger">Bad payer</Pill>}
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
          <Link href={`/customers/${c.id}/edit`} className={btnSecondary}>
            Edit
          </Link>
          <Link href={`/leads/new?customer=${c.id}`} className={btnPrimary}>
            <Icon name="plus" size={13} strokeWidth={2.2} /> New Lead
          </Link>
        </div>
      </div>

      {/* Flash note — prominent alert shown on every tab */}
      {c.flash_note && (
        <div className="rounded-lg border border-[#f6e0b8] bg-[#fdf2dc] px-3.5 py-2.5 text-[12.5px] font-medium text-[#b86e00]">
          <span className="font-bold">Flash note: </span>
          {c.flash_note}
        </div>
      )}

      <Tabs
        tabs={[
          { label: "Overview", content: <OverviewTab c={c} /> },
          { label: "Contacts", count: c.contacts.length, content: <ContactsTab c={c} /> },
          { label: "Address & directions", content: <AddressTab c={c} /> },
          { label: "Billing & account", content: <BillingTab c={c} /> },
          { label: "Marketing & consent", content: <MarketingTab c={c} /> },
          { label: "Custom info", count: c.customFields.length, content: <CustomTab c={c} /> },
          { label: "Documents", count: c.documents.length, content: <DocumentsTab c={c} /> },
          { label: "Notes", count: c.customerNotes.length, content: <NotesTab c={c} /> },
        ]}
      />
    </div>
  );
}

// --- Tabs -------------------------------------------------------------------
function OverviewTab({ c }: { c: CustomerRecord }) {
  const liveLeads = c.leads.filter((l) => isLiveLead(l.status)).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle className="mb-2">Identity</CardTitle>
          <Row label="Customer no." mono>{c.customer_number ?? "—"}</Row>
          <Row label="Type">{c.customer_type === "commercial" ? "Commercial" : "Residential"}</Row>
          <Row label="Name">{[c.title, c.first_name, c.last_name].filter(Boolean).join(" ")}</Row>
          {(c.first_name_2 || c.last_name_2) && (
            <Row label="Second person">{[c.title_2, c.first_name_2, c.last_name_2].filter(Boolean).join(" ")}</Row>
          )}
          {c.salutation && <Row label="Salutation">{c.salutation}</Row>}
          {c.customer_type === "commercial" && <Row label="Company" last>{c.company_name ?? "—"}</Row>}
        </Card>
        <Card>
          <CardTitle className="mb-2">Key contact</CardTitle>
          <Row label="Mobile">{c.mobile ?? "—"}</Row>
          <Row label="Phone">{c.phone ?? "—"}</Row>
          <Row label="Email">{c.email ?? "—"}</Row>
          <Row label="Home tel" last>{c.home_telephone ?? "—"}</Row>
        </Card>
        <Card>
          <CardTitle className="mb-2">Address</CardTitle>
          <div className="text-[13px] leading-[1.55]">
            {addressLines(c).map((l, i) => (<div key={i}>{l}</div>))}
            {c.postcode && <div className="font-mono font-semibold text-[#0a0a0a]">{c.postcode}</div>}
          </div>
          {c.what_3_words && (
            <span className="mt-2 inline-flex rounded-full bg-[#f4f4f5] px-[9px] py-[3px] font-mono text-[11px] font-semibold text-[#52525b]">
              {c.what_3_words}
            </span>
          )}
        </Card>
      </div>

      {/* Leads & contracts */}
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
  if (c.contacts.length === 0) return <Empty>No additional contacts on this account.</Empty>;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {c.contacts.map((ct) => (
        <Card key={ct.id}>
          <div className="flex items-center gap-2.5">
            <Avatar name={ct.name} size={34} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-[#0a0a0a]">{ct.name}</span>
                {ct.is_default && <Pill tone="success">Default</Pill>}
              </div>
              {ct.position_role && <div className="text-[11.5px] text-[#71717a]">{ct.position_role}</div>}
            </div>
          </div>
          <div className="mt-3">
            <Row label="Email">{ct.email ?? "—"}</Row>
            <Row label="Phone" last>{ct.phone ?? "—"}</Row>
          </div>
        </Card>
      ))}
    </div>
  );
}

function AddressTab({ c }: { c: CustomerRecord }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle className="mb-2">Address</CardTitle>
        <Row label="House name">{c.house_name ?? "—"}</Row>
        <Row label="No. & street">{[c.house_number, c.street].filter(Boolean).join(" ") || "—"}</Row>
        <Row label="Locality">{c.locality ?? "—"}</Row>
        <Row label="Town">{c.town ?? "—"}</Row>
        <Row label="County">{c.county ?? "—"}</Row>
        <Row label="Postcode" mono>{c.postcode ?? "—"}</Row>
        <Row label="what3words" mono>{c.what_3_words ?? "—"}</Row>
        <Row label="Business address" last><YesNo v={c.business_address} /></Row>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle className="mb-2">Phones</CardTitle>
          <Row label="Home tel">{c.home_telephone ?? "—"}</Row>
          <Row label="Work tel">{c.work_telephone ?? "—"}</Row>
          <Row label="Mobile 1">{c.mobile ?? "—"}</Row>
          <Row label="Mobile 2">{c.mobile_2 ?? "—"}</Row>
          <Row label="Fax / alt">{c.fax_alt_no ?? "—"}</Row>
          <Row label="No WhatsApp" last><YesNo v={c.no_whatsapp} /></Row>
        </Card>
        <Card>
          <CardTitle className="mb-2">Directions</CardTitle>
          <p className="text-[12.5px] leading-[1.6] text-[#3f3f46]">
            {c.directions ?? "No directions recorded."}
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
        <Row label="Invoice name">{c.invoice_name ?? "—"}</Row>
        <Row label="Address 1">{c.invoice_address_1 ?? "—"}</Row>
        <Row label="Address 2">{c.invoice_address_2 ?? "—"}</Row>
        <Row label="Address 3">{c.invoice_address_3 ?? "—"}</Row>
        <Row label="Address 4">{c.invoice_address_4 ?? "—"}</Row>
        <Row label="Postcode" mono>{c.invoice_postcode ?? "—"}</Row>
        <Row label="Invoice tel" last>{c.invoice_tel ?? "—"}</Row>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle className="mb-2">Account settings</CardTitle>
          <Row label="Payment terms">{c.payment_terms ?? "—"}</Row>
          <Row label="Settlement disc. terms">{c.settlement_disc_terms ?? "—"}</Row>
          <Row label="Settlement disc. %">{c.settlement_disc_pct != null ? `${c.settlement_disc_pct}%` : "—"}</Row>
          <Row label="VAT on reduced amount"><YesNo v={c.calculate_vat_on_reduced} /></Row>
          <Row label="Created in accounts pkg"><YesNo v={c.account_created_in_package} /></Row>
          <Row label="Default account ref" mono>{c.default_account_reference ?? "—"}</Row>
          <Row label="Sales manager">{c.sales_manager ?? "—"}</Row>
          <Row label="VAT no." mono>{c.vat_no ?? "—"}</Row>
          <Row label="CIS reg" mono last>{c.cis_reg ?? "—"}</Row>
        </Card>
        <Card>
          <CardTitle className="mb-2">Account references</CardTitle>
          {c.accountReferences.length === 0 ? (
            <p className="py-1 text-[12px] text-[#71717a]">No account references.</p>
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
          <Row label="Postal marketing"><Consent blocked={c.no_postal_marketing} /></Row>
          <Row label="Email marketing"><Consent blocked={c.no_email_marketing} /></Row>
          <Row label="SMS marketing"><Consent blocked={c.no_sms_marketing} /></Row>
          <Row label="Telephone marketing"><Consent blocked={c.no_telephone_marketing} /></Row>
          <Row label="Phone opt-in"><YesNo v={c.phone_opt_in} /></Row>
          <Row label="Letter opt-in"><YesNo v={c.letter_opt_in} /></Row>
          <Row label="Email opt-in"><YesNo v={c.email_opt_in} /></Row>
          <Row label="SMS opt-in"><YesNo v={c.sms_opt_in} /></Row>
        </div>
        <div className="mt-2 border-t border-[#f4f4f5] pt-2">
          <Row label="Do not contact"><YesNo v={c.do_not_contact} danger /></Row>
          <Row label="Bad payer" last><YesNo v={c.bad_payer} danger /></Row>
        </div>
      </Card>
      <Card>
        <CardTitle className="mb-2">Marketing</CardTitle>
        <Row label="Marketing code">{c.marketing_code ?? "—"}</Row>
        <Row label="Opt-in date">{c.opt_in_date ? longDate(c.opt_in_date) : "—"}</Row>
        <Row label="Opted in by">{c.opted_in_by ?? "—"}</Row>
        <Row label="Opt-in document" last>{c.opt_in_document ?? "—"}</Row>
        <div className="mt-3">
          <div className="mb-1 text-[12px] font-medium text-[#52525b]">Marketing notes</div>
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

// --- small helpers ----------------------------------------------------------
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

function YesNo({ v, danger }: { v: boolean | null; danger?: boolean }) {
  if (v) return <Pill tone={danger ? "danger" : "success"}>Yes</Pill>;
  return <span className="text-[#a1a1aa]">No</span>;
}

function Consent({ blocked }: { blocked: boolean | null }) {
  return blocked ? <Pill tone="danger">Opted out</Pill> : <Pill tone="success">Allowed</Pill>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-[12.5px] text-[#71717a]">{children}</p>
    </div>
  );
}

function addressLines(c: CustomerRecord): string[] {
  const line1 = [c.house_name, c.house_number, c.street].filter(Boolean).join(" ").trim();
  const line2 = [c.locality, c.town, c.county].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean);
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
