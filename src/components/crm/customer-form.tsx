"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import {
  saveCustomer,
  addSalesStaff,
  deleteSalesStaff,
  type CustomerFormState,
} from "@/app/(app)/customers/actions";
import { cn } from "@/lib/utils";
import {
  Area,
  CopyButton,
  DateField,
  Field,
  Lookup,
  ReviewGroup,
  StepShell,
  SumRow,
  TriRow,
  Txt,
  WizardFrame,
  swallowEnter,
  tri,
  type LookupList,
  type WizardStep,
} from "./wizard";
import { btnPrimary, btnSecondary } from "./primitives";

export type Lookups = Record<string, LookupList>;

export type CustomerFormValues = {
  id?: string;
  customer_type?: string | null;
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  first_name_2?: string | null;
  last_name_2?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  mobile_2?: string | null;
  home_telephone?: string | null;
  work_telephone?: string | null;
  house_name?: string | null;
  house_number?: string | null;
  street?: string | null;
  locality?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
  what_3_words?: string | null;
  directions?: string | null;
  notes?: string | null;
  invoice_name?: string | null;
  invoice_address_1?: string | null;
  invoice_address_2?: string | null;
  invoice_address_3?: string | null;
  invoice_address_4?: string | null;
  invoice_postcode?: string | null;
  invoice_tel?: string | null;
  payment_terms?: string | null;
  sales_manager?: string | null;
  vat_no?: string | null;
  default_account_reference?: string | null;
  marketing_code?: string | null;
  opt_in_date?: string | null;
  opted_in_by?: string | null;
  flash_note?: string | null;
};

type Values = Record<string, string>;

// Every field the CREATE wizard collects. The legacy EDIT screen submits only a
// basic subset (see BASIC_KEYS); the save action patches ONLY the keys actually
// submitted, so a field the form didn't render is never nulled.
const ALL_KEYS = [
  "customer_type", "title", "first_name", "last_name", "first_name_2", "last_name_2", "company_name",
  "email", "mobile", "mobile_2", "home_telephone", "work_telephone",
  "house_name", "house_number", "street", "locality", "town", "county", "postcode", "what_3_words", "directions",
  "invoice_name", "invoice_address_1", "invoice_address_2", "invoice_address_3", "invoice_address_4",
  "invoice_postcode", "invoice_tel", "payment_terms", "sales_manager", "vat_no", "default_account_reference",
  "marketing_code", "opt_in_date", "opted_in_by",
  "email_opt_in", "sms_opt_in", "phone_opt_in", "letter_opt_in",
  "do_not_contact", "bad_payer", "customer_moved_away",
  "flash_note", "notes",
];

// What the unlinked legacy edit page loads (getCustomer) and can safely re-save.
const BASIC_KEYS = [
  "customer_type", "title", "first_name", "last_name", "company_name",
  "email", "mobile", "home_telephone",
  "house_name", "house_number", "street", "locality", "town", "county", "postcode", "what_3_words",
  "notes",
];

function seed(initial: CustomerFormValues): Values {
  const v: Values = {};
  for (const k of ALL_KEYS) {
    const raw = (initial as Record<string, unknown>)[k];
    v[k] = raw == null ? "" : String(raw);
  }
  if (!v.customer_type) v.customer_type = "residential";
  return v;
}

