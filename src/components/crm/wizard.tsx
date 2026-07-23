"use client";

import Link from "next/link";
import { useState } from "react";

import { Combo } from "./combo";
import { DatePicker } from "./date-picker";
import { Icon } from "./icon";
import { btnPrimary, btnSecondary } from "./primitives";
import { addTenantOption, deleteTenantOption } from "@/app/(app)/customers/actions";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared staged-wizard shell and field primitives, behind New Customer and New
// Lead (and whatever creates a record next).
//
// The pattern each wizard follows — recorded in AGENTS.md under the New
// Customer wizard, and preserved here:
//   - ONE controlled state object; every value also rides as a hidden input so
//     the native form action submits the whole record at once. The visible step
//     UI only edits state, so jumping back and the Review summary work without
//     losing entries.
//   - The final Create action lives IN the Review card, never in the top bar:
//     the last "Continue" click lands on Review, and a reflex second click in
//     the same spot must not create the record before it is read.
//   - Enter is swallowed on every non-textarea field so a keystroke can't
//     submit early.
// Own the steps and the state in your form; this module owns the chrome.
// ---------------------------------------------------------------------------

/** An option list: the stored value IS the label text (no FK). */
export type LookupList = { id: string; label: string }[];

export type WizardStep = { key: string; label: string; optional?: boolean };

/**
 * The wizard chrome: sticky header (heading + Cancel/Back/Continue), the step
 * tracker, and the body. onNext and onStep belong to the form, so it can refuse
 * to leave a step whose required fields are still empty.
 */
export function WizardFrame({
  heading,
  cancelHref,
  steps,
  step,
  onStep,
  onNext,
  error,
  children,
}: {
  heading: string;
  cancelHref: string;
  steps: readonly WizardStep[];
  step: number;
  onStep: (i: number) => void;
  onNext: () => void;
  error?: string;
  children: React.ReactNode;
}) {
  const isReview = step === steps.length - 1;
  return (
    <>
      {/* Fixed top: title, actions, and the step tracker. Stays put while the
          step body scrolls. */}
      <div className="sticky top-0 z-20 -mx-[26px] border-b border-[#e7e7ea] bg-white/95 px-[26px] py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="min-w-0 truncate font-[family-name:var(--font-inter-tight)] text-[22px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
            {heading}
          </h1>
          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <Link href={cancelHref} className={btnSecondary}>
              Cancel
            </Link>
            {step > 0 && (
              <button type="button" onClick={() => onStep(step - 1)} className={btnSecondary}>
                Back
              </button>
            )}
            {/* The final Create action lives in the review card, NOT here — the
                last "Continue" click lands on Review, and a reflex second click in
                the same spot must never create the record before it's read. */}
            {!isReview && (
              <button type="button" onClick={onNext} className={btnPrimary}>
                Continue
                <Icon name="chevron-right" size={13} strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
        <Stepper steps={steps} current={step} onSelect={onStep} />
      </div>

      <div className="mx-auto w-full max-w-3xl py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-[#f3c7c7] bg-[#fdecec] px-3.5 py-2.5 text-[13px] font-medium text-[#d64545]">
            {error}
          </div>
        )}
        {children}
      </div>
    </>
  );
}

/** Swallows Enter outside textareas, so a keystroke can't submit the form early. */
export function swallowEnter(e: React.KeyboardEvent) {
  if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) e.preventDefault();
}

/** Step index state plus a clamped advance. */
export function useWizardStep(count: number) {
  const [step, setStep] = useState(0);
  return { step, setStep, last: count - 1, next: () => setStep((s) => Math.min(s + 1, count - 1)) };
}

function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: readonly WizardStep[];
  current: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-1.5 overflow-x-auto">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(i)}
            className="flex shrink-0 items-center gap-2"
          >
            <span
              className={cn(
                "flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                active
                  ? "bg-[var(--accent-blue)] text-white"
                  : done
                    ? "bg-[var(--accent-tint)] text-[var(--accent-blue)]"
                    : "bg-[#f4f4f5] text-[#a1a1aa]",
              )}
            >
              {done ? <Icon name="check" size={12} strokeWidth={2.6} /> : i + 1}
            </span>
            <span
              className={cn(
                "text-[12.5px] font-semibold transition-colors",
                active ? "text-[#0a0a0a]" : done ? "text-[#52525b]" : "text-[#a1a1aa]",
              )}
            >
              {s.label}
              {s.optional && (
                <span className="ml-1 hidden text-[11px] font-medium text-[#c4c4c8] sm:inline">optional</span>
              )}
            </span>
            {i < steps.length - 1 && <span className="mx-1.5 h-px w-5 shrink-0 bg-[#e7e7ea] sm:w-8" />}
          </button>
        );
      })}
    </div>
  );
}

export const COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

export const inputClass =
  "w-full rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[13px] text-[#0a0a0a] placeholder:text-[#a1a1aa] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]";

