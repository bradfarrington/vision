import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getCustomerRecord,
  getRelationshipTypes,
  getTenantOptionLists,
  type CustomerRecord,
  type RelationshipType,
  type CustomerFinancials,
  type ContractLine,
} from "@/lib/data/customer-record";
import { getSalesStaff, type StaffOption } from "@/lib/data/staff";
import {
  updateCustomerField,
  updateContactField,
  updateRelationshipField,
  addSalesStaff,
} from "@/app/(app)/customers/actions";
import { gbp, isCommercial } from "@/lib/format";
import {
  isLiveLead,
  leadRef,
  contractRef,
  customerRef,
  documentRef,
  noteRef,
} from "@/lib/leads";
import {
  Avatar,
  Card,
  CardTitle,
  Icon,
  Pill,
  RefChip,
  StageBadge,
  btnPrimary,
  btnSecondary,
} from "@/components/crm/primitives";
import { EditableField, type EditableType } from "@/components/crm/editable-field";
import { AddContactButton, ContactCardActions } from "@/components/crm/contact-actions";
import { MarketingNotes } from "@/components/crm/marketing-notes";
import { NotesPanel, type NoteLinkTarget } from "@/components/crm/notes-panel";
import { DocumentsPanel } from "@/components/crm/documents-panel";
import {
  AddCustomFieldButton,
  CustomFieldRemove,
  CustomFieldValue,
} from "@/components/crm/custom-field-editor";
import {
  RelationshipAdder,
  RelationshipRemove,
  RelationshipTypeEditor,
} from "@/components/crm/relationship-controls";
import { IllustrativeMap } from "@/components/crm/illustrative-map";
import { Tabs, TabJump, TabLink } from "@/components/crm/tabs";

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

  // Tenant-defined dropdown fields bring their own list_key, so the lookup set
  // is part-fixed, part-whatever this tenant has created.
  const lookupKeys = [
    ...new Set([
      "customer_type", "title", "payment_terms", "settlement_terms", "marketing_source",
      "contact_role", "locality", "consent_by", "preferred_contact_time", "heard_about_us",
      "document_category",
      ...c.customFields.map((f) => f.listKey).filter((k): k is string => !!k),
    ]),
  ];
  const [relationshipTypes, lookups, salesUsers] = await Promise.all([
    getRelationshipTypes(),
    getTenantOptionLists(lookupKeys),
    getSalesStaff(),
  ]);
  const typeLabel = c.customer_type
    ? c.customer_type.charAt(0).toUpperCase() + c.customer_type.slice(1)
    : "Residential";

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
            {c.customer_number != null && <RefChip>{customerRef(c.customer_number)}</RefChip>}
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
          { label: "Overview", content: <OverviewTab c={c} lookups={lookups} /> },
          { label: "Contacts", count: c.contacts.length, content: <ContactsTab c={c} roleOptions={lookups.contact_role} /> },
          {
            label: "Relationships",
            count: c.relationships.length,
            content: <RelationshipsTab c={c} types={relationshipTypes} />,
          },
          { label: "Address & access", content: <AddressTab c={c} lookups={lookups} /> },
          { label: "Billing & account", content: <BillingTab c={c} lookups={lookups} salesUsers={salesUsers} /> },
          { label: "Marketing & permissions", content: <MarketingTab c={c} lookups={lookups} /> },
          { label: "Additional info", count: c.customFields.length, content: <CustomTab c={c} lookups={lookups} /> },
          { label: "Documents", count: c.documents.length, content: <DocumentsTab c={c} categoryOptions={lookups.document_category} /> },
          { label: "Notes", count: c.customerNotes.length, content: <NotesTab c={c} /> },
        ]}
      />
    </div>
  );
}

type Lookups = Record<string, { id: string; label: string }[]>;