export function CustomerForm({
  initial = {},
  cancelHref,
  heading,
  lookups = {},
  salesUsers = [],
}: {
  initial?: CustomerFormValues;
  cancelHref: string;
  heading: string;
  lookups?: Lookups;
  salesUsers?: LookupList;
}) {
  const [state, action, pending] = useActionState<CustomerFormState, FormData>(saveCustomer, {});
  const isEdit = !!initial.id;

  const [values, setValues] = useState<Values>(() => seed(initial));
  const set = (k: string) => (val: string | null) =>
    setValues((s) => ({ ...s, [k]: val ?? "" }));
  const f = (k: string) => ({ value: values[k] ?? "", onChange: set(k) });

  const isCommercial = values.customer_type === "commercial";
  const activeKeys = isEdit ? BASIC_KEYS : ALL_KEYS;

  const ctx = { values, set, f, lookups, salesUsers, isCommercial, setValues };

  return (
    <form
      action={action}
      className="flex flex-1 flex-col"
      // In the wizard, only the Review step has a submit button; block Enter
      // elsewhere so a keystroke in a field can't create the customer early.
      onKeyDown={swallowEnter}
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {/* Every value rides as a hidden input so the native form submits the whole
          record at once — the visible step UI only edits this state. */}
      {activeKeys.map((k) => (
        <input key={k} type="hidden" name={k} value={values[k] ?? ""} />
      ))}

      {isEdit ? (
        <EditForm ctx={ctx} heading={heading} cancelHref={cancelHref} pending={pending} error={state.error} />
      ) : (
        <Wizard ctx={ctx} heading={heading} cancelHref={cancelHref} pending={pending} error={state.error} />
      )}
    </form>
  );
}

// Shared context passed to steps.
type Ctx = {
  values: Values;
  set: (k: string) => (v: string | null) => void;
  f: (k: string) => { value: string; onChange: (v: string | null) => void };
  lookups: Lookups;
  salesUsers: LookupList;
  isCommercial: boolean;
  setValues: React.Dispatch<React.SetStateAction<Values>>;
};

// ============================================================================
// Wizard (create)
// ============================================================================
const STEPS: WizardStep[] = [
  { key: "identity", label: "Identity" },
  { key: "contact", label: "Contact" },
  { key: "address", label: "Address" },
  { key: "billing", label: "Billing", optional: true },
  { key: "marketing", label: "Marketing", optional: true },
  { key: "review", label: "Review" },
];

function Wizard({
  ctx,
  heading,
  cancelHref,
  pending,
  error,
}: {
  ctx: Ctx;
  heading: string;
  cancelHref: string;
  pending: boolean;
  error?: string;
}) {
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const reviewIndex = STEPS.length - 1;

  const identityValid =
    !!ctx.values.first_name.trim() &&
    !!ctx.values.last_name.trim() &&
    (!ctx.isCommercial || !!ctx.values.company_name.trim());

  function goNext() {
    if (step === 0 && !identityValid) {
      setTouched(true);
      return;
    }
    setStep((s) => Math.min(s + 1, reviewIndex));
  }
  function goTo(i: number) {
    // Leaving identity requires the essentials; other jumps are free.
    if (i > 0 && !identityValid) {
      setStep(0);
      setTouched(true);
      return;
    }
    setStep(i);
  }

  return (
    <WizardFrame
      heading={heading}
      cancelHref={cancelHref}
      steps={STEPS}
      step={step}
      onStep={goTo}
      onNext={goNext}
      error={error}
    >
      {step === 0 && <IdentityStep ctx={ctx} showErrors={touched} />}
      {step === 1 && <ContactStep ctx={ctx} />}
      {step === 2 && <AddressStep ctx={ctx} />}
      {step === 3 && <BillingStep ctx={ctx} />}
      {step === 4 && <MarketingStep ctx={ctx} />}
      {step === 5 && <ReviewStep ctx={ctx} onEdit={setStep} pending={pending} />}
    </WizardFrame>
  );
}

