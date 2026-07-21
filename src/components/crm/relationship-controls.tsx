"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addCustomerRelationship,
  addTenantOption,
  deleteCustomerRelationship,
  deleteTenantOption,
  searchCustomers,
} from "@/app/(app)/customers/actions";
import type { TenantOption } from "@/lib/data/customer-record";
import { cn } from "@/lib/utils";
import { Combo } from "./combo";
import { Icon } from "./icon";
import { btnPrimary, btnSecondary } from "./primitives";

type Found = { id: string; name: string; customerNumber: number | null; town: string | null };

// Async customer search picker for choosing the customer to link.
function CustomerPicker({
  customerId,
  onPick,
  picked,
}: {
  customerId: string;
  onPick: (c: Found | null) => void;
  picked: Found | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      start(async () => setResults(await searchCustomers(query, customerId)));
    }, 200);
    return () => clearTimeout(t);
  }, [query, open, customerId]);

  if (picked) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[13px]">
        <span className="truncate text-[#0a0a0a]">
          {picked.name}
          {picked.customerNumber != null && (
            <span className="ml-1.5 font-mono text-[11px] text-[#a1a1aa]">
              {String(picked.customerNumber).padStart(4, "0")}
            </span>
          )}
        </span>
        <button type="button" onClick={() => onPick(null)} className="text-[12px] font-semibold text-[var(--accent-blue)]">
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder="Search customers by name, town, postcode…"
        className="w-full rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[13px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[#e7e7ea] bg-white p-1 shadow-[0_12px_32px_rgba(10,10,10,0.10)]">
          {pending && results.length === 0 && (
            <div className="px-2.5 py-2 text-[12.5px] text-[#a1a1aa]">Searching…</div>
          )}
          {!pending && results.length === 0 && (
            <div className="px-2.5 py-2 text-[12.5px] text-[#a1a1aa]">No customers found</div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onPick(r);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[var(--accent-tint)]"
            >
              <span className="truncate text-[#3f3f46]">{r.name}</span>
              <span className="shrink-0 text-[11px] text-[#a1a1aa]">{r.town ?? ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RelationshipAdder({
  customerId,
  typeOptions,
}: {
  customerId: string;
  typeOptions: TenantOption[];
}) {
  const [openForm, setOpenForm] = useState(false);
  const [picked, setPicked] = useState<Found | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const comboOptions = typeOptions.map((o) => ({ id: o.id, value: o.label, label: o.label }));

  function submit() {
    setError(null);
    if (!picked) {
      setError("Choose a customer to link.");
      return;
    }
    start(async () => {
      const res = await addCustomerRelationship(customerId, picked.id, type);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setPicked(null);
      setType(null);
      setOpenForm(false);
      router.refresh();
    });
  }

  if (!openForm) {
    return (
      <button type="button" onClick={() => setOpenForm(true)} className={btnSecondary}>
        <Icon name="plus" size={13} strokeWidth={2.2} /> Add relationship
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#e7e7ea] bg-white p-[18px] shadow-[0_1px_3px_rgba(10,10,10,0.06)]">
      <div className="mb-3 font-[family-name:var(--font-inter-tight)] text-[15px] font-bold text-[#0a0a0a]">
        Link a customer
      </div>
      {error && (
        <div className="mb-3 rounded-lg border border-[#f3c7c7] bg-[#fdecec] px-3 py-2 text-[12.5px] font-medium text-[#d64545]">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-[#52525b]">Customer</span>
          <CustomerPicker customerId={customerId} onPick={setPicked} picked={picked} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-[#52525b]">Relationship</span>
          <Combo
            options={comboOptions}
            value={type}
            onChange={setType}
            placeholder="Select a relationship…"
            searchPlaceholder="Search or add a type…"
            addNounLabel="Add"
            onAddNew={(label) => addTenantOption("relationship_type", label)}
            onDelete={(id) => deleteTenantOption(id)}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <button type="button" onClick={submit} disabled={pending} className={btnPrimary}>
          {pending ? "Linking…" : "Link customer"}
        </button>
        <button type="button" onClick={() => setOpenForm(false)} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function RelationshipRemove({
  customerId,
  relationshipId,
  className,
}: {
  customerId: string;
  relationshipId: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deleteCustomerRelationship(customerId, relationshipId);
          router.refresh();
        })
      }
      className={cn("text-[11.5px] font-semibold text-[#d64545] disabled:opacity-50", className)}
    >
      Remove
    </button>
  );
}