// --- Tabs -------------------------------------------------------------------
function OverviewTab({ c, lookups }: { c: CustomerRecord; lookups: Lookups }) {
  const liveLeads = c.leads.filter((l) => isLiveLead(l.status)).length;
  return (
    // Capped so cards stay a readable measure on a wide monitor — four columns
    // stretched across 1900px leaves each one mostly empty space.
    //
    // The overview is meant to fit its panel without scrolling, so it runs
    // denser than the editing tabs: `[&_[data-row]]:py-[5px]` tightens every
    // Row/E/CRow in one place instead of threading a `dense` prop through
    // thirty call sites, and the cards use OV_CARD's tighter padding.
    <div className="flex max-w-[1320px] flex-col gap-3 [&_[data-row]]:py-[5px]">
      <SnapshotStrip c={c} liveLeads={liveLeads} />

      {/* Bento: four independent column stacks. Cards are different heights by
          nature (Identity is ten rows, Contact is two) — a row-aligned grid
          stretches every card in a row to the tallest, which is where the dead
          space came from. Each column packs its own cards instead. */}
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Card className={OV_CARD}>
            <CardTitle className="mb-1.5">Identity</CardTitle>
            <Row label="Customer no." mono>{c.customer_number != null ? custNo(c.customer_number) : "—"}</Row>
            <E c={c} label="Type" field="customer_type" value={c.customer_type} type="lookup" listKey="customer_type" lookupOptions={lookups.customer_type} />
            <E c={c} label="Title" field="title" value={c.title} type="lookup" listKey="title" lookupOptions={lookups.title} />
            <E c={c} label="First name" field="first_name" value={c.first_name} />
            <E c={c} label="Last name" field="last_name" value={c.last_name} />
            <E c={c} label="Second first name" field="first_name_2" value={c.first_name_2} />
            <E c={c} label="Second last name" field="last_name_2" value={c.last_name_2} />
            <E c={c} label="Salutation" field="salutation" value={c.salutation} last={!isCommercial(c.customer_type)} />
            {isCommercial(c.customer_type) && (
              <E c={c} label="Company" field="company_name" value={c.company_name} last />
            )}
          </Card>
          <ContactSummary c={c} />
          <Card className={OV_CARD}>
            <CardTitle className="mb-1.5">Flags</CardTitle>
            <E c={c} label="Do not contact" field="do_not_contact" value={c.do_not_contact} type="boolean" danger />
            <E c={c} label="Payment risk" field="bad_payer" value={c.bad_payer} type="boolean" danger />
            <E c={c} label="Moved away" field="customer_moved_away" value={c.customer_moved_away} type="boolean" danger />
            <E c={c} label="Alert note" field="flash_note" value={c.flash_note} type="textarea" last />
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <Card className={OV_CARD}>
            <CardTitle className="mb-1.5">Main contact</CardTitle>
            {c.mainContact ? (
              <>
                <Row label="Name">{c.mainContact.name}</Row>
                {c.mainContact.position_role && (
                  <Row label="Role">{c.mainContact.position_role}</Row>
                )}
                <CRow id={c.mainContact.id} label="Email" field="email" value={c.mainContact.email} />
                <CRow id={c.mainContact.id} label="Phone" field="phone" value={c.mainContact.phone} last />
              </>
            ) : (
              <p className="py-2 text-[12px] text-[#71717a]">
                Add a first &amp; last name — the main contact appears here.
              </p>
            )}
          </Card>
          <AddressSummary c={c} />
          <LinkedCustomers c={c} />
        </div>

        <div className="flex flex-col gap-3">
          <ConsentSummary c={c} />
          <RecentDocuments c={c} />
          <RecentNotes c={c} />
        </div>

        <div className="flex flex-col gap-3">
          <ContractsCard c={c} />
          <LeadsCard c={c} liveLeads={liveLeads} />
        </div>
      </div>
    </div>
  );
}

// --- Overview summary cards -------------------------------------------------
// Read-only digests of data that lives on another tab. Each one deep-links to
// the tab that owns it (TabLink/TabJump) rather than duplicating its editing —
// the owning tab stays the single place a field is changed.

/** Overview card padding — tighter than the default Card so the tab fits its panel. */
const OV_CARD = "!px-[15px] !py-[13px]";

/**
 * How many rows a digest shows before "View all →" takes over. Kept small on
 * purpose: the overview has to fit without scrolling, and the owning tab is one
 * click away for the full list.
 */
const DIGEST_ROWS = 3;