// --- Steps ------------------------------------------------------------------
function IdentityStep({ ctx, showErrors }: { ctx: Ctx; showErrors: boolean }) {
  const { f, values, lookups } = ctx;
  return (
    <StepShell title="Who is the customer?" hint="Only a name is required — everything else can be filled in later.">
      <Field label="Customer Type">
        <SegType value={values.customer_type} onChange={ctx.set("customer_type")} />
      </Field>
      <Field label="Title">
        <Lookup {...f("title")} options={lookups.title} listKey="title" placeholder="Mr / Mrs / Dr…" />
      </Field>
      <Field label="First Name" required error={showErrors && !values.first_name.trim() ? "Required" : undefined}>
        <Txt {...f("first_name")} autoFocus />
      </Field>
      <Field label="Last Name" required error={showErrors && !values.last_name.trim() ? "Required" : undefined}>
        <Txt {...f("last_name")} />
      </Field>
      <Field label="Second First Name">
        <Txt {...f("first_name_2")} placeholder="Partner / joint owner" />
      </Field>
      <Field label="Second Last Name">
        <Txt {...f("last_name_2")} />
      </Field>
      {ctx.isCommercial && (
        <Field
          label="Company Name"
          required
          full
          error={showErrors && !values.company_name.trim() ? "Required for commercial customers" : undefined}
        >
          <Txt {...f("company_name")} />
        </Field>
      )}
    </StepShell>
  );
}

function ContactStep({ ctx }: { ctx: Ctx }) {
  const { f } = ctx;
  return (
    <StepShell title="How do we reach them?">
      <Field label="Mobile">
        <Txt {...f("mobile")} inputMode="tel" />
      </Field>
      <Field label="Mobile 2">
        <Txt {...f("mobile_2")} inputMode="tel" />
      </Field>
      <Field label="Home">
        <Txt {...f("home_telephone")} inputMode="tel" />
      </Field>
      <Field label="Work">
        <Txt {...f("work_telephone")} inputMode="tel" />
      </Field>
      <Field label="Email" full>
        <Txt {...f("email")} type="email" inputMode="email" />
      </Field>
    </StepShell>
  );
}

function AddressStep({ ctx }: { ctx: Ctx }) {
  const { f, lookups } = ctx;
  return (
    <StepShell title="Where are they?" cols={2}>
      <Field label="House Name">
        <Txt {...f("house_name")} />
      </Field>
      <Field label="House Number">
        <Txt {...f("house_number")} />
      </Field>
      <Field label="Street" full>
        <Txt {...f("street")} />
      </Field>
      <Field label="Locality">
        <Lookup {...f("locality")} options={lookups.locality} listKey="locality" />
      </Field>
      <Field label="Town">
        <Lookup {...f("town")} options={lookups.town} listKey="town" />
      </Field>
      <Field label="County">
        <Lookup {...f("county")} options={lookups.county} listKey="county" />
      </Field>
      <Field label="Postcode">
        <Txt {...f("postcode")} mono uppercase />
      </Field>
      <Field label="what3words">
        <Txt {...f("what_3_words")} mono placeholder="///plot.gains.slower" />
      </Field>
      <Field label="Access Notes">
        <Area {...f("directions")} placeholder="Gate code, parking, where to find them…" />
      </Field>
    </StepShell>
  );
}