export function StepShell({
  title,
  hint,
  children,
  cols = 2,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  cols?: number;
}) {
  return (
    <div className="rounded-xl border border-[#e7e7ea] bg-white p-6 shadow-[0_1px_3px_rgba(10,10,10,0.06)]">
      <div className="mb-0.5 font-[family-name:var(--font-inter-tight)] text-[17px] font-bold text-[#0a0a0a]">
        {title}
      </div>
      {hint && <p className="mb-4 text-[12.5px] text-[#71717a]">{hint}</p>}
      <div className={cn("mt-4 grid gap-x-4 gap-y-3.5", COLS[cols])}>{children}</div>
    </div>
  );
}

export function Field({
  label,
  required,
  full,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  // A <div>, not a <label>: several children are custom button controls (Combo,
  // date picker, segmented tristate), and a <label> would forward stray clicks.
  return (
    <div className={cn("flex flex-col gap-1.5", full && "col-span-full")}>
      <span className="text-[12px] font-medium text-[#52525b]">
        {label}
        {required && <span className="text-[#d64545]"> *</span>}
        {error && <span className="ml-1.5 font-semibold text-[#d64545]">· {error}</span>}
      </span>
      {children}
    </div>
  );
}

export function Txt({
  value,
  onChange,
  mono,
  uppercase,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  uppercase?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputClass, mono && "font-mono", uppercase && "uppercase")}
    />
  );
}

export function Area({
  value,
  onChange,
  rows = 2,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "rows">) {
  return (
    <textarea
      {...rest}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputClass, "resize-y")}
    />
  );
}

function toComboOptions(list?: LookupList) {
  // Stored value IS the label text (no FK), so value === label.
  return (list ?? []).map((o) => ({ id: o.id, value: o.label, label: o.label }));
}

export function Lookup({
  value,
  onChange,
  options,
  listKey,
  onAddNew,
  onDelete,
  placeholder,
  addNounLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options?: LookupList;
  listKey?: string;
  onAddNew?: (label: string) => Promise<{ label?: string; error?: string }>;
  onDelete?: (id: string) => Promise<{ error?: string }>;
  placeholder?: string;
  addNounLabel?: string;
}) {
  return (
    <Combo
      variant="input"
      options={toComboOptions(options)}
      value={value || null}
      onChange={onChange}
      placeholder={placeholder}
      addNounLabel={addNounLabel}
      onAddNew={onAddNew ?? (listKey ? (label) => addTenantOption(listKey, label) : undefined)}
      onDelete={onDelete ?? (listKey ? (id) => deleteTenantOption(id) : undefined)}
    />
  );
}

export function DateField({ value, onChange }: { value: string; onChange: (v: string | null) => void }) {
  return <DatePicker variant="input" value={value || null} onChange={onChange} />;
}

export function Tristate({ value, onChange, danger }: { value: string; onChange: (v: string) => void; danger?: boolean }) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-[#e7e7ea] bg-[#fafafa] p-0.5">
      {[
        { v: "", label: "Not asked" },
        { v: "true", label: "Yes" },
        { v: "false", label: "No" },
      ].map((o) => {
        const active = value === o.v;
        const activeClass = !active
          ? "text-[#a1a1aa] hover:text-[#3f3f46]"
          : o.v === "true"
            ? danger
              ? "bg-[#fdecec] text-[#d64545]"
              : "bg-[#e7f4ec] text-[#1a7f3e]"
            : "bg-white text-[#3f3f46] shadow-[0_1px_2px_rgba(10,10,10,0.08)]";
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={cn("rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors", activeClass)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function TriRow({
  label,
  value,
  onChange,
  danger,
  last,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2", !last && "border-b border-[#f4f4f5]")}>
      <span className="text-[12.5px] font-medium text-[#52525b]">{label}</span>
      <Tristate value={value} onChange={onChange} danger={danger} />
    </div>
  );
}

export function CopyButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent-blue)] bg-[var(--accent-tint)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-blue)] transition-colors hover:bg-[var(--accent-blue)] hover:text-white"
    >
      <Icon name="download" size={12} strokeWidth={2} />
      {children}
    </button>
  );
}

export function ReviewGroup({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="py-3 first:pt-0">
      <div className="mb-1.5 flex items-center gap-2.5">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">{title}</div>
        <button type="button" onClick={onEdit} className="ml-auto text-[12px] font-semibold text-[var(--accent-blue)]">
          Edit →
        </button>
      </div>
      {children}
    </div>
  );
}

export function SumRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1 text-[12.5px]">
      <span className="w-28 shrink-0 text-[#71717a]">{label}</span>
      <span className="min-w-0 flex-1 font-medium text-[#3f3f46]">{children}</span>
    </div>
  );
}

export function tri(label: string, v: string): string | null {
  if (v === "true") return `${label}: Yes`;
  if (v === "false") return `${label}: No`;
  return null;
}