function SnapshotStrip({ c, liveLeads }: { c: CustomerRecord; liveLeads: number }) {
  const { lifetimeValue, outstandingTotal } = c.financials;
  return (
    // Tiles size to their content rather than stretching across the viewport —
    // a money figure in a full-width card reads as mostly empty space.
    <div className="flex flex-wrap gap-3">
      <Stat label="Lifetime value" value={gbp(lifetimeValue)} tone="success" to="Billing & account" />
      <Stat label="Outstanding" value={gbp(outstandingTotal)} tone="danger" to="Billing & account" />
      <Stat
        label="Live leads"
        value={String(liveLeads)}
        sub={c.leadCount > 0 ? `of ${c.leadCount}` : undefined}
        tone="accent"
      />
      <Stat label="Contracts" value={String(c.contractCount)} tone="neutral" />
    </div>
  );
}

// Tinted chip + value colour per tone, shared by the stat tiles and the summary
// cards. Money reads at a glance: earned = green, owed = red. Semantic colours
// are platform-fixed; only `accent` rebrands with the tenant.
const STAT_TONE = {
  success: { chip: "bg-[#e7f4ec] text-[#1a7f3e]", value: "text-[#1a7f3e]", rule: "bg-[#1a7f3e]" },
  danger: { chip: "bg-[#fdecec] text-[#d64545]", value: "text-[#d64545]", rule: "bg-[#d64545]" },
  amber: { chip: "bg-[#fdf2dc] text-[#b86e00]", value: "text-[#b86e00]", rule: "bg-[#b86e00]" },
  accent: {
    chip: "bg-[var(--accent-tint)] text-[var(--accent-blue)]",
    value: "text-[var(--accent-blue)]",
    rule: "bg-[var(--accent-blue)]",
  },
  neutral: { chip: "bg-[#f4f4f5] text-[#52525b]", value: "text-[#0a0a0a]", rule: "bg-[#d4d4d8]" },
} satisfies Record<string, { chip: string; value: string; rule: string }>;

function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  to,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: keyof typeof STAT_TONE;
  to?: string;
}) {
  const t = STAT_TONE[tone];
  const body = (
    // A coloured rule down the leading edge carries the tone without an icon.
    <Card className="relative h-full min-w-[164px] overflow-hidden !px-4 !py-3">
      <span className={`absolute inset-y-0 left-0 w-[3px] ${t.rule}`} />
      <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`font-[family-name:var(--font-inter-tight)] text-[19px] font-extrabold tracking-[-0.01em] ${t.value}`}
        >
          {value}
        </span>
        {sub && <span className="text-[11.5px] text-[#71717a]">{sub}</span>}
      </div>
    </Card>
  );
  return to ? (
    <TabJump to={to} className="text-left transition-opacity hover:opacity-80">
      {body}
    </TabJump>
  ) : (
    body
  );
}

/**
 * Shared shell for the overview digests — a plain title (no icon, to match the
 * Identity/Flags cards) plus the jump to the tab that owns the data.
 */
function SummaryCard({
  title,
  to,
  linkLabel = "View all →",
  children,
}: {
  title: string;
  to: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={OV_CARD}>
      <div className="mb-1.5 flex items-center gap-2.5">
        <CardTitle>{title}</CardTitle>
        <TabLink to={to} className="ml-auto">
          {linkLabel}
        </TabLink>
      </div>
      {children}
    </Card>
  );
}

/**
 * The OTHER ways to reach them. The primary contact mirrors the customer's own
 * name/email/phone by design, so anything already on the Main contact card is
 * filtered out — otherwise the same number is printed twice, side by side. If
 * that leaves nothing to say, the card doesn't render at all.
 */
