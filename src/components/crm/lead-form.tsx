"use client";

import { useActionState, useState } from "react";

import { createLead, type LeadFormState } from "@/app/(app)/leads/actions";
import { addSalesStaff, deleteSalesStaff } from "@/app/(app)/customers/actions";
import type { CustomerOption } from "@/lib/data/customers";
import { LEAD_STAGES } from "@/lib/leads";
import { Combo } from "./combo";
import { btnPrimary } from "./primitives";
import {
  Area,
  DateField,
  Field,
  Lookup,
  ReviewGroup,
  StepShell,
  SumRow,
  Txt,
  WizardFrame,
  swallowEnter,
  type LookupList,
  type WizardStep,
} from "./wizard";
import { cn } from "@/lib/utils";

// New Lead — a staged wizard on the shared wizard shell, matching New Customer.
// It replaced a flat page of plain <input>/<select> whose Source list was
// hardcoded in this file; every pick-list here is now a real tenant-editable
// lookup, so the wizard writes clean values from the start.

export type LeadLookups = Record<string, LookupList>;

type Values = Record<string, string>;

// Every field the wizard collects. Each rides as a hidden input so the native
// form action submits the whole lead at once (see ./wizard).
const ALL_KEYS = [
  "customer_id",
  "source", "sub_source", "lead_date",
  "product_type", "product_interest_2", "window_count",
  "status", "priority", "salesman", "salesperson_type",
  "gross_value", "estimated_value", "follow_up_date",
  "quote_type", "quote_date", "payment_method",
  "notes",
];

const STEPS: WizardStep[] = [
  { key: "customer", label: "Customer" },
  { key: "enquiry", label: "Enquiry" },
  { key: "value", label: "Value" },
  { key: "quote", label: "Quote", optional: true },
  { key: "notes", label: "Notes", optional: true },
  { key: "review", label: "Review" },
];

function seed(defaultCustomerId?: string): Values {
  const v: Values = {};
  for (const k of ALL_KEYS) v[k] = "";
  if (defaultCustomerId) v.customer_id = defaultCustomerId;
  v.status = "new";
  v.priority = "medium";
  return v;
}

type Ctx = {
  values: Values;
  set: (k: string) => (v: string | null) => void;
  f: (k: string) => { value: string; onChange: (v: string | null) => void };
  lookups: LeadLookups;
  salesStaff: LookupList;
  customers: CustomerOption[];
};