function BillingStep({ ctx }: { ctx: Ctx }) {
  const { f, lookups, salesUsers, values, setValues, isCommercial } = ctx;

  // Copy-across: fill the invoice block from the customer + main address so the
  // same address isn't typed twice.
  function sameAsMain() {
    const houseLine = [values.house_name, [values.house_number, values.street].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
    const lines = [houseLine, values.locality, values.town, values.county].filter(Boolean);
    setValues((s) => ({
      ...s,
      invoice_name: isCommercial
        ? s.company_name
        : [s.first_name, s.last_name].filter(Boolean).join(" ").trim(),
      invoice_address_1: lines[0] ?? "",
      invoice_address_2: lines[1] ?? "",
      invoice_address_3: lines[2] ?? "",
      invoice_address_4: lines[3] ?? "",
      invoice_postcode: s.postcode,
      invoice_tel: s.mobile || s.home_telephone || s.work_telephone,
    }));
  }

  return (
    <StepShell title="Billing & Account" hint="All optional. Skip it if you invoice the customer at their main address.">
      <div className="col-span-full -mt-1 flex flex-wrap items-center gap-2">
        <CopyButton onClick={sameAsMain}>Same as main address</CopyButton>
        <button
          type="button"
          onClick={() =>
            setValues((s) => ({
              ...s,
              invoice_name: "",
              invoice_address_1: "",
              invoice_address_2: "",
              invoice_address_3: "",
              invoice_address_4: "",
              invoice_postcode: "",
              invoice_tel: "",
            }))
          }
          className="text-[12px] font-medium text-[#a1a1aa] hover:text-[#71717a]"
        >
          Clear
        </button>
      </div>

      <Field label="Invoice Name" full>
        <Txt {...f("invoice_name")} />
      </Field>
      <Field label="Invoice Address 1">
        <Txt {...f("invoice_address_1")} />
      </Field>
      <Field label="Invoice Address 2">
        <Txt {...f("invoice_address_2")} />
      </Field>
      <Field label="Invoice Address 3">
        <Txt {...f("invoice_address_3")} />
      </Field>
      <Field label="Invoice Address 4">
        <Txt {...f("invoice_address_4")} />
      </Field>
      <Field label="Invoice Postcode">
        <Txt {...f("invoice_postcode")} mono uppercase />
      </Field>
      <Field label="Invoice Tel">
        <Txt {...f("invoice_tel")} inputMode="tel" />
      </Field>

      <div className="col-span-full mt-2 border-t border-[#f4f4f5] pt-4" />
      <Field label="Payment Terms">
        <Lookup {...f("payment_terms")} options={lookups.payment_terms} listKey="payment_terms" />
      </Field>
      <Field label="Sales Manager">
        <Lookup
          {...f("sales_manager")}
          options={salesUsers}
          onAddNew={addSalesStaff}
          onDelete={deleteSalesStaff}
          addNounLabel="Add staff"
        />
      </Field>
      <Field label="VAT Number">
        <Txt {...f("vat_no")} mono />
      </Field>
      <Field label="Accounts Reference">
        <Txt {...f("default_account_reference")} mono />
      </Field>
    </StepShell>
  );
}

function MarketingStep({ ctx }: { ctx: Ctx }) {
  const { f, lookups } = ctx;
  return (
    <div className="flex flex-col gap-4">
      <StepShell title="Marketing & Consent" hint="All optional — leave consent as “Not asked” until you have a clear answer.">
        <Field label="Referral Source">
          <Lookup {...f("marketing_code")} options={lookups.marketing_source} listKey="marketing_source" placeholder="How did they find you?" />
        </Field>
        <Field label="Consent Given">
          <DateField {...f("opt_in_date")} />
        </Field>
        <Field label="Consent By">
          <Lookup {...f("opted_in_by")} options={lookups.consent_by} listKey="consent_by" />
        </Field>
        <div className="col-span-full mt-1 border-t border-[#f4f4f5] pt-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">Marketing Consent</div>
          <TriRow label="Email" {...f("email_opt_in")} />
          <TriRow label="SMS" {...f("sms_opt_in")} />
          <TriRow label="Phone" {...f("phone_opt_in")} />
          <TriRow label="Post" {...f("letter_opt_in")} last />
        </div>
      </StepShell>

      <StepShell title="Flags & Notes" cols={1}>
        <div>
          <TriRow label="Do Not Contact" {...f("do_not_contact")} danger />
          <TriRow label="Payment Risk" {...f("bad_payer")} danger />
          <TriRow label="Moved Away" {...f("customer_moved_away")} danger last />
        </div>
        <Field label="Alert Note" full>
          <Area {...f("flash_note")} placeholder="Shown prominently on the record — e.g. “Aggressive dog in rear garden”" />
        </Field>
        <Field label="Customer Notes" full>
          <Area {...f("notes")} rows={4} placeholder="Preferences, history, anything the team should know…" />
        </Field>
      </StepShell>
    </div>
  );
}

function ReviewStep({ ctx, onEdit, pending }: { ctx: Ctx; onEdit: (i: number) => void; pending: boolean }) {
  const { values, isCommercial } = ctx;
  const name = [values.title, values.first_name, values.last_name].filter(Boolean).join(" ");
  const second = [values.first_name_2, values.last_name_2].filter(Boolean).join(" ");
  const addr = [
    [values.house_name, [values.house_number, values.street].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    values.locality,
    values.town,
    values.county,
    values.postcode,
  ]
    .filter(Boolean)
    .join(", ");
  const invoice = [
    values.invoice_name,
    values.invoice_address_1,
    values.invoice_address_2,
    values.invoice_address_3,
    values.invoice_address_4,
    values.invoice_postcode,
  ]
    .filter(Boolean)
    .join(", ");
  const consent = [
    tri("Email", values.email_opt_in),
    tri("SMS", values.sms_opt_in),
    tri("Phone", values.phone_opt_in),
    tri("Post", values.letter_opt_in),
  ]
    .filter(Boolean)
    .join(" · ");
  const flags = [
    values.do_not_contact === "true" ? "Do not contact" : null,
    values.bad_payer === "true" ? "Payment risk" : null,
    values.customer_moved_away === "true" ? "Moved away" : null,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-[#e7e7ea] bg-white p-6 shadow-[0_1px_3px_rgba(10,10,10,0.06)]">
      <div className="mb-4 font-[family-name:var(--font-inter-tight)] text-[17px] font-bold text-[#0a0a0a]">
        Review &amp; Create
      </div>
      <div className="flex flex-col divide-y divide-[#f4f4f5]">
        <ReviewGroup title="Identity" onEdit={() => onEdit(0)}>
          <SumRow label="Name">{name || "—"}</SumRow>
          <SumRow label="Type">{isCommercial ? "Commercial" : "Residential"}</SumRow>
          {isCommercial && <SumRow label="Company">{values.company_name || "—"}</SumRow>}
          {second && <SumRow label="Second Name">{second}</SumRow>}
        </ReviewGroup>

        <ReviewGroup title="Contact" onEdit={() => onEdit(1)}>
          <SumRow label="Mobile">{values.mobile || "—"}</SumRow>
          {values.mobile_2 && <SumRow label="Mobile 2">{values.mobile_2}</SumRow>}
          <SumRow label="Home">{values.home_telephone || "—"}</SumRow>
          {values.work_telephone && <SumRow label="Work">{values.work_telephone}</SumRow>}
          <SumRow label="Email">{values.email || "—"}</SumRow>
        </ReviewGroup>

        <ReviewGroup title="Address" onEdit={() => onEdit(2)}>
          <SumRow label="Address">{addr || "—"}</SumRow>
          {values.what_3_words && <SumRow label="what3words">{`/// ${values.what_3_words}`}</SumRow>}
          {values.directions && <SumRow label="Access">{values.directions}</SumRow>}
        </ReviewGroup>

        {(invoice || values.payment_terms || values.sales_manager || values.vat_no) && (
          <ReviewGroup title="Billing & Account" onEdit={() => onEdit(3)}>
            {invoice && <SumRow label="Invoice To">{invoice}</SumRow>}
            {values.payment_terms && <SumRow label="Payment Terms">{values.payment_terms}</SumRow>}
            {values.sales_manager && <SumRow label="Sales Manager">{values.sales_manager}</SumRow>}
            {values.vat_no && <SumRow label="VAT No.">{values.vat_no}</SumRow>}
          </ReviewGroup>
        )}

        {(values.marketing_code || consent || flags.length > 0 || values.flash_note || values.notes) && (
          <ReviewGroup title="Marketing, flags & notes" onEdit={() => onEdit(4)}>
            {values.marketing_code && <SumRow label="Referral">{values.marketing_code}</SumRow>}
            {consent && <SumRow label="Consent">{consent}</SumRow>}
            {flags.length > 0 && (
              <SumRow label="Flags">
                <span className="text-[#d64545]">{flags.join(" · ")}</span>
              </SumRow>
            )}
            {values.flash_note && <SumRow label="Alert">{values.flash_note}</SumRow>}
            {values.notes && <SumRow label="Notes">{values.notes}</SumRow>}
          </ReviewGroup>
        )}
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-[#f4f4f5] pt-4">
        <p className="text-[12px] text-[#a1a1aa]">
          Everything here is editable on the record after creating.
        </p>
        <button type="submit" disabled={pending} className={cn(btnPrimary, "ml-auto")}>
          {pending ? "Creating…" : "Create customer"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Edit (legacy, single page — basic fields only, so nothing is nulled)
// ============================================================================
function EditForm({
  ctx,
  heading,
  cancelHref,
  pending,
  error,
}: {
  ctx: Ctx;
  heading: string;
  cancelHref: string;
  pending: boolean;
  error?: string;
}) {
  const { f, values, lookups } = ctx;
  return (
    <div className="flex flex-col gap-4 py-1">
      <div className="sticky top-0 z-20 -mx-[26px] flex items-center gap-3 border-b border-[#e7e7ea] bg-white/95 px-[26px] py-3 backdrop-blur-sm">
        <h1 className="min-w-0 truncate font-[family-name:var(--font-inter-tight)] text-[22px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
          {heading}
        </h1>
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <Link href={cancelHref} className={btnSecondary}>
            Cancel
          </Link>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-[#f3c7c7] bg-[#fdecec] px-3.5 py-2.5 text-[13px] font-medium text-[#d64545]">
          {error}
        </div>
      )}

      <StepShell title="Identity">
        <Field label="Customer Type">
          <SegType value={values.customer_type} onChange={ctx.set("customer_type")} />
        </Field>
        <Field label="Title">
          <Lookup {...f("title")} options={lookups.title} listKey="title" />
        </Field>
        <Field label="First Name" required>
          <Txt {...f("first_name")} />
        </Field>
        <Field label="Last Name" required>
          <Txt {...f("last_name")} />
        </Field>
        {ctx.isCommercial && (
          <Field label="Company Name" required full>
            <Txt {...f("company_name")} />
          </Field>
        )}
      </StepShell>

      <StepShell title="Contact">
        <Field label="Mobile">
          <Txt {...f("mobile")} inputMode="tel" />
        </Field>
        <Field label="Home">
          <Txt {...f("home_telephone")} inputMode="tel" />
        </Field>
        <Field label="Email" full>
          <Txt {...f("email")} type="email" />
        </Field>
      </StepShell>

      <StepShell title="Address" cols={2}>
        <Field label="House Name">
          <Txt {...f("house_name")} />
        </Field>
        <Field label="House Number">
          <Txt {...f("house_number")} />
        </Field>
        <Field label="Street" full>
          <Txt {...f("street")} />
        </Field>
        <Field label="Locality">
          <Lookup {...f("locality")} options={lookups.locality} listKey="locality" />
        </Field>
        <Field label="Town">
          <Lookup {...f("town")} options={lookups.town} listKey="town" />
        </Field>
        <Field label="County">
          <Lookup {...f("county")} options={lookups.county} listKey="county" />
        </Field>
        <Field label="Postcode">
          <Txt {...f("postcode")} mono uppercase />
        </Field>
        <Field label="what3words">
          <Txt {...f("what_3_words")} mono />
        </Field>
      </StepShell>

      <StepShell title="Notes" cols={1}>
        <Field label="Customer Notes" full>
          <Area {...f("notes")} rows={4} />
        </Field>
      </StepShell>
    </div>
  );
}

// ============================================================================
// Inputs & primitives
// ============================================================================
// blank / Yes / No — "Not asked" is a distinct state from a recorded No.

// Residential vs Commercial — customer-specific, so it stays here rather than in
// the shared wizard primitives.
function SegType({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[#e7e7ea] bg-[#fafafa] p-0.5">
      {[
        { v: "residential", label: "Residential" },
        { v: "commercial", label: "Commercial" },
      ].map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
              active
                ? "bg-white text-[var(--accent-blue)] shadow-[0_1px_2px_rgba(10,10,10,0.08)]"
                : "text-[#71717a] hover:text-[#3f3f46]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