function ContactSummary({ c }: { c: CustomerRecord }) {
  const shown = new Set(
    [c.mainContact?.email, c.mainContact?.phone].filter(Boolean).map((v) => String(v).trim()),
  );
  const rows = [
    { label: "Email", value: c.email, href: (v: string) => `mailto:${v}` },
    { label: "Mobile", value: c.mobile, href: (v: string) => `tel:${v}` },
    { label: "Mobile 2", value: c.mobile_2, href: (v: string) => `tel:${v}` },
    { label: "Home", value: c.home_telephone, href: (v: string) => `tel:${v}` },
    { label: "Work", value: c.work_telephone, href: (v: string) => `tel:${v}` },
  ].filter((r) => r.value && !shown.has(r.value.trim()));

  if (rows.length === 0 && !c.no_whatsapp) return null;
  return (
    <SummaryCard title="Other contact" to="Address & access" linkLabel="Edit →">
      {rows.map((r, i) => (
        <Row key={r.label} label={r.label} last={i === rows.length - 1}>
          <a href={r.href(r.value!)} className="hover:text-[var(--accent-blue)]">
            {r.value}
          </a>
        </Row>
      ))}
      {c.no_whatsapp && (
        <div className={`flex flex-wrap gap-1.5 ${rows.length > 0 ? "mt-2.5 border-t border-[#f4f4f5] pt-2.5" : ""}`}>
          <Pill tone="neutral">No WhatsApp</Pill>
        </div>
      )}
    </SummaryCard>
  );
}