export function LeadForm({
  customers,
  defaultCustomerId,
  cancelHref,
  heading = "New Lead",
  lookups = {},
  salesStaff = [],
}: {
  customers: CustomerOption[];
  defaultCustomerId?: string;
  cancelHref: string;
  heading?: string;
  lookups?: LeadLookups;
  salesStaff?: LookupList;
}) {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(createLead, {});
  const [values, setValues] = useState<Values>(() => seed(defaultCustomerId));
  const set = (k: string) => (val: string | null) => setValues((s) => ({ ...s, [k]: val ?? "" }));
  const f = (k: string) => ({ value: values[k] ?? "", onChange: set(k) });

  const ctx: Ctx = { values, set, f, lookups, salesStaff, customers };

  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const customerValid = !!values.customer_id;

  function goNext() {
    if (step === 0 && !customerValid) {
      setTouched(true);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function goTo(i: number) {
    // A lead has to belong to a customer — everything downstream (its files, its
    // notes, its address) hangs off that. Other jumps are free.
    if (i > 0 && !customerValid) {
      setStep(0);
      setTouched(true);
      return;
    }
    setStep(i);
  }

  return (
    <form action={action} className="flex flex-1 flex-col" onKeyDown={swallowEnter}>
      {ALL_KEYS.map((k) => (
        <input key={k} type="hidden" name={k} value={values[k] ?? ""} />
      ))}

      <WizardFrame
        heading={heading}
        cancelHref={cancelHref}
        steps={STEPS}
        step={step}
        onStep={goTo}
        onNext={goNext}
        error={state.error}
      >
        {step === 0 && <CustomerStep ctx={ctx} showErrors={touched} />}
        {step === 1 && <EnquiryStep ctx={ctx} />}
        {step === 2 && <ValueStep ctx={ctx} />}
        {step === 3 && <QuoteStep ctx={ctx} />}
        {step === 4 && <NotesStep ctx={ctx} />}
        {step === 5 && <ReviewStep ctx={ctx} onEdit={setStep} pending={pending} />}
      </WizardFrame>
    </form>
  );
}

// --- Steps ------------------------------------------------------------------
function CustomerStep({ ctx, showErrors }: { ctx: Ctx; showErrors: boolean }) {
  const { values, set, customers } = ctx;
  return (
    <StepShell
      title="Who is this lead for?"
      hint="Every lead belongs to a customer — that's where its notes, files and address live."
      cols={1}
    >
      <Field
        label="Customer"
        required
        error={showErrors && !values.customer_id ? "Choose a customer" : undefined}
      >
        {/* Searchable rather than a <select>: a tenant's book runs to thousands
            of names, and there is no "add new" here — a customer is created on
            its own screen, not as a side effect of logging a lead. */}
        <Combo
          variant="input"
          options={customers.map((c) => ({ id: c.id, value: c.id, label: c.name }))}
          value={values.customer_id || null}
          onChange={(v) => set("customer_id")(v)}
          // Required, so clicking the selected row must not clear it — one of
          // the two cases AGENTS.md allows clearable off for.
          clearable={false}
          placeholder="Search customers…"
          searchPlaceholder="Search by name…"
        />
      </Field>
      <Field label="Date Received">
        <DateField {...dateProps(ctx, "lead_date")} />
      </Field>
    </StepShell>
  );
}

function EnquiryStep({ ctx }: { ctx: Ctx }) {
  const { f, lookups } = ctx;
  return (
    <StepShell title="What did they ask about?" hint="Where the enquiry came from and what they want.">
      <Field label="Source">
        <Lookup {...f("source")} options={lookups.lead_source} listKey="lead_source" placeholder="How did it arrive?" />
      </Field>
      <Field label="Sub-Source">
        <Lookup {...f("sub_source")} options={lookups.lead_sub_source} listKey="lead_sub_source" placeholder="The detail" />
      </Field>
      <Field label="Main Interest">
        <Lookup {...f("product_type")} options={lookups.product_type} listKey="product_type" placeholder="e.g. Windows" />
      </Field>
      <Field label="Second Interest">
        <Lookup {...f("product_interest_2")} options={lookups.product_type} listKey="product_type" placeholder="Optional" />
      </Field>
      <Field label="Windows">
        <Txt {...textProps(ctx, "window_count")} inputMode="numeric" placeholder="Number of windows" />
      </Field>
    </StepShell>
  );
}

function ValueStep({ ctx }: { ctx: Ctx }) {
  const { f, values, set, lookups, salesStaff } = ctx;
  return (
    <StepShell title="Stage, owner and value" hint="Where it sits in the pipeline and who is working it.">
      <Field label="Stage">
        <SegStage value={values.status} onChange={set("status")} />
      </Field>
      <Field label="Priority">
        <SegPriority value={values.priority} onChange={set("priority")} />
      </Field>
      <Field label="Salesperson">
        {/* From staff_members, like the customer's Sales manager — so it carries
            add and retire rather than being free text. */}
        <Lookup
          {...f("salesman")}
          options={salesStaff}
          onAddNew={addSalesStaff}
          onDelete={deleteSalesStaff}
          placeholder="Who owns this lead?"
          addNounLabel="salesperson"
        />
      </Field>
      <Field label="Salesperson Type">
        <Lookup {...f("salesperson_type")} options={lookups.salesperson_type} listKey="salesperson_type" placeholder="Optional" />
      </Field>
      <Field label="Estimated Value (£)">
        <Txt {...textProps(ctx, "estimated_value")} inputMode="decimal" placeholder="0.00" />
      </Field>
      <Field label="Follow-Up Date">
        <DateField {...dateProps(ctx, "follow_up_date")} />
      </Field>
    </StepShell>
  );
}

function QuoteStep({ ctx }: { ctx: Ctx }) {
  const { f, lookups } = ctx;
  return (
    <StepShell
      title="Quote details"
      hint="Only if a quote has already gone out — you can fill this in later from the lead."
    >
      <Field label="Quote Type">
        <Lookup {...f("quote_type")} options={lookups.quote_type} listKey="quote_type" placeholder="Optional" />
      </Field>
      <Field label="Quote Date">
        <DateField {...dateProps(ctx, "quote_date")} />
      </Field>
      <Field label="Quoted Value (£)">
        <Txt {...textProps(ctx, "gross_value")} inputMode="decimal" placeholder="0.00" />
      </Field>
      <Field label="Payment Method">
        <Lookup {...f("payment_method")} options={lookups.payment_method} listKey="payment_method" placeholder="Optional" />
      </Field>
    </StepShell>
  );
}

function NotesStep({ ctx }: { ctx: Ctx }) {
  return (
    <StepShell title="Anything else?" hint="Requirements, access, what they said on the phone." cols={1}>
      <Field label="Lead Notes" full>
        <Area {...textProps(ctx, "notes")} rows={6} placeholder="Enquiry details, requirements…" />
      </Field>
    </StepShell>
  );
}

function ReviewStep({
  ctx,
  onEdit,
  pending,
}: {
  ctx: Ctx;
  onEdit: (i: number) => void;
  pending: boolean;
}) {
  const { values, customers, lookups } = ctx;
  void lookups;
  const customer = customers.find((c) => c.id === values.customer_id);
  const stage = LEAD_STAGES.find((s) => s.key === values.status);

  return (
    <div className="rounded-xl border border-[#e7e7ea] bg-white p-6 shadow-[0_1px_3px_rgba(10,10,10,0.06)]">
      <div className="mb-0.5 font-[family-name:var(--font-inter-tight)] text-[17px] font-bold text-[#0a0a0a]">
        Check and create
      </div>
      <p className="mb-4 text-[12.5px] text-[#71717a]">
        Everything here can be changed on the lead afterwards.
      </p>

      <div className="divide-y divide-[#f4f4f5]">
        <ReviewGroup title="Customer" onEdit={() => onEdit(0)}>
          <SumRow label="Customer">{customer?.name ?? "—"}</SumRow>
          <SumRow label="Received">{fmtDate(values.lead_date) || "Today"}</SumRow>
        </ReviewGroup>

        <ReviewGroup title="Enquiry" onEdit={() => onEdit(1)}>
          <SumRow label="Source">{join(values.source, values.sub_source) || "—"}</SumRow>
          <SumRow label="Interest">
            {join(values.product_type, values.product_interest_2) || "—"}
          </SumRow>
          {values.window_count && <SumRow label="Windows">{values.window_count}</SumRow>}
        </ReviewGroup>

        <ReviewGroup title="Stage & value" onEdit={() => onEdit(2)}>
          <SumRow label="Stage">{stage?.label ?? values.status}</SumRow>
          <SumRow label="Priority">{cap(values.priority)}</SumRow>
          <SumRow label="Salesperson">{values.salesman || "—"}</SumRow>
          <SumRow label="Estimated">{money(values.estimated_value)}</SumRow>
          {values.follow_up_date && (
            <SumRow label="Follow-up">{fmtDate(values.follow_up_date)}</SumRow>
          )}
        </ReviewGroup>

        {(values.quote_type || values.quote_date || values.gross_value || values.payment_method) && (
          <ReviewGroup title="Quote" onEdit={() => onEdit(3)}>
            {values.quote_type && <SumRow label="Type">{values.quote_type}</SumRow>}
            {values.quote_date && <SumRow label="Dated">{fmtDate(values.quote_date)}</SumRow>}
            {values.gross_value && <SumRow label="Value">{money(values.gross_value)}</SumRow>}
            {values.payment_method && <SumRow label="Payment">{values.payment_method}</SumRow>}
          </ReviewGroup>
        )}

        {values.notes && (
          <ReviewGroup title="Notes" onEdit={() => onEdit(4)}>
            <SumRow label="Notes">{values.notes}</SumRow>
          </ReviewGroup>
        )}
      </div>

      {/* The ONLY submit button in the wizard — deliberately here and not in the
          top bar, so the click that lands you on Review can't also create. */}
      <div className="mt-5 flex items-center gap-2.5 border-t border-[#f4f4f5] pt-4">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Creating…" : "Create lead"}
        </button>
        <span className="text-[12px] text-[#a1a1aa]">
          You&rsquo;ll land on the new lead.
        </span>
      </div>
    </div>
  );
}

// --- Small controls ---------------------------------------------------------
function SegStage({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[#e7e7ea] bg-[#fafafa] p-0.5">
      {LEAD_STAGES.map((s) => (
        <Seg key={s.key} active={value === s.key} onClick={() => onChange(s.key)}>
          {s.label}
        </Seg>
      ))}
    </div>
  );
}

function SegPriority({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[#e7e7ea] bg-[#fafafa] p-0.5">
      {["low", "medium", "high"].map((p) => (
        <Seg key={p} active={value === p} onClick={() => onChange(p)}>
          {cap(p)}
        </Seg>
      ))}
    </div>
  );
}

function Seg({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
        active
          ? "bg-white text-[var(--accent-blue)] shadow-[0_1px_2px_rgba(10,10,10,0.08)]"
          : "text-[#71717a] hover:text-[#3f3f46]",
      )}
    >
      {children}
    </button>
  );
}

// --- helpers ----------------------------------------------------------------
/** Txt/Area want a plain string setter; the state setter accepts null. */
function textProps(ctx: Ctx, key: string) {
  return { value: ctx.values[key] ?? "", onChange: (v: string) => ctx.set(key)(v) };
}

function dateProps(ctx: Ctx, key: string) {
  return { value: ctx.values[key] ?? "", onChange: ctx.set(key) };
}

function join(...parts: (string | undefined)[]): string {
  return parts.filter((p) => p && p.trim()).join(" · ");
}

function cap(v: string): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "—";
}

function money(v: string): string {
  const n = Number((v ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || !v) return "—";
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(v: string): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
