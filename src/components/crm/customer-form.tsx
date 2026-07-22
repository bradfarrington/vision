"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { saveCustomer, type CustomerFormState } from "@/app/(app)/customers/actions";
import { cn } from "@/lib/utils";
import { btnPrimary, btnSecondary } from "./primitives";

export type CustomerFormValues = {
  id?: string;
  customer_type?: string | null;
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  home_telephone?: string | null;
  house_name?: string | null;
  house_number?: string | null;
  street?: string | null;
  locality?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
  what_3_words?: string | null;
  notes?: string | null;
};

export function CustomerForm({
  initial = {},
  cancelHref,
  heading,
}: {
  initial?: CustomerFormValues;
  cancelHref: string;
  heading: string;
}) {
  const [state, action, pending] = useActionState<CustomerFormState, FormData>(
    saveCustomer,
    {},
  );
  const [type, setType] = useState(initial.customer_type ?? "residential");
  const isCommercial = type === "commercial";

  return (
    <form action={action} className="flex flex-1 flex-col gap-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      {/* Header — title + right-aligned actions, matching the detail screens */}
      <div className="flex items-center gap-3">
        <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
          {heading}
        </h1>
        <div className="ml-auto flex items-center gap-2.5">
          <Link href={cancelHref} className={btnSecondary}>
            Cancel
          </Link>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : initial.id ? "Save changes" : "Create customer"}
          </button>
        </div>
      </div>

      {state.error && (
        <div className="rounded-lg border border-[#f3c7c7] bg-[#fdecec] px-3.5 py-2.5 text-[13px] font-medium text-[#d64545]">
          {state.error}
        </div>
      )}

      {/* Sections spread across the full panel width */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Section title="Identity">
          <Field label="Customer type">
            <select
              name="customer_type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputClass}
            >
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
          </Field>
          <Field label="Title">
            <input name="title" defaultValue={initial.title ?? ""} className={inputClass} placeholder="Mr / Mrs / Dr" />
          </Field>
          <Field label="First name" required>
            <input name="first_name" defaultValue={initial.first_name ?? ""} required className={inputClass} />
          </Field>
          <Field label="Last name" required>
            <input name="last_name" defaultValue={initial.last_name ?? ""} required className={inputClass} />
          </Field>
          {/* Company name is a commercial-only concept. */}
          {isCommercial && (
            <Field label="Company name" required full>
              <input name="company_name" defaultValue={initial.company_name ?? ""} className={inputClass} />
            </Field>
          )}
        </Section>

        <Section title="Contact">
          <Field label="Mobile">
            <input name="mobile" defaultValue={initial.mobile ?? ""} className={inputClass} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={initial.phone ?? ""} className={inputClass} />
          </Field>
          <Field label="Home telephone">
            <input name="home_telephone" defaultValue={initial.home_telephone ?? ""} className={inputClass} />
          </Field>
          <Field label="Email" full>
            <input type="email" name="email" defaultValue={initial.email ?? ""} className={inputClass} />
          </Field>
        </Section>

        <Section title="Address" className="lg:col-span-2" cols={3}>
          <Field label="House name">
            <input name="house_name" defaultValue={initial.house_name ?? ""} className={inputClass} />
          </Field>
          <Field label="House number">
            <input name="house_number" defaultValue={initial.house_number ?? ""} className={inputClass} />
          </Field>
          <Field label="Street">
            <input name="street" defaultValue={initial.street ?? ""} className={inputClass} />
          </Field>
          <Field label="Locality">
            <input name="locality" defaultValue={initial.locality ?? ""} className={inputClass} />
          </Field>
          <Field label="Town">
            <input name="town" defaultValue={initial.town ?? ""} className={inputClass} />
          </Field>
          <Field label="County">
            <input name="county" defaultValue={initial.county ?? ""} className={inputClass} />
          </Field>
          <Field label="Postcode">
            <input name="postcode" defaultValue={initial.postcode ?? ""} className={`${inputClass} font-mono uppercase`} />
          </Field>
          <Field label="What3words" full>
            <input name="what_3_words" defaultValue={initial.what_3_words ?? ""} className={`${inputClass} font-mono`} placeholder="///plot.gains.slower" />
          </Field>
        </Section>

        <Section title="Notes" className="lg:col-span-2" cols={1}>
          <Field label="Customer notes" full>
            <textarea
              name="notes"
              defaultValue={initial.notes ?? ""}
              rows={4}
              className={`${inputClass} resize-y`}
              placeholder="Access notes, preferences, history…"
            />
          </Field>
        </Section>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]";

const COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

function Section({
  title,
  children,
  className,
  cols = 2,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  cols?: number;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#e7e7ea] bg-white p-[18px] shadow-[0_1px_3px_rgba(10,10,10,0.06)]",
        className,
      )}
    >
      <div className="mb-3 font-[family-name:var(--font-inter-tight)] text-[15px] font-bold text-[#0a0a0a]">
        {title}
      </div>
      <div className={cn("grid gap-x-4 gap-y-3", COLS[cols])}>{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", full && "col-span-full")}>
      <span className="text-[12px] font-medium text-[#52525b]">
        {label}
        {required && <span className="text-[#d64545]"> *</span>}
      </span>
      {children}
    </label>
  );
}