function AddressSummary({ c }: { c: CustomerRecord }) {
  // House name and number are separate fields; either, both or neither may be set.
  const line1 = [c.house_name, [c.house_number, c.street].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const lines = [line1, c.locality, c.town, c.county].filter(Boolean) as string[];
  return (
    <SummaryCard title="Address" to="Address & access" linkLabel="Edit →">
      {lines.length === 0 && !c.postcode ? (
        <p className="py-1 text-[12px] text-[#71717a]">No address recorded.</p>
      ) : (
        <address className="text-[12.5px] not-italic leading-[1.6] text-[#3f3f46]">
          {lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
          {c.postcode && <div className="font-mono font-semibold text-[#0a0a0a]">{c.postcode}</div>}
        </address>
      )}
      {c.what_3_words && (
        <div className="mt-2 font-mono text-[11.5px] text-[#71717a]">
          {"/// "}
          {c.what_3_words}
        </div>
      )}
      {c.directions && (
        <div className="mt-2.5 border-t border-[#f4f4f5] pt-2.5">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
            Access
          </div>
          <p className="line-clamp-3 text-[12.5px] leading-[1.6] text-[#3f3f46]">{c.directions}</p>
        </div>
      )}
    </SummaryCard>
  );
}

function ConsentSummary({ c }: { c: CustomerRecord }) {
  const channels: { label: string; value: boolean | null }[] = [
    { label: "Email", value: c.email_opt_in },
    { label: "SMS", value: c.sms_opt_in },
    { label: "Phone", value: c.phone_opt_in },
    { label: "Post", value: c.letter_opt_in },
  ];
  return (
    <SummaryCard title="Marketing consent" to="Marketing & permissions" linkLabel="Edit →">
      <div className="flex flex-wrap gap-1.5">
        {channels.map((ch) => (
          <ConsentChip key={ch.label} label={ch.label} value={ch.value} />
        ))}
      </div>
      <div className="mt-3">
        <Row label="Referral source" last={!c.opt_in_date}>
          {c.marketing_code ?? "—"}
        </Row>
        {c.opt_in_date && (
          <Row label="Consent given" last>
            {longDate(c.opt_in_date)}
          </Row>
        )}
      </div>
    </SummaryCard>
  );
}

// Blank = never asked, which is materially different from a recorded "No".
function ConsentChip({ label, value }: { label: string; value: boolean | null }) {
  const tone = value == null ? "neutral" : value ? "success" : "danger";
  const mark = value == null ? "not asked" : value ? "yes" : "no";
  return (
    <Pill tone={tone}>
      {label} · {mark}
    </Pill>
  );
}

function RecentNotes({ c }: { c: CustomerRecord }) {
  const recent = c.customerNotes.slice(0, DIGEST_ROWS);
  return (
    <SummaryCard title="Recent notes" to="Notes">
      {recent.length === 0 ? (
        <p className="py-1 text-[12px] text-[#71717a]">No notes yet.</p>
      ) : (
        recent.map((n, i) => (
          <TabJump
            key={n.id}
            to="Notes"
            className={`-mx-2 block w-[calc(100%+1rem)] rounded px-2 py-2 text-left hover:bg-[#fafafa] ${
              i === recent.length - 1 ? "" : "border-b border-[#f4f4f5]"
            }`}
          >
            <div className="flex items-center gap-2">
              {n.number != null && <RefChip>{noteRef(n.number)}</RefChip>}
              <span className="truncate text-[11.5px] text-[#a1a1aa]">
                {n.author ?? "Unknown"} · {longDate(n.createdAt)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.55] text-[#3f3f46]">
              {n.content}
            </p>
          </TabJump>
        ))
      )}
    </SummaryCard>
  );
}

// --- Column 4: the work itself ----------------------------------------------
// Compact stacks rather than the full-width LeadCard/ContractCard — a column is
// ~310px, so each row carries reference, what it is, when, and how much, and
// opens the lead for everything else.

function ContractsCard({ c }: { c: CustomerRecord }) {
  const contracts = c.contracts;
  return (
    <Card className={OV_CARD}>
      <div className="mb-1.5 flex items-center gap-2.5">
        <CardTitle>Contracts</CardTitle>
        {contracts.length > 0 && (
          <span className="ml-auto text-[11.5px] text-[#71717a]">{contracts.length}</span>
        )}
      </div>
      {contracts.length === 0 ? (
        <p className="py-1 text-[12px] text-[#71717a]">
          No contracts yet — they appear here once a lead is won.
        </p>
      ) : (
        contracts.map((k, i) => {
          const row = (
            <div
              className={`flex flex-col gap-1 py-2 ${
                i === contracts.length - 1 ? "" : "border-b border-[#f4f4f5]"
              }`}
            >
              <div className="flex items-center gap-2">
                <RefChip inverted>{contractRef(k.contract_number)}</RefChip>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#3f3f46]">
                  {k.contract_type ?? "Contract"}
                </span>
                <span className="shrink-0 text-[12.5px] font-bold text-[#0a0a0a]">
                  {gbp(k.gross_value ?? 0)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11.5px] text-[#a1a1aa]">
                {k.contract_date && <span>{longDate(k.contract_date)}</span>}
                {k.status && <Pill tone="neutral">{k.status}</Pill>}
              </div>
            </div>
          );
          return k.lead_id ? (
            <Link
              key={k.id}
              href={`/leads/${k.lead_id}`}
              className="-mx-2 block rounded px-2 hover:bg-[#fafafa]"
            >
              {row}
            </Link>
          ) : (
            <div key={k.id}>{row}</div>
          );
        })
      )}
    </Card>
  );
}

function LeadsCard({ c, liveLeads }: { c: CustomerRecord; liveLeads: number }) {
  return (
    <Card className={OV_CARD}>
      <div className="mb-1.5 flex items-center gap-2.5">
        <CardTitle>Leads</CardTitle>
        {c.leads.length > 0 && (
          <span className="ml-auto text-[11.5px] text-[#71717a]">
            {c.leads.length} · {liveLeads} live
          </span>
        )}
      </div>
      {c.leads.length === 0 ? (
        <p className="py-1 text-[12px] text-[#71717a]">
          No leads yet.{" "}
          <Link
            href={`/leads/new?customer=${c.id}`}
            className="font-semibold text-[var(--accent-blue)]"
          >
            Create the first →
          </Link>
        </p>
      ) : (
        c.leads.map((l, i) => (
          <Link
            key={l.id}
            href={`/leads/${l.id}`}
            className={`-mx-2 block rounded px-2 hover:bg-[#fafafa] ${
              i === c.leads.length - 1 ? "" : "border-b border-[#f4f4f5]"
            }`}
          >
            <div className="flex flex-col gap-1 py-2">
              <div className="flex items-center gap-2">
                <RefChip>{leadRef(l.lead_number)}</RefChip>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#3f3f46]">
                  {l.product_type ?? l.product_interest_1 ?? "Lead"}
                </span>
                {(l.gross_value ?? l.estimated_value) != null && (
                  <span className="shrink-0 text-[12.5px] font-bold text-[#0a0a0a]">
                    {gbp(l.gross_value ?? l.estimated_value ?? 0)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StageBadge status={l.status} />
                {l.lead_date && (
                  <span className="text-[11.5px] text-[#a1a1aa]">{longDate(l.lead_date)}</span>
                )}
              </div>
            </div>
          </Link>
        ))
      )}
    </Card>
  );
}

function RecentDocuments({ c }: { c: CustomerRecord }) {
  const recent = c.documents.slice(0, DIGEST_ROWS);
  return (
    <SummaryCard title="Recent documents" to="Documents">
      {recent.length === 0 ? (
        <p className="py-1 text-[12px] text-[#71717a]">No documents yet.</p>
      ) : (
        recent.map((d, i) => (
          <TabJump
            key={d.id}
            to="Documents"
            className={`-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded px-2 py-2 text-left hover:bg-[#fafafa] ${
              i === recent.length - 1 ? "" : "border-b border-[#f4f4f5]"
            }`}
          >
            {d.number != null && <RefChip>{documentRef(d.number)}</RefChip>}
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#3f3f46]">
              {d.name}
            </span>
            {d.category && (
              <span className="shrink-0 text-[11px] text-[#a1a1aa]">{d.category}</span>
            )}
          </TabJump>
        ))
      )}
    </SummaryCard>
  );
}

function LinkedCustomers({ c }: { c: CustomerRecord }) {
  const linked = c.relationships.slice(0, DIGEST_ROWS);
  return (
    <SummaryCard title="Linked customers" to="Relationships">
      {linked.length === 0 ? (
        <p className="py-1 text-[12px] text-[#71717a]">
          No linked customers — family, neighbours and referrers go here.
        </p>
      ) : (
        linked.map((r, i) => {
          const row = (
            <div
              className={`flex items-center gap-2.5 py-2 ${
                i === linked.length - 1 ? "" : "border-b border-[#f4f4f5]"
              }`}
            >
              <Avatar name={r.related?.name ?? "?"} size={28} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#0a0a0a]">
                {r.related?.name ?? "Unknown customer"}
              </span>
              {r.label && <Pill tone="neutral">{r.label}</Pill>}
            </div>
          );
          return r.related ? (
            <Link
              key={r.id}
              href={`/customers/${r.related.id}`}
              className="-mx-2 block rounded px-2 hover:bg-[#fafafa]"
            >
              {row}
            </Link>
          ) : (
            <div key={r.id}>{row}</div>
          );
        })
      )}
    </SummaryCard>
  );
}

function ContactsTab({
  c,
  roleOptions,
}: {
  c: CustomerRecord;
  roleOptions: { id: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
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
                <CRow id={ct.id} label="Role" field="position_role" value={ct.position_role} lookupOptions={roleOptions} listKey="contact_role" />
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
  lookupOptions,
  listKey,
}: {
  id: string;
  label: string;
  field: string;
  value: string | null;
  last?: boolean;
  lookupOptions?: { id: string; label: string }[];
  listKey?: string;
}) {
  return (
    <div data-row className={`flex items-center justify-between gap-3 py-2 text-[12.5px] ${last ? "" : "border-b border-[#f4f4f5]"}`}>
      <span className="shrink-0 text-[#71717a]">{label}</span>
      <EditableField
        id={id}
        field={field}
        value={value}
        action={updateContactField}
        type={listKey ? "lookup" : "text"}
        lookupOptions={lookupOptions}
        listKey={listKey}
      />
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

function AddressTab({ c, lookups }: { c: CustomerRecord; lookups: Lookups }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle className="mb-2">Address</CardTitle>
        <E c={c} label="House name" field="house_name" value={c.house_name} />
        <E c={c} label="House number" field="house_number" value={c.house_number} />
        <E c={c} label="Street" field="street" value={c.street} />
        <E c={c} label="Locality" field="locality" value={c.locality} type="lookup" listKey="locality" lookupOptions={lookups.locality} />
        <E c={c} label="Town" field="town" value={c.town} />
        <E c={c} label="County" field="county" value={c.county} />
        <E c={c} label="Postcode" field="postcode" value={c.postcode} mono />
        <E c={c} label="What3words" field="what_3_words" value={c.what_3_words} mono />
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

function BillingTab({
  c,
  lookups,
  salesUsers,
}: {
  c: CustomerRecord;
  lookups: Lookups;
  salesUsers: StaffOption[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-2">
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
          <E c={c} label="Payment terms" field="payment_terms" value={c.payment_terms} type="lookup" listKey="payment_terms" lookupOptions={lookups.payment_terms} />
          <E c={c} label="Early-payment terms" field="settlement_disc_terms" value={c.settlement_disc_terms} type="lookup" listKey="settlement_terms" lookupOptions={lookups.settlement_terms} />
          <E c={c} label="Early-payment %" field="settlement_disc_pct" value={c.settlement_disc_pct} type="number" />
          <E c={c} label="VAT after discount" field="calculate_vat_on_reduced" value={c.calculate_vat_on_reduced} type="boolean" />
          <E c={c} label="In accounts system" field="account_created_in_package" value={c.account_created_in_package} type="boolean" />
          <E c={c} label="Accounts reference" field="default_account_reference" value={c.default_account_reference} mono />
          <E c={c} label="Sales manager" field="sales_manager" value={c.sales_manager} type="lookup" lookupOptions={salesUsers} onAddNew={addSalesStaff} />
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
      <FinancialsPanel financials={c.financials} />
    </div>
  );
}

function FinancialsPanel({ financials }: { financials: CustomerFinancials }) {
  const { lifetimeValue, outstandingTotal, outstanding, completed } = financials;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
        <CardTitle>Financials</CardTitle>
        <span className="text-[12.5px] text-[#71717a]">
          Lifetime value{" "}
          <strong className="ml-1 text-[14px] text-[#0a0a0a]">{gbp(lifetimeValue)}</strong>
        </span>
        <span className="text-[12.5px] text-[#71717a]">
          Outstanding{" "}
          <strong
            className={`ml-1 text-[14px] ${outstandingTotal > 0 ? "text-[#b86e00]" : "text-[#0a0a0a]"}`}
          >
            {gbp(outstandingTotal)}
          </strong>
        </span>
      </div>

      {outstanding.length === 0 && completed.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-[#71717a]">
          No contracts yet — they appear here once a lead is converted.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
              Outstanding · {outstanding.length}
            </div>
            {outstanding.length === 0 ? (
              <p className="py-1.5 text-[12px] text-[#71717a]">Nothing outstanding.</p>
            ) : (
              outstanding.map((l) => <ContractRow key={l.id} l={l} showBalance />)
            )}
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
              Completed &amp; paid · {completed.length}
            </div>
            {completed.length === 0 ? (
              <p className="py-1.5 text-[12px] text-[#71717a]">None yet.</p>
            ) : (
              completed.map((l) => <ContractRow key={l.id} l={l} />)
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function ContractRow({ l, showBalance }: { l: ContractLine; showBalance?: boolean }) {
  const body = (
    <div className="flex items-center gap-2.5 border-b border-[#f4f4f5] py-2 text-[12.5px] last:border-b-0">
      <RefChip inverted>{l.ref}</RefChip>
      <span className="min-w-0 flex-1 truncate text-[#3f3f46]">
        {l.type ?? "Contract"}
        {l.date && <span className="text-[#a1a1aa]"> · {longDate(l.date)}</span>}
      </span>
      {showBalance ? (
        <span className="shrink-0 font-semibold text-[#b86e00]">{gbp(l.balance)}</span>
      ) : (
        <span className="shrink-0 font-semibold text-[#0a0a0a]">{gbp(l.value)}</span>
      )}
      {l.leadId && <span className="shrink-0 text-[var(--accent-blue)]">→</span>}
    </div>
  );
  return l.leadId ? (
    <Link href={`/leads/${l.leadId}`} className="-mx-2 block rounded px-2 hover:bg-[#fafafa]">
      {body}
    </Link>
  ) : (
    body
  );
}

function MarketingTab({ c, lookups }: { c: CustomerRecord; lookups: Lookups }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle className="mb-1">Marketing consent</CardTitle>
        <p className="mb-1 text-[11.5px] text-[#a1a1aa]">Blank = not asked · click to set Yes / No</p>
        <E c={c} label="Email" field="email_opt_in" value={c.email_opt_in} type="tristate" />
        <E c={c} label="SMS" field="sms_opt_in" value={c.sms_opt_in} type="tristate" />
        <E c={c} label="Phone" field="phone_opt_in" value={c.phone_opt_in} type="tristate" />
        <E c={c} label="Post" field="letter_opt_in" value={c.letter_opt_in} type="tristate" last />
      </Card>
      <Card>
        <CardTitle className="mb-2">Marketing</CardTitle>
        <E c={c} label="Referral source" field="marketing_code" value={c.marketing_code} type="lookup" listKey="marketing_source" lookupOptions={lookups.marketing_source} />
        <E c={c} label="Consent date" field="opt_in_date" value={c.opt_in_date} type="date" />
        <E c={c} label="Consent by" field="opted_in_by" value={c.opted_in_by} type="lookup" listKey="consent_by" lookupOptions={lookups.consent_by} />
        <E c={c} label="Consent document" field="opt_in_document" value={c.opt_in_document} last />
        <MarketingNotes customerId={c.id} notes={c.marketingNotes} />
      </Card>
    </div>
  );
}

function CustomTab({ c, lookups }: { c: CustomerRecord; lookups: Lookups }) {
  if (c.customFields.length === 0)
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-[12.5px] text-[#71717a]">
          No additional-info fields yet — add your own to capture bespoke info here.
        </p>
        <AddCustomFieldButton />
      </div>
    );
  return (
    <Card className="max-w-3xl">
      <div className="mb-1 flex items-center justify-between gap-3">
        <CardTitle>Additional info</CardTitle>
        <AddCustomFieldButton compact />
      </div>
      {c.customFields.map((f, i) => (
        <div
          key={f.definitionId}
          className={`group/row flex items-center justify-between gap-3 py-2 text-[12.5px] ${i === c.customFields.length - 1 ? "" : "border-b border-[#f4f4f5]"}`}
        >
          <span className="shrink-0 text-[#71717a]">{f.question}</span>
          <div className="flex min-w-0 items-center gap-1.5">
            <CustomFieldValue
              customerId={c.id}
              definitionId={f.definitionId}
              listKey={f.listKey}
              value={f.value}
              options={f.listKey ? (lookups[f.listKey] ?? []) : []}
            />
            <CustomFieldRemove definitionId={f.definitionId} question={f.question} />
          </div>
        </div>
      ))}
    </Card>
  );
}

function DocumentsTab({
  c,
  categoryOptions,
}: {
  c: CustomerRecord;
  categoryOptions: { id: string; label: string }[];
}) {
  return (
    <DocumentsPanel
      ownerType="customer"
      ownerId={c.id}
      documents={c.documents}
      categoryOptions={categoryOptions}
    />
  );
}

function NotesTab({ c }: { c: CustomerRecord }) {
  // A note can be pinned to any of this customer's leads or contracts.
  const linkTargets: NoteLinkTarget[] = [
    ...c.leads.map((l) => ({
      id: l.id,
      kind: "lead" as const,
      label: `Lead ${leadRef(l.lead_number)}${l.product_type ? ` — ${l.product_type}` : ""}`,
    })),
    ...c.contracts.map((k) => ({
      id: k.id,
      kind: "contract" as const,
      label: `Contract ${contractRef(k.contract_number)}${k.contract_type ? ` — ${k.contract_type}` : ""}`,
    })),
  ];
  return (
    <NotesPanel
      customerId={c.id}
      notes={c.customerNotes}
      documents={c.documents}
      linkTargets={linkTargets}
    />
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
  lookupOptions,
  listKey,
  onAddNew,
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
  lookupOptions?: { id: string; label: string }[];
  listKey?: string;
  onAddNew?: (label: string) => Promise<{ label?: string; error?: string }>;
  mono?: boolean;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <div data-row className={`flex items-center justify-between gap-3 py-2 text-[12.5px] ${last ? "" : "border-b border-[#f4f4f5]"}`}>
      <span className="shrink-0 text-[#71717a]">{label}</span>
      <EditableField
        id={c.id}
        field={field}
        value={value}
        action={updateCustomerField}
        type={type}
        options={options}
        lookupOptions={lookupOptions}
        listKey={listKey}
        onAddNew={onAddNew}
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
    <div data-row className={`flex justify-between gap-3 py-2 text-[12.5px] ${last ? "" : "border-b border-[#f4f4f5]"}`}>
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
