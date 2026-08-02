"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { convertLeadToContract } from "@/app/(app)/contracts/actions";
import { Combo } from "./combo";
import { DatePicker } from "./date-picker";
import { Icon } from "./icon";
import { btnPrimary } from "./primitives";
import { inputClass } from "./wizard";
import type { TenantOption } from "@/lib/data/customer-record";
import type { StaffOption } from "@/lib/data/staff";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Convert to Contract — a DIALOG, not a wizard.
//
// The lead already holds nearly everything a contract needs (customer, site
// address, salesperson, source, value), and all of it carries across on the
// server. So this only asks for what CONVERSION itself decides: the contract
// date, what type of job it is, who's managing the install, and how long it's
// expected to take. A five-step wizard re-collecting what was captured on the
// enquiry would be exactly the dead end the New Lead flow was built to avoid.
// ---------------------------------------------------------------------------

export function ConvertToContractButton({
  leadId,
  leadRef,
  defaultValue,
  defaultContractType,
  contractTypes,
  installManagers,
  alreadyConverted,
  contractId,
}: {
  leadId: string;
  leadRef: string;
  /** The lead's value, pre-filled so the usual case is one click. */
  defaultValue: number | null;
  defaultContractType: string | null;
  contractTypes: TenantOption[];
  installManagers: StaffOption[];
  /** True once a contract exists for this lead — the button becomes a link. */
  alreadyConverted: boolean;
  contractId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [contractDate, setContractDate] = useState<string | null>(new Date().toISOString());
  const [contractType, setContractType] = useState<string | null>(defaultContractType);
  const [manager, setManager] = useState<string | null>(null);
  const [days, setDays] = useState("");
  const [value, setValue] = useState(defaultValue != null ? String(defaultValue) : "");

  // Already converted: the action is to GO to the contract, not to make a second
  // one. Converting twice would split one job's history in two.
  if (alreadyConverted && contractId) {
    return (
      <a href={`/contracts/${contractId}`} className={btnPrimary}>
        View contract <Icon name="arrow-right" size={13} />
      </a>
    );
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await convertLeadToContract(leadId, {
        contractDate,
        contractType,
        installationManager: manager,
        estimatedFittingDays: days,
        grossValue: value,
      });
      if (res.error || !res.contractId) {
        setError(res.error ?? "Could not convert this lead.");
        return;
      }
      setOpen(false);
      router.push(`/contracts/${res.contractId}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${btnPrimary} shadow-[0_4px_12px_rgba(47,125,225,0.25)]`}
      >
        Convert to Contract <Icon name="arrow-right" size={13} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Convert {leadRef} to a contract</DialogTitle>
            <DialogDescription>
              The customer, site address, salesperson, source and value all carry across from the
              lead. Once created, the contract owns its own copy — later edits to the lead
              won&rsquo;t change it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Field label="Contract Date">
              <DatePicker value={contractDate} onChange={setContractDate} />
            </Field>
            <Field label="Contract Type">
              <Combo
                options={toCombo(contractTypes)}
                value={contractType}
                onChange={(v) => setContractType(v || null)}
                placeholder="Select…"
              />
            </Field>
            <Field label="Install Manager">
              <Combo
                options={toCombo(installManagers)}
                value={manager}
                onChange={(v) => setManager(v || null)}
                placeholder="Select…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contract Value">
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className={inputClass}
                />
              </Field>
              <Field label="Est. Fitting Days">
                <input
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  inputMode="decimal"
                  placeholder="1.5"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-[#f3c7c7] bg-[#fdecec] px-3 py-2 text-[12.5px] font-medium text-[#d64545]">
              {error}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-[#d4d4d8] bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#3f3f46]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              // Success green, platform-fixed: this COMMITS the job, the same
              // reasoning as the wizard's Create button. Never the tenant accent.
              className={cn(
                "rounded-lg bg-[#1a7f3e] px-3.5 py-2 text-[12.5px] font-semibold text-white",
                pending && "opacity-60",
              )}
            >
              {pending ? "Converting…" : "Create contract"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// The lookup lists are stored as {id, label}; a Combo option carries the value
// it writes as well. The stored value is the LABEL TEXT (no FK), so legacy and
// free-text entries still display — the same mapping EditableField does.
function toCombo(options: { id: string; label: string }[]) {
  return options.map((o) => ({ id: o.id, value: o.label, label: o.label }));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] font-semibold text-[#3f3f46]">{label}</span>
      {children}
    </label>
  );
}
