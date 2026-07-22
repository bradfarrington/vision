"use client";

import { useActionState } from "react";
import Link from "next/link";

import { createLead, type LeadFormState } from "@/app/(app)/leads/actions";
import type { CustomerOption } from "@/lib/data/customers";
import { LEAD_STAGES } from "@/lib/leads";
import { btnPrimary, btnSecondary } from "./primitives";

const inputClass =
  "w-full rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]";

const SOURCES = ["Referral", "Website", "Checkatrade", "Showroom", "Facebook", "Google", "Repeat customer"];

export function LeadForm({
  customers,
  defaultCustomerId,
  cancelHref,
}: {
  customers: CustomerOption[];
  defaultCustomerId?: string;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(createLead, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <div className="rounded-lg border border-[#f3c7c7] bg-[#fdecec] px-3.5 py-2.5 text-[13px] font-medium text-[#d64545]">
          {state.error}
        </div>
      )}

      <Section title="Lead">
        <Field label="Customer" required full>
          <select
            name="customer_id"
            defaultValue={defaultCustomerId ?? ""}
            required
            className={inputClass}
          >
            <option value="" disabled>
              Choose a customer…
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select name="source" defaultValue="" className={inputClass}>
            <option value="">—</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sub-Source">
          <input name="sub_source" className={inputClass} placeholder="e.g. Neighbour" />
        </Field>
        <Field label="Stage">
          <select name="status" defaultValue="new" className={inputClass}>
            {LEAD_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue="medium" className={inputClass}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>
      </Section>

      <Section title="Interest & value">
        <Field label="Main Product Interest">
          <input name="product_type" className={inputClass} placeholder="e.g. uPVC Casement Windows" />
        </Field>
        <Field label="Second Interest">
          <input name="product_interest_2" className={inputClass} placeholder="e.g. Composite Door" />
        </Field>
        <Field label="Salesperson">
          <input name="salesman" className={inputClass} />
        </Field>
        <Field label="Estimated Value (£)">
          <input name="gross_value" inputMode="decimal" className={inputClass} placeholder="0.00" />
        </Field>
        <Field label="Follow-Up Date">
          <input type="date" name="follow_up_date" className={inputClass} />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Lead Notes" full>
          <textarea name="notes" rows={4} className={`${inputClass} resize-y`} placeholder="Enquiry details, requirements…" />
        </Field>
      </Section>

      <div className="flex items-center gap-2.5">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Creating…" : "Create lead"}
        </button>
        <Link href={cancelHref} className={btnSecondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e7e7ea] bg-white p-[18px] shadow-[0_1px_3px_rgba(10,10,10,0.06)]">
      <div className="mb-3 font-[family-name:var(--font-inter-tight)] text-[15px] font-bold text-[#0a0a0a]">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
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
    <label className={`flex flex-col gap-1.5 ${full ? "col-span-2" : ""}`}>
      <span className="text-[12px] font-medium text-[#52525b]">
        {label}
        {required && <span className="text-[#d64545]"> *</span>}
      </span>
      {children}
    </label>
  );
}
