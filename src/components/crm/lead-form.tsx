"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createLead, type LeadFormState } from "@/app/(app)/leads/actions";
import { addSalesStaff, deleteSalesStaff } from "@/app/(app)/customers/actions";
import type { CustomerMatch, MatchCriteria } from "@/lib/data/customer-match";
import { LEAD_STAGES, customerRef } from "@/lib/leads";
import { humanLabel } from "@/lib/format";
import { Combo } from "./combo";
import { TimePicker } from "./time-picker";
import { CustomerMatchPanel, MatchRow, useCustomerMatches } from "./customer-match";
import { Icon } from "./icon";
import { btnSecondary, RefChip } from "./primitives";
import { clearSectionPath, saveSectionPath } from "./view-state";
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
  { key: "appointment", label: "Appointment", optional: true },
  { key: "quote", label: "Quote", optional: true },
  { key: "notes", label: "Notes", optional: true },
  { key: "review", label: "Review" },
];

// A lead can carry one or more appointments (a sales call, a survey, a
// measure-up…), booked here and written to public.appointments on create. Held
// as a structured array — not flat `Values` — and serialised into one hidden
// input for the native form submit.
type Appt = {
  type: string;
  date: string;
  time: string;
  duration: string;
  assigned_to: string;
  notes: string;
};
const emptyAppt = (): Appt => ({ type: "", date: "", time: "", duration: "", assigned_to: "", notes: "" });
/** An appointment is only bookable once it has a date — the rest is optional. */
const apptHasContent = (a: Appt) => !!a.date || !!a.type.trim() || !!a.notes.trim();

// --- Draft persistence ------------------------------------------------------
// The wizard survives leaving and coming back (e.g. to check the diary): the
// whole draft is mirrored to sessionStorage, and while a draft exists the Leads
// sidebar resumes /leads/new instead of the list (see § the sidebar RESUMES).
// This deliberately overrides the "…/new is skipped" rule for THIS wizard —
// losing a half-filled capture is worse than resuming an empty form ever was.
const DRAFT_KEY = "leaddraft:new-lead";
const LEADS_SECTION = "/leads";
const NEW_LEAD_PATH = "/leads/new";

type Draft = {
  values: Values;
  linked: CustomerMatch | null;
  typed: Values | null;
  step: number;
  appointments: Appt[];
};

function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function saveDraft(d: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable — degrade to no persistence */
  }
}
function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable */
  }
}
/** A signature of the parts a draft is worth persisting for — compared against a
 *  fresh baseline so an untouched wizard leaves no trace (and never resumes). */
function draftSig(values: Values, linked: CustomerMatch | null, step: number, appts: Appt[]) {
  return JSON.stringify({ v: values, l: linked?.id ?? null, s: step, a: appts });
}

