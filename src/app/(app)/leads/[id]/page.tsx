import Link from "next/link";
import { notFound } from "next/navigation";

import { getLead, type AddressParts, type LeadDetail } from "@/lib/data/leads";
import { gbp } from "@/lib/format";
import { Card, CardTitle, Icon, Pill, btnPrimary, btnSecondary } from "@/components/crm/primitives";
import { IllustrativeMap } from "@/components/crm/illustrative-map";
import {
  ChecklistToggle,
  NoteComposer,
  StageChanger,
} from "@/components/crm/lead-interactions";

// Lead detail — transcribed from `Vision CRM Screens.dc.html` screen 04.
export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  return (
    <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto px-[26px] py-[22px]">
      {/* Breadcrumb */}
      <div className="text-[12.5px] text-[#71717a]">
        <Link href="/leads" className="hover:text-[#3f3f46]">
          Leads
        </Link>
        <span className="mx-1 text-[#d4d4d8]">/</span>
        {lead.customer ? (
          <Link href={`/customers/${lead.customer.id}`} className="hover:text-[#3f3f46]">
            {lead.customer.name}
          </Link>
        ) : (
          <span>Unknown</span>
        )}
        <span className="mx-1 text-[#d4d4d8]">/</span>
        <span className="font-semibold text-[#0a0a0a]">Lead {lead.ref}</span>
      </div>

      {/* Identity row */}
      <div className="flex items-center gap-3">
        <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
          {lead.title}
        </h1>
        <StageChanger leadId={lead.id} status={lead.status} />
        {lead.priority && (
          <Pill tone="amber" className="bg-[var(--accent-tint)] text-[var(--accent-blue)]">
            Priority · {capitalise(lead.priority)}
          </Pill>
        )}
        <span className="ml-1 text-[14px] font-bold text-[#0a0a0a]">{gbp(lead.value)}</span>
        <div className="ml-auto flex items-center gap-2.5">
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

      {/* Tab bar (Overview is live; other tabs arrive with their modules) */}
      <div className="flex items-end gap-0.5 border-b border-[#e7e7ea]">
        <Tab label="Overview" active />
        <Tab label="Communications" count={lead.activities.length} />
        <Tab label="Quotes" />
        <Tab label="Notes" count={lead.leadNotes.length} />
        <Tab label="Documents" />
        <Tab label="Checklist" count={lead.checklist.length} />
      </div>

      {/* Three-column grid */}
      <div className="grid min-h-0 flex-1 grid-cols-[310px_1fr_310px] gap-4">
        {/* Left */}
        <div className="flex min-h-0 flex-col gap-3">
          <LeadPanel lead={lead} />
          <AddressesPanel lead={lead} />
        </div>

        {/* Centre */}
        <ActivityPanel lead={lead} />

        {/* Right */}
        <div className="flex min-h-0 flex-col gap-3">
          <NotesPanel lead={lead} />
          <ChecklistPanel lead={lead} />
        </div>
      </div>
    </div>
  );
}

function LeadPanel({ lead }: { lead: LeadDetail }) {
  const rows: [string, React.ReactNode][] = [
    ["Lead no.", <span key="n" className="font-mono font-semibold">{lead.leadNumber ?? "—"}</span>],
    ["Date received", fmt(lead.leadDate)],
    ["Salesperson", lead.salesman ?? "—"],
    ["Source", [lead.source, lead.subSource].filter(Boolean).join(" · ") || "—"],
    ["Main interest", lead.productType ?? lead.productInterest1 ?? "—"],
    ["Second interest", lead.productInterest2 ?? "—"],
    ["Windows", lead.windowCount != null ? String(lead.windowCount) : "—"],
    ["Quote date · value", lead.quoteDate ? `${fmt(lead.quoteDate)} · ${gbp(lead.value)}` : "—"],
  ];

  return (
    <Card>
      <CardTitle className="mb-1.5 text-[14px]">Lead</CardTitle>
      {rows.map(([label, value], i) => (
        <FieldRow key={label} label={label} last={false} border={i < rows.length}>
          {value}
        </FieldRow>
      ))}
      {lead.followUpDate && (
        <FieldRow label="Follow-up date" border>
          <span className="font-semibold text-[#b86e00]">{fmt(lead.followUpDate)}</span>
        </FieldRow>
      )}
      <FieldRow label="Result" last border={false}>
        <Pill tone={lead.result === "lost" ? "danger" : lead.result === "won" ? "success" : "success"}>
          {lead.result ?? "alive"}
        </Pill>
      </FieldRow>
    </Card>
  );
}

function AddressesPanel({ lead }: { lead: LeadDetail }) {
  return (
    <Card className="min-h-0 flex-1 overflow-y-auto">
      <div className="mb-1.5 flex items-center justify-between">
        <CardTitle className="text-[14px]">Addresses</CardTitle>
        <span className="text-[11px] text-[#a1a1aa]">held on this lead</span>
      </div>

      <AddressRow label="Installation" same={lead.sameAsCustomer} address={lead.install} />
      <div className="mt-2 border-t border-[#f4f4f5] pt-2">
        <SameLine label="Invoice" same={lead.invoiceSameAsCustomer} />
      </div>
      <div className="mt-2 border-t border-[#f4f4f5] pt-2">
        <AddressRow
          label="Fitting"
          same={lead.fittingSameAsCustomer}
          address={lead.fitting}
          note={lead.fittingDirections}
        />
      </div>
      {(lead.install.postcode || lead.customer?.address.postcode) && (
        <IllustrativeMap className="mt-3" />
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
                  <span className="font-semibold text-[#0a0a0a]">{capitalise(a.type)}</span>
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

function NotesPanel({ lead }: { lead: LeadDetail }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <CardTitle className="text-[14px]">Notes</CardTitle>
        <span className="ml-auto text-[11px] text-[#a1a1aa]">{lead.leadNotes.length}</span>
      </div>
      <NoteComposer leadId={lead.id} />
      <div className="mt-3 flex flex-col">
        {lead.leadNotes.length === 0 ? (
          <p className="py-2 text-[12px] text-[#71717a]">No notes yet.</p>
        ) : (
          lead.leadNotes.map((n, i) => (
            <div
              key={n.id}
              className={`py-2.5 ${i < lead.leadNotes.length - 1 ? "border-b border-[#f4f4f5]" : ""}`}
            >
              <p className="text-[12.5px] text-[#3f3f46]">{n.content}</p>
              <p className="mt-1 text-[11px] text-[#a1a1aa]">{fmt(n.created_at)}</p>
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
function Tab({ label, count, active }: { label: string; count?: number; active?: boolean }) {
  return (
    <span
      className={`relative px-3.5 pb-[11px] pt-[9px] text-[13px] ${
        active ? "font-bold text-[#0a0a0a]" : "font-medium text-[#71717a]"
      }`}
    >
      {label}
      {count != null && count > 0 && <span className="ml-1 text-[11px] text-[#a1a1aa]">{count}</span>}
      {active && (
        <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-sm bg-[var(--accent-blue)]" />
      )}
    </span>
  );
}

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
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] font-semibold text-[#0a0a0a]">{label}</span>
      {same ? (
        <Pill tone="success">same as customer ✓</Pill>
      ) : (
        <Pill tone="amber">different · this lead</Pill>
      )}
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

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
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
