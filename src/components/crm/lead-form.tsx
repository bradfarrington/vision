"use client";

import { useActionState, useMemo, useState } from "react";

import { createLead, type LeadFormState } from "@/app/(app)/leads/actions";
import { addSalesStaff, deleteSalesStaff } from "@/app/(app)/customers/actions";
import type { CustomerMatch, MatchCriteria } from "@/lib/data/customer-match";
import { LEAD_STAGES, customerRef } from "@/lib/leads";
import { humanLabel } from "@/lib/format";
import { CustomerMatchPanel, MatchRow, useCustomerMatches } from "./customer-match";
import { btnPrimary, RefChip } from "./primitives";
import {
  Area,
  CopyButton,
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

// ---------------------------------------------------------------------------
// New Lead — capture first, match second.
//
// This wizard used to OPEN on a customer picker, which asked the person taking
// the call a question they can't answer: at four thousand customers nobody knows
// whether the voice on the phone is a repeat. So it now captures the enquiry as
// loose details — name, number, address — and matches them against the book as
// they are typed. Linking is offered, never assumed (§ AGENTS.md).
//
// Two consequences that shape everything below:
//   - The lead can create its customer. There is no "you need a customer first"
//     dead end any more.
//   - Linking must not quietly rewrite a record that may be a decade old, so
//     blanks are filled and CONFLICTS ARE ASKED ABOUT on Review.
// ---------------------------------------------------------------------------

export type LeadLookups = Record<string, LookupList>;

type Values = Record<string, string>;

// The lead's own columns.
const LEAD_KEYS = [
  "source", "sub_source", "lead_date",
  "product_type", "product_interest_2", "window_count",
  "status", "priority", "salesman", "salesperson_type",
  "gross_value", "estimated_value", "follow_up_date",
  "quote_type", "quote_date", "payment_method",
  "notes",
];

// The customer being captured. `c_`-prefixed so they can't collide with the
// lead's own columns — both have `notes`, `source` and a `town`.
const CAPTURE_FIELDS = [
  "customer_type", "title", "first_name", "last_name", "company_name",
  "email", "mobile", "home_telephone",
  "house_name", "house_number", "street", "locality", "town", "county",
  "postcode", "what_3_words",
];
const CAPTURE_KEYS = CAPTURE_FIELDS.map((f) => `c_${f}`);

// Where the work is, when that isn't the customer's own address.
const SITE_FIELDS = [
  "house_name", "house_number", "street", "locality", "town", "county",
  "postcode", "what_3_words",
];
const SITE_KEYS = SITE_FIELDS.map((f) => `site_${f}`);

const ALL_KEYS = [...LEAD_KEYS, ...CAPTURE_KEYS, ...SITE_KEYS];

/** Contact + address fields a link may write back onto an existing customer.
 *  Mirrors PATCHABLE_ON_LINK in the server action — names are never patched. */
const PATCHABLE = [
  "email", "mobile", "home_telephone",
  "house_name", "house_number", "street", "locality", "town", "county",
  "postcode", "what_3_words",
];

const FIELD_LABEL: Record<string, string> = {
  email: "Email",
  mobile: "Mobile",
  home_telephone: "Home Phone",
  house_name: "House Name",
  house_number: "House Number",
  street: "Street",
  locality: "Locality",
  town: "Town",
  county: "County",
  postcode: "Postcode",
  what_3_words: "what3words",
};

const STEPS: WizardStep[] = [
  { key: "contact", label: "Contact" },
  { key: "address", label: "Address" },
  { key: "enquiry", label: "Enquiry" },
  { key: "value", label: "Value" },
  { key: "quote", label: "Quote", optional: true },
  { key: "notes", label: "Notes", optional: true },
  { key: "review", label: "Review" },
];

function seed(linked: CustomerMatch | null): Values {
  const v: Values = {};
  for (const k of ALL_KEYS) v[k] = "";
  v.status = "new";
  v.priority = "medium";
  v.c_customer_type = "residential";
  if (linked) applyCustomer(v, linked);
  return v;
}

/** Pull a customer's details through into the capture fields. */
function applyCustomer(v: Values, m: CustomerMatch) {
  for (const f of CAPTURE_FIELDS) {
    const value = (m.fields as Record<string, string | null>)[f];
    v[`c_${f}`] = value ?? "";
  }
  if (!v.c_customer_type) v.c_customer_type = "residential";
}

type Ctx = {
  values: Values;
  set: (k: string) => (v: string | null) => void;
  f: (k: string) => { value: string; onChange: (v: string | null) => void };
  lookups: LeadLookups;
  salesStaff: LookupList;
};

export function LeadForm({
  initialLinked = null,
  cancelHref,
  heading = "New Lead",
  lookups = {},
  salesStaff = [],
}: {
  /** Pre-linked when arriving from a customer record's "New lead" button. */
  initialLinked?: CustomerMatch | null;
  cancelHref: string;
  heading?: string;
  lookups?: LeadLookups;
  salesStaff?: LookupList;
}) {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(createLead, {});
  const [values, setValues] = useState<Values>(() => seed(initialLinked));
  const [linked, setLinked] = useState<CustomerMatch | null>(initialLinked);
  // What was typed before linking, so "Not them" gives it back and a conflict can
  // offer the alternative rather than losing it.
  const [typed, setTyped] = useState<Values | null>(null);

  const set = (k: string) => (val: string | null) => setValues((s) => ({ ...s, [k]: val ?? "" }));
  const f = (k: string) => ({ value: values[k] ?? "", onChange: set(k) });
  const ctx: Ctx = { values, set, f, lookups, salesStaff };

  const criteria: MatchCriteria = useMemo(
    () => ({
      firstName: values.c_first_name,
      lastName: values.c_last_name,
      companyName: values.c_company_name,
      email: values.c_email,
      mobile: values.c_mobile,
      homeTelephone: values.c_home_telephone,
      houseName: values.c_house_name,
      houseNumber: values.c_house_number,
      street: values.c_street,
      town: values.c_town,
      postcode: values.c_postcode,
    }),
    [values],
  );
  // Matching lives in the form, not the panel: Review needs it too, to catch
  // "you're about to create a second Margaret Ellison".
  const { matches, searching } = useCustomerMatches(criteria, !linked);

  function link(m: CustomerMatch) {
    setTyped(values);
    setLinked(m);
    setValues((s) => {
      const next = { ...s };
      applyCustomer(next, m);
      // A detail the customer has BLANK keeps what was typed — it fills the gap
      // on their record rather than being thrown away.
      for (const field of PATCHABLE) {
        const onRecord = (m.fields as Record<string, string | null>)[field];
        if (!onRecord?.trim() && s[`c_${field}`]?.trim()) next[`c_${field}`] = s[`c_${field}`];
      }
      return next;
    });
  }

  function unlink() {
    setLinked(null);
    if (typed) setValues(typed);
    setTyped(null);
  }

  // Fields where the linked customer holds a DIFFERENT value from what is in the
  // form — each becomes an explicit choice on Review. Derived, never stored: the
  // form's value IS the answer, and `apply_updates` is computed from it.
  const conflicts = useMemo(() => {
    if (!linked) return [];
    return PATCHABLE.map((field) => {
      const onRecord = ((linked.fields as Record<string, string | null>)[field] ?? "").trim();
      const current = (values[`c_${field}`] ?? "").trim();
      const wasTyped = (typed?.[`c_${field}`] ?? "").trim();
      // Only a field that had a value on both sides is a conflict; a blank on
      // the record is a fill, not a clash.
      if (!onRecord) return null;
      const alternative = wasTyped && !same(wasTyped, onRecord) ? wasTyped : null;
      if (!alternative) return null;
      return { field, onRecord, alternative, chosen: same(current, alternative) ? "new" : "keep" };
    }).filter(Boolean) as Conflict[];
  }, [linked, values, typed]);

  // Blanks on the linked record that this capture will fill in.
  const fills = useMemo(() => {
    if (!linked) return [];
    return PATCHABLE.filter((field) => {
      const onRecord = ((linked.fields as Record<string, string | null>)[field] ?? "").trim();
      return !onRecord && (values[`c_${field}`] ?? "").trim();
    });
  }, [linked, values]);

  // What the server needs to know it may overwrite: a patchable field whose form
  // value differs from the one on the record.
  const applyUpdates = useMemo(() => {
    if (!linked) return [] as string[];
    return PATCHABLE.filter((field) => {
      const onRecord = ((linked.fields as Record<string, string | null>)[field] ?? "").trim();
      const current = (values[`c_${field}`] ?? "").trim();
      return !!onRecord && !!current && !same(onRecord, current);
    });
  }, [linked, values]);

  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);

  const commercial = values.c_customer_type === "commercial";
  const contactValid =
    !!linked ||
    (!!values.c_first_name.trim() &&
      !!values.c_last_name.trim() &&
      (!commercial || !!values.c_company_name.trim()));

  function goNext() {
    if (step === 0 && !contactValid) {
      setTouched(true);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function goTo(i: number) {
    // A lead has to end up on a customer — either a linked one or one created
    // from these details — so the capture step can't be skipped past empty.
    if (i > 0 && !contactValid) {
      setStep(0);
      setTouched(true);
      return;
    }
    setStep(i);
  }

  return (
    <form action={action} className="flex flex-1 flex-col" onKeyDown={swallowEnter}>
      <input type="hidden" name="customer_id" value={linked?.id ?? ""} />
      <input type="hidden" name="apply_updates" value={JSON.stringify(applyUpdates)} />
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
        {step === 0 && (
          <ContactStep
            ctx={ctx}
            showErrors={touched}
            matches={matches}
            searching={searching}
            linked={linked}
            onLink={link}
            onUnlink={unlink}
          />
        )}
        {step === 1 && <AddressStep ctx={ctx} linked={linked} />}
        {step === 2 && <EnquiryStep ctx={ctx} />}
        {step === 3 && <ValueStep ctx={ctx} />}
        {step === 4 && <QuoteStep ctx={ctx} />}
        {step === 5 && <NotesStep ctx={ctx} />}
        {step === 6 && (
          <ReviewStep
            ctx={ctx}
            onEdit={setStep}
            pending={pending}
            linked={linked}
            matches={matches}
            onLink={link}
            conflicts={conflicts}
            fills={fills}
            onChoose={(field, choice) =>
              set(`c_${field}`)(
                choice === "new"
                  ? (typed?.[`c_${field}`] ?? "")
                  : ((linked?.fields as Record<string, string | null> | undefined)?.[field] ?? ""),
              )
            }
          />
        )}
      </WizardFrame>
    </form>
  );
}

type Conflict = {
  field: string;
  onRecord: string;
  alternative: string;
  chosen: "keep" | "new";
};

// --- Steps ------------------------------------------------------------------
function ContactStep({
  ctx,
  showErrors,
  matches,
  searching,
  linked,
  onLink,
  onUnlink,
}: {
  ctx: Ctx;
  showErrors: boolean;
  matches: CustomerMatch[];
  searching: boolean;
  linked: CustomerMatch | null;
  onLink: (m: CustomerMatch) => void;
  onUnlink: () => void;
}) {
  const { f, values, set, lookups } = ctx;
  const commercial = values.c_customer_type === "commercial";
  return (
    <div className="flex flex-col gap-4">
      <StepShell
        title="Who has enquired?"
        hint="Take their details as they give them — we'll check the customer book as you type."
      >
        <Field label="Customer Type">
          <SegType value={values.c_customer_type} onChange={set("c_customer_type")} />
        </Field>
        <Field label="Title">
          <Lookup {...f("c_title")} options={lookups.title} listKey="title" placeholder="Mr / Mrs / Dr…" />
        </Field>
        <Field
          label="First Name"
          required={!linked}
          error={showErrors && !linked && !values.c_first_name.trim() ? "Required" : undefined}
        >
          <Txt {...text(ctx, "c_first_name")} autoFocus />
        </Field>
        <Field
          label="Last Name"
          required={!linked}
          error={showErrors && !linked && !values.c_last_name.trim() ? "Required" : undefined}
        >
          <Txt {...text(ctx, "c_last_name")} />
        </Field>
        {commercial && (
          <Field
            label="Company Name"
            required={!linked}
            full
            error={showErrors && !linked && !values.c_company_name.trim() ? "Required for commercial customers" : undefined}
          >
            <Txt {...text(ctx, "c_company_name")} />
          </Field>
        )}
        <Field label="Mobile">
          <Txt {...text(ctx, "c_mobile")} inputMode="tel" placeholder="07700 900123" />
        </Field>
        <Field label="Home Phone">
          <Txt {...text(ctx, "c_home_telephone")} inputMode="tel" />
        </Field>
        <Field label="Email" full>
          <Txt {...text(ctx, "c_email")} type="email" inputMode="email" />
        </Field>
        <Field label="Postcode">
          <Txt {...text(ctx, "c_postcode")} mono uppercase placeholder="B77 2RL" />
        </Field>
        <Field label="Date Received">
          <DateField {...date(ctx, "lead_date")} />
        </Field>
      </StepShell>

      {/* The whole point of the redesign: the book is searched FOR them, from
          what they've already typed. */}
      <CustomerMatchPanel
        matches={matches}
        searching={searching}
        linked={linked}
        onLink={onLink}
        onUnlink={onUnlink}
      />
    </div>
  );
}

function AddressStep({ ctx, linked }: { ctx: Ctx; linked: CustomerMatch | null }) {
  const { f, values, lookups, set } = ctx;

  // Start the site address from the customer's, for the common case where the
  // work IS at their address but the enquiry is about a specific plot/flat.
  function copyFromCustomer() {
    for (const field of SITE_FIELDS) set(`site_${field}`)(values[`c_${field}`] ?? "");
  }
  function clearSite() {
    for (const field of SITE_FIELDS) set(`site_${field}`)("");
  }
  const siteFilled = SITE_FIELDS.some((field) => (values[`site_${field}`] ?? "").trim());

  return (
    <div className="flex flex-col gap-4">
      <StepShell
        title="Customer address"
        hint={
          linked
            ? "Pulled through from their record. Anything you change here is confirmed before it's saved."
            : "Where the customer lives — this becomes their address on the new record."
        }
        cols={2}
      >
        <Field label="House Name">
          <Txt {...text(ctx, "c_house_name")} />
        </Field>
        <Field label="House Number">
          <Txt {...text(ctx, "c_house_number")} />
        </Field>
        <Field label="Street" full>
          <Txt {...text(ctx, "c_street")} />
        </Field>
        <Field label="Locality">
          <Lookup {...f("c_locality")} options={lookups.locality} listKey="locality" />
        </Field>
        <Field label="Town">
          <Lookup {...f("c_town")} options={lookups.town} listKey="town" />
        </Field>
        <Field label="County">
          <Lookup {...f("c_county")} options={lookups.county} listKey="county" />
        </Field>
        <Field label="Postcode">
          <Txt {...text(ctx, "c_postcode")} mono uppercase />
        </Field>
        <Field label="what3words">
          <Txt {...text(ctx, "c_what_3_words")} mono placeholder="///plot.gains.slower" />
        </Field>
      </StepShell>

      {/* Deliberately blank until asked for: most jobs are at the customer's own
          address, and a pre-filled site address would be a claim nobody made.
          Landlords and second properties are exactly why it exists. */}
      <StepShell
        title="Site address"
        hint="Where the work is, if that's somewhere else. Leave it blank and the job is at the customer's address."
        cols={2}
      >
        <div className="col-span-full -mt-1 flex flex-wrap items-center gap-2">
          <CopyButton onClick={copyFromCustomer}>Same as customer address</CopyButton>
          {siteFilled && (
            <button
              type="button"
              onClick={clearSite}
              className="text-[12px] font-medium text-[#a1a1aa] hover:text-[#71717a]"
            >
              Clear
            </button>
          )}
        </div>
        <Field label="House Name">
          <Txt {...text(ctx, "site_house_name")} />
        </Field>
        <Field label="House Number">
          <Txt {...text(ctx, "site_house_number")} />
        </Field>
        <Field label="Street" full>
          <Txt {...text(ctx, "site_street")} />
        </Field>
        <Field label="Locality">
          <Lookup {...f("site_locality")} options={lookups.locality} listKey="locality" />
        </Field>
        <Field label="Town">
          <Lookup {...f("site_town")} options={lookups.town} listKey="town" />
        </Field>
        <Field label="County">
          <Lookup {...f("site_county")} options={lookups.county} listKey="county" />
        </Field>
        <Field label="Postcode">
          <Txt {...text(ctx, "site_postcode")} mono uppercase />
        </Field>
        <Field label="what3words">
          <Txt {...text(ctx, "site_what_3_words")} mono />
        </Field>
      </StepShell>
    </div>
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
        <Txt {...text(ctx, "window_count")} inputMode="numeric" placeholder="Number of windows" />
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
        <Txt {...text(ctx, "estimated_value")} inputMode="decimal" placeholder="0.00" />
      </Field>
      <Field label="Follow-Up Date">
        <DateField {...date(ctx, "follow_up_date")} />
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
        <DateField {...date(ctx, "quote_date")} />
      </Field>
      <Field label="Quoted Value (£)">
        <Txt {...text(ctx, "gross_value")} inputMode="decimal" placeholder="0.00" />
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
        <Area {...text(ctx, "notes")} rows={6} placeholder="Enquiry details, requirements…" />
      </Field>
    </StepShell>
  );
}

function ReviewStep({
  ctx,
  onEdit,
  pending,
  linked,
  matches,
  onLink,
  conflicts,
  fills,
  onChoose,
}: {
  ctx: Ctx;
  onEdit: (i: number) => void;
  pending: boolean;
  linked: CustomerMatch | null;
  matches: CustomerMatch[];
  onLink: (m: CustomerMatch) => void;
  conflicts: Conflict[];
  fills: string[];
  onChoose: (field: string, choice: "keep" | "new") => void;
}) {
  const { values } = ctx;
  const stage = LEAD_STAGES.find((s) => s.key === values.status);
  const name =
    values.c_customer_type === "commercial" && values.c_company_name
      ? values.c_company_name
      : [values.c_title, values.c_first_name, values.c_last_name].filter(Boolean).join(" ");
  const customerAddress = addressOf(values, "c_");
  const siteAddress = addressOf(values, "site_");
  const siteDiffers = !!siteAddress && siteAddress !== customerAddress;
  // A strong candidate still on screen while creating a NEW customer is the last
  // chance to stop a duplicate — the whole point of matching.
  const duplicates = linked ? [] : matches.filter((m) => m.strength === "strong");

  return (
    <div className="flex flex-col gap-4">
      {duplicates.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#f0d9a8] bg-[#fdf2dc]">
          <div className="px-4 py-2.5 text-[12.5px] font-semibold text-[#b86e00]">
            This looks like a customer you already have. Creating a second record splits
            their history in two.
          </div>
          <ul className="divide-y divide-[#f0d9a8] border-t border-[#f0d9a8] bg-white">
            {duplicates.map((m) => (
              <MatchRow key={m.id} match={m} onLink={() => onLink(m)} />
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-[#e7e7ea] bg-white p-6 shadow-[0_1px_3px_rgba(10,10,10,0.06)]">
        <div className="mb-0.5 font-[family-name:var(--font-inter-tight)] text-[17px] font-bold text-[#0a0a0a]">
          Check and create
        </div>
        <p className="mb-4 text-[12.5px] text-[#71717a]">
          Everything here can be changed on the lead afterwards.
        </p>

        <div className="divide-y divide-[#f4f4f5]">
          <ReviewGroup title="Customer" onEdit={() => onEdit(0)}>
            {linked ? (
              <SumRow label="Customer">
                <span className="inline-flex items-center gap-2">
                  {linked.name}
                  <RefChip className="px-1.5 py-0.5 text-[10.5px]">
                    {customerRef(linked.customerNumber)}
                  </RefChip>
                  <span className="text-[11.5px] font-normal text-[#71717a]">existing customer</span>
                </span>
              </SumRow>
            ) : (
              <SumRow label="Customer">
                <span className="inline-flex items-center gap-2">
                  {name || "—"}
                  <span className="rounded-md bg-[#e7f4ec] px-1.5 py-0.5 text-[10.5px] font-bold text-[#1a7f3e]">
                    NEW
                  </span>
                </span>
              </SumRow>
            )}
            <SumRow label="Contact">
              {join(values.c_mobile, values.c_home_telephone, values.c_email) || "—"}
            </SumRow>
            <SumRow label="Address">{customerAddress || "—"}</SumRow>
            <SumRow label="Received">{fmtDate(values.lead_date) || "Today"}</SumRow>
          </ReviewGroup>

          {linked && (fills.length > 0 || conflicts.length > 0) && (
            <div className="py-3">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
                Their record
              </div>
              {fills.length > 0 && (
                <p className="mb-2 text-[12.5px] text-[#71717a]">
                  <span className="font-semibold text-[#1a7f3e]">Adding</span>{" "}
                  {fills.map((x) => FIELD_LABEL[x] ?? x).join(", ").toLowerCase()} — blank on their
                  record until now.
                </p>
              )}
              {conflicts.map((c) => (
                <ConflictRow key={c.field} conflict={c} onChoose={onChoose} />
              ))}
            </div>
          )}

          {siteDiffers && (
            <ReviewGroup title="Site address" onEdit={() => onEdit(1)}>
              <SumRow label="Work at">{siteAddress}</SumRow>
            </ReviewGroup>
          )}

          <ReviewGroup title="Enquiry" onEdit={() => onEdit(2)}>
            <SumRow label="Source">{join(values.source, values.sub_source) || "—"}</SumRow>
            <SumRow label="Interest">
              {join(values.product_type, values.product_interest_2) || "—"}
            </SumRow>
            {values.window_count && <SumRow label="Windows">{values.window_count}</SumRow>}
          </ReviewGroup>

          <ReviewGroup title="Stage & value" onEdit={() => onEdit(3)}>
            <SumRow label="Stage">{stage?.label ?? humanLabel(values.status)}</SumRow>
            <SumRow label="Priority">{cap(values.priority)}</SumRow>
            <SumRow label="Salesperson">{values.salesman || "—"}</SumRow>
            <SumRow label="Estimated">{money(values.estimated_value)}</SumRow>
            {values.follow_up_date && (
              <SumRow label="Follow-up">{fmtDate(values.follow_up_date)}</SumRow>
            )}
          </ReviewGroup>

          {(values.quote_type || values.quote_date || values.gross_value || values.payment_method) && (
            <ReviewGroup title="Quote" onEdit={() => onEdit(4)}>
              {values.quote_type && <SumRow label="Type">{values.quote_type}</SumRow>}
              {values.quote_date && <SumRow label="Dated">{fmtDate(values.quote_date)}</SumRow>}
              {values.gross_value && <SumRow label="Value">{money(values.gross_value)}</SumRow>}
              {values.payment_method && <SumRow label="Payment">{values.payment_method}</SumRow>}
            </ReviewGroup>
          )}

          {values.notes && (
            <ReviewGroup title="Notes" onEdit={() => onEdit(5)}>
              <SumRow label="Notes">{values.notes}</SumRow>
            </ReviewGroup>
          )}
        </div>

        {/* The ONLY submit button in the wizard — deliberately here and not in the
            top bar, so the click that lands you on Review can't also create. */}
        <div className="mt-5 flex items-center gap-2.5 border-t border-[#f4f4f5] pt-4">
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Creating…" : linked ? "Create lead" : "Create customer & lead"}
          </button>
          <span className="text-[12px] text-[#a1a1aa]">You&rsquo;ll land on the new lead.</span>
        </div>
      </div>
    </div>
  );
}

/**
 * One field where the caller gave something different from what is on file.
 * Neither value is assumed correct — the record is only changed by choosing.
 */
function ConflictRow({
  conflict,
  onChoose,
}: {
  conflict: Conflict;
  onChoose: (field: string, choice: "keep" | "new") => void;
}) {
  return (
    <div className="mb-1.5 rounded-lg border border-[#f0d9a8] bg-[#fdf2dc] px-3 py-2">
      <div className="mb-1.5 text-[12px] font-semibold text-[#b86e00]">
        {FIELD_LABEL[conflict.field] ?? conflict.field} differs from their record
      </div>
      <div className="flex flex-wrap gap-1.5">
        <ChoiceButton
          active={conflict.chosen === "keep"}
          onClick={() => onChoose(conflict.field, "keep")}
          label="Keep on file"
          value={conflict.onRecord}
        />
        <ChoiceButton
          active={conflict.chosen === "new"}
          onClick={() => onChoose(conflict.field, "new")}
          label="Use the new one"
          value={conflict.alternative}
        />
      </div>
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  label,
  value,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  value: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-left transition-colors",
        active
          ? "border-[var(--accent-blue)] bg-white"
          : "border-transparent bg-white/60 hover:border-[#e7e7ea]",
      )}
    >
      <span
        className={cn(
          "block text-[10.5px] font-bold uppercase tracking-[0.05em]",
          active ? "text-[var(--accent-blue)]" : "text-[#a1a1aa]",
        )}
      >
        {label}
      </span>
      <span className="block text-[12.5px] font-medium text-[#3f3f46]">{value}</span>
    </button>
  );
}

// --- Small controls ---------------------------------------------------------
function SegType({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[#e7e7ea] bg-[#fafafa] p-0.5">
      {[
        { v: "residential", label: "Residential" },
        { v: "commercial", label: "Commercial" },
      ].map((o) => (
        <Seg key={o.v} active={value === o.v} onClick={() => onChange(o.v)}>
          {o.label}
        </Seg>
      ))}
    </div>
  );
}

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
function text(ctx: Ctx, key: string) {
  return { value: ctx.values[key] ?? "", onChange: (v: string) => ctx.set(key)(v) };
}

function date(ctx: Ctx, key: string) {
  return { value: ctx.values[key] ?? "", onChange: ctx.set(key) };
}

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function addressOf(values: Values, prefix: string): string {
  const house = [values[`${prefix}house_name`], [values[`${prefix}house_number`], values[`${prefix}street`]].filter(Boolean).join(" ")]
    .filter((p) => p && p.trim())
    .join(", ");
  return [house, values[`${prefix}locality`], values[`${prefix}town`], values[`${prefix}county`], values[`${prefix}postcode`]]
    .filter((p) => p && p.trim())
    .join(", ");
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