function seed(linked: CustomerMatch | null): Values {
  const v: Values = {};
  for (const k of ALL_KEYS) v[k] = "";
  v.status = "new";
  v.priority = "medium";
  v.c_customer_type = "residential";
  v.lead_date = todayISO(); // Date Received defaults to today (backdatable if entered late)
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
  const router = useRouter();
  const [state, action, pending] = useActionState<LeadFormState, FormData>(createLead, {});
  const [values, setValues] = useState<Values>(() => seed(initialLinked));
  const [linked, setLinked] = useState<CustomerMatch | null>(initialLinked);
  // What was typed before linking, so "Not them" gives it back and a conflict can
  // offer the alternative rather than losing it.
  const [typed, setTyped] = useState<Values | null>(null);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);

  const set = (k: string) => (val: string | null) => setValues((s) => ({ ...s, [k]: val ?? "" }));
  const f = (k: string) => ({ value: values[k] ?? "", onChange: set(k) });
  const ctx: Ctx = { values, set, f, lookups, salesStaff };

  // --- Draft persistence: restore on mount, mirror on change ----------------
  // Restore runs once, before the mirror effect is allowed to touch storage, so
  // the mirror can't clear the draft while the restored state is still landing.
  const baseline = useMemo(() => draftSig(seed(initialLinked), initialLinked, 0, []), [initialLinked]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    // A deep link ("New lead" for THIS customer) is an explicit intent that wins
    // over any stale draft; otherwise resume where we left off.
    if (!initialLinked) {
      const d = loadDraft();
      if (d) {
        setValues(d.values);
        setLinked(d.linked ?? null);
        setTyped(d.typed ?? null);
        setStep(typeof d.step === "number" ? d.step : 0);
        setAppointments(Array.isArray(d.appointments) ? d.appointments : []);
      }
    }
    setHydrated(true);
  }, [hydrated, initialLinked]);

  useEffect(() => {
    if (!hydrated) return;
    const dirty = draftSig(values, linked, step, appointments) !== baseline;
    if (dirty) {
      saveDraft({ values, linked, typed, step, appointments });
      // While a draft is in flight, the Leads sidebar item resumes the wizard.
      saveSectionPath(LEADS_SECTION, NEW_LEAD_PATH);
    } else {
      clearDraft();
      clearSectionPath(LEADS_SECTION, NEW_LEAD_PATH);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, values, linked, typed, step, appointments, baseline]);

  // On a successful create the action returns the new lead's id (rather than
  // redirecting server-side) so we get a definite client moment to drop the
  // draft before navigating — otherwise a stale draft would resurrect the
  // already-created lead next time the wizard opened.
  useEffect(() => {
    if (!state.leadId) return;
    clearDraft();
    clearSectionPath(LEADS_SECTION, NEW_LEAD_PATH);
    router.push(`/leads/${state.leadId}`);
  }, [state.leadId, router]);

  function discardDraft() {
    clearDraft();
    clearSectionPath(LEADS_SECTION, NEW_LEAD_PATH);
  }

  const addAppt = () => setAppointments((a) => [...a, emptyAppt()]);
  const updateAppt = (i: number, key: keyof Appt, val: string) =>
    setAppointments((a) => a.map((x, j) => (j === i ? { ...x, [key]: val } : x)));
  const removeAppt = (i: number) => setAppointments((a) => a.filter((_, j) => j !== i));

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
      <input
        type="hidden"
        name="appointments"
        value={JSON.stringify(appointments.filter(apptHasContent))}
      />

      <WizardFrame
        heading={heading}
        cancelHref={cancelHref}
        steps={STEPS}
        step={step}
        onStep={goTo}
        onNext={goNext}
        onCancel={discardDraft}
        error={state.error}
        submitLabel={linked ? "Create lead" : "Create customer & lead"}
        pending={pending}
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
        {step === 4 && (
          <AppointmentStep
            ctx={ctx}
            appointments={appointments}
            onAdd={addAppt}
            onUpdate={updateAppt}
            onRemove={removeAppt}
          />
        )}
        {step === 5 && <QuoteStep ctx={ctx} />}
        {step === 6 && <NotesStep ctx={ctx} />}
        {step === 7 && (
          <ReviewStep
            ctx={ctx}
            onEdit={setStep}
            linked={linked}
            appointments={appointments}
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

function AppointmentStep({
  ctx,
  appointments,
  onAdd,
  onUpdate,
  onRemove,
}: {
  ctx: Ctx;
  appointments: Appt[];
  onAdd: () => void;
  onUpdate: (i: number, key: keyof Appt, val: string) => void;
  onRemove: (i: number) => void;
}) {
  const { lookups, salesStaff } = ctx;
  return (
    <div className="rounded-xl border border-[#e7e7ea] bg-white p-6 shadow-[0_1px_3px_rgba(10,10,10,0.06)]">
      <div className="mb-0.5 font-[family-name:var(--font-inter-tight)] text-[17px] font-bold text-[#0a0a0a]">
        Book an appointment
      </div>
      <p className="mb-4 text-[12.5px] text-[#71717a]">
        A sales call, survey or measure-up — add as many as you need, or skip and book later from the lead.
      </p>

      {/* Availability placeholder — the diary isn't built yet. Once it is, open
          slots for the team will render here (see § New Lead wizard). */}
      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-dashed border-[#d4d4d8] bg-[#fafafa] px-3.5 py-3 text-[12.5px] text-[#71717a]">
        <Icon name="calendar" size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#a1a1aa]" />
        <span>
          <span className="font-semibold text-[#52525b]">Live availability coming soon.</span> Once
          the diary is set up, your team&rsquo;s open slots will show here so you can book straight
          into a free time.
        </span>
      </div>

      {appointments.length > 0 && (
        <div className="flex flex-col gap-3">
          {appointments.map((a, i) => (
            <ApptCard
              key={i}
              index={i}
              appt={a}
              lookups={lookups}
              salesStaff={salesStaff}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      <button type="button" onClick={onAdd} className={cn(btnSecondary, appointments.length > 0 && "mt-3")}>
        <Icon name="plus" size={14} strokeWidth={2} />
        {appointments.length > 0 ? "Add another appointment" : "Add appointment"}
      </button>
    </div>
  );
}

function ApptCard({
  index,
  appt,
  lookups,
  salesStaff,
  onUpdate,
  onRemove,
}: {
  index: number;
  appt: Appt;
  lookups: LeadLookups;
  salesStaff: LookupList;
  onUpdate: (i: number, key: keyof Appt, val: string) => void;
  onRemove: (i: number) => void;
}) {
  const upd = (key: keyof Appt) => (v: string | null) => onUpdate(index, key, v ?? "");
  return (
    <div className="rounded-lg border border-[#e7e7ea] bg-[#fafafa] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#71717a]">
          Appointment {index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-[#a1a1aa] transition-colors hover:text-[#d64545]"
          aria-label={`Remove appointment ${index + 1}`}
        >
          <Icon name="trash" size={15} strokeWidth={1.75} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
        <Field label="Type">
          <Lookup
            value={appt.type}
            onChange={upd("type")}
            options={lookups.appointment_type}
            listKey="appointment_type"
            placeholder="e.g. Sales call"
          />
        </Field>
        <Field label="Assigned To">
          <Lookup
            value={appt.assigned_to}
            onChange={upd("assigned_to")}
            options={salesStaff}
            onAddNew={addSalesStaff}
            onDelete={deleteSalesStaff}
            placeholder="Who's attending?"
            addNounLabel="person"
          />
        </Field>
        <Field label="Date">
          <DateField value={appt.date} onChange={upd("date")} />
        </Field>
        <Field label="Time">
          {/* The shared TimePicker, offering the DIARY's own half-hour slots —
              a booking at 07:17 would render between two grid rows and could
              never be picked from the grid again. */}
          <TimePicker
            value={appt.time || null}
            onChange={(v: string | null) => onUpdate(index, "time", v ?? "")}
          />
        </Field>
        <Field label="Duration (min)">
          <Txt
            value={appt.duration}
            onChange={(v) => onUpdate(index, "duration", v)}
            inputMode="numeric"
            placeholder="60"
          />
        </Field>
        <Field label="Notes" full>
          <Area
            value={appt.notes}
            onChange={(v) => onUpdate(index, "notes", v)}
            rows={2}
            placeholder="Anything the attendee should know…"
          />
        </Field>
      </div>
    </div>
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
  linked,
  appointments,
  matches,
  onLink,
  conflicts,
  fills,
  onChoose,
}: {
  ctx: Ctx;
  onEdit: (i: number) => void;
  linked: CustomerMatch | null;
  appointments: Appt[];
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

          {appointments.some(apptHasContent) && (
            <ReviewGroup title="Appointments" onEdit={() => onEdit(4)}>
              {appointments.filter(apptHasContent).map((a, i) => (
                <SumRow key={i} label={a.type || "Appointment"}>
                  {[
                    a.date ? fmtDate(a.date) : "No date",
                    a.time || null,
                    a.assigned_to || null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </SumRow>
              ))}
            </ReviewGroup>
          )}

          {(values.quote_type || values.quote_date || values.gross_value || values.payment_method) && (
            <ReviewGroup title="Quote" onEdit={() => onEdit(5)}>
              {values.quote_type && <SumRow label="Type">{values.quote_type}</SumRow>}
              {values.quote_date && <SumRow label="Dated">{fmtDate(values.quote_date)}</SumRow>}
              {values.gross_value && <SumRow label="Value">{money(values.gross_value)}</SumRow>}
              {values.payment_method && <SumRow label="Payment">{values.payment_method}</SumRow>}
            </ReviewGroup>
          )}

          {values.notes && (
            <ReviewGroup title="Notes" onEdit={() => onEdit(6)}>
              <SumRow label="Notes">{values.notes}</SumRow>
            </ReviewGroup>
          )}
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

// Stage + Priority are fixed enum lists (not tenant-editable), so they use the
// custom Combo dropdown with static options and no add/remove. Both are required
// and seeded with a default, so they're not clearable — the value stored is the
// enum key (e.g. "survey_booked"), the label is what's shown.
const STAGE_OPTIONS = LEAD_STAGES.map((s) => ({ value: s.key, label: s.label }));
const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function SegStage({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Combo
      variant="input"
      options={STAGE_OPTIONS}
      value={value || null}
      onChange={onChange}
      clearable={false}
      placeholder="Select a stage"
    />
  );
}

function SegPriority({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Combo
      variant="input"
      options={PRIORITY_OPTIONS}
      value={value || null}
      onChange={onChange}
      clearable={false}
      placeholder="Select a priority"
    />
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

/** Today as a local YYYY-MM-DD, matching DatePicker's value format. */
function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
