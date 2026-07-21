"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addCustomerRelationship,
  addRelationshipType,
  deleteCustomerRelationship,
  deleteRelationshipType,
  searchCustomers,
  setRelationshipLabels,
} from "@/app/(app)/customers/actions";
import type { RelationshipType } from "@/lib/data/customer-record";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { btnPrimary, btnSecondary } from "./primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Found = { id: string; name: string; customerNumber: number | null; town: string | null };

// Flatten relationship-type pairs into the directional phrasings shown from one
// customer's perspective. A symmetric type yields one; an asymmetric pair
// yields both (e.g. "Referred" and "Referred by").
type DirOption = { key: string; label: string; thisSide: string; otherSide: string; typeId: number };
function toDirOptions(types: RelationshipType[]): DirOption[] {
  const out: DirOption[] = [];
  for (const t of types) {
    if (t.forwardLabel === t.inverseLabel) {
      out.push({ key: `${t.id}:s`, label: t.forwardLabel, thisSide: t.forwardLabel, otherSide: t.inverseLabel, typeId: t.id });
    } else {
      out.push({ key: `${t.id}:f`, label: t.forwardLabel, thisSide: t.forwardLabel, otherSide: t.inverseLabel, typeId: t.id });
      out.push({ key: `${t.id}:i`, label: t.inverseLabel, thisSide: t.inverseLabel, otherSide: t.forwardLabel, typeId: t.id });
    }
  }
  return out;
}

// The directional relationship-type dropdown: search, pick a phrasing, or add a
// new pair (this-side + reverse wording). Accent-themed.
function RelationshipTypeSelect({
  types,
  value,
  onChange,
  className,
  variant = "input",
}: {
  types: RelationshipType[];
  value: string | null;
  onChange: (thisSide: string, otherSide: string) => void;
  className?: string;
  variant?: "input" | "pill";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newFwd, setNewFwd] = useState("");
  const [newInv, setNewInv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const options = toDirOptions(types);
  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q));

  function choose(o: DirOption) {
    onChange(o.thisSide, o.otherSide);
    setOpen(false);
    setQuery("");
  }

  function saveNew() {
    const fwd = newFwd.trim();
    if (!fwd) return;
    setError(null);
    start(async () => {
      const res = await addRelationshipType(fwd, newInv);
      if (res?.error) {
        setError(res.error);
        return;
      }
      onChange(res.forwardLabel ?? fwd, res.inverseLabel ?? fwd);
      router.refresh();
      setAdding(false);
      setNewFwd("");
      setNewInv("");
      setOpen(false);
    });
  }

  return (
    <div ref={ref} className={cn("relative", variant === "pill" ? "inline-block" : "", className)}>
      {variant === "pill" ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-tint)] px-2.5 py-1 text-[12px] font-semibold text-[var(--accent-active)] transition-[filter] hover:brightness-95"
        >
          {value ?? "Set type"}
          <Icon name="chevron-down" size={11} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-left text-[13px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
        >
          <span className={cn("flex-1 truncate", !value && "text-[#a1a1aa]")}>{value ?? "Set type…"}</span>
          <Icon name="chevron-down" size={13} className="text-[#71717a]" />
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-[260px] overflow-hidden rounded-lg border border-[#e7e7ea] bg-white shadow-[0_12px_32px_rgba(10,10,10,0.10),0_4px_8px_rgba(10,10,10,0.05)]">
          {adding ? (
            <div className="flex flex-col gap-2 p-3">
              <div className="text-[12px] font-semibold text-[#0a0a0a]">New relationship type</div>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[#71717a]">This side reads</span>
                <input
                  autoFocus
                  value={newFwd}
                  onChange={(e) => setNewFwd(e.target.value)}
                  placeholder="e.g. Referred by"
                  className="rounded-md border border-[#d4d4d8] px-2.5 py-1.5 text-[12.5px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[#71717a]">Other side reads (optional)</span>
                <input
                  value={newInv}
                  onChange={(e) => setNewInv(e.target.value)}
                  placeholder="e.g. Referred"
                  className="rounded-md border border-[#d4d4d8] px-2.5 py-1.5 text-[12.5px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
                />
              </label>
              {error && <div className="text-[11px] font-medium text-[#d64545]">{error}</div>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={saveNew}
                  className="rounded-md bg-[var(--accent-blue)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save type"}
                </button>
                <button type="button" onClick={() => setAdding(false)} className="text-[12px] font-semibold text-[#71717a]">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-[#f4f4f5] p-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search relationship types…"
                  className="w-full rounded-md border border-[#d4d4d8] px-2.5 py-1.5 text-[12.5px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
                />
              </div>
              <div className="max-h-56 overflow-y-auto p-1">
                {filtered.map((o) => (
                  <div key={o.key} className="group flex items-center rounded-md hover:bg-[var(--accent-tint)]">
                    <button
                      type="button"
                      onClick={() => choose(o)}
                      className={cn(
                        "flex-1 px-2.5 py-1.5 text-left text-[12.5px]",
                        o.thisSide === value ? "font-semibold text-[var(--accent-active)]" : "text-[#3f3f46]",
                      )}
                    >
                      {o.label}
                      {o.thisSide !== o.otherSide && (
                        <span className="ml-1.5 text-[10.5px] text-[#a1a1aa]">↔ {o.otherSide}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${o.label}`}
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          await deleteRelationshipType(o.typeId);
                          router.refresh();
                        })
                      }
                      className="mr-1 px-1.5 text-[12px] text-[#a1a1aa] opacity-0 hover:text-[#d64545] group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="px-2.5 py-2 text-[12.5px] text-[#a1a1aa]">No matches</div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAdding(true);
                    setNewFwd(query.trim());
                  }}
                  className="mt-1 flex w-full items-center gap-1.5 rounded-md border-t border-[#f4f4f5] px-2.5 py-2 text-left text-[12.5px] font-semibold text-[var(--accent-blue)] hover:bg-[var(--accent-tint)]"
                >
                  <Icon name="plus" size={12} strokeWidth={2.2} /> Add a relationship type…
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Async customer search picker.
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
  types,
}: {
  customerId: string;
  types: RelationshipType[];
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Found | null>(null);
  const [thisSide, setThisSide] = useState<string | null>(null);
  const [otherSide, setOtherSide] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function reset() {
    setPicked(null);
    setThisSide(null);
    setOtherSide(null);
    setNote("");
    setError(null);
  }

  function submit() {
    setError(null);
    if (!picked) {
      setError("Choose a customer to link.");
      return;
    }
    start(async () => {
      const res = await addCustomerRelationship(customerId, picked.id, thisSide, otherSide, note || null);
      if (res?.error) {
        setError(res.error);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o: boolean) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger className={btnSecondary}>
        <Icon name="plus" size={13} strokeWidth={2.2} /> Add relationship
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-inter-tight)] text-[17px] font-bold">
            Link a customer
          </DialogTitle>
          <DialogDescription>
            Connect this customer to another record. The relationship reads correctly from both
            sides — pick how it reads here and the reverse is stored automatically.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-[#f3c7c7] bg-[#fdecec] px-3 py-2 text-[12.5px] font-medium text-[#d64545]">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#52525b]">Customer</span>
            <CustomerPicker customerId={customerId} onPick={setPicked} picked={picked} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#52525b]">
              {picked ? `${picked.name} is the…` : "Relationship"}{" "}
              {thisSide && otherSide && thisSide !== otherSide && (
                <span className="font-normal text-[#71717a]">
                  (on {picked?.name ?? "their"} record it reads “{otherSide}”)
                </span>
              )}
            </span>
            <RelationshipTypeSelect
              types={types}
              value={thisSide}
              onChange={(a, b) => {
                setThisSide(a);
                setOtherSide(b);
              }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#52525b]">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. referred us to the neighbours at no. 12"
              className="w-full rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[13px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
            />
          </label>
        </div>

        <DialogFooter>
          <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={pending} className={btnPrimary}>
            {pending ? "Linking…" : "Link customer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inline type editor on a relationship card — persists from the viewer's side.
export function RelationshipTypeEditor({
  relationshipId,
  viewerIsA,
  value,
  types,
  className,
  variant = "input",
}: {
  relationshipId: string;
  viewerIsA: boolean;
  value: string | null;
  types: RelationshipType[];
  className?: string;
  variant?: "input" | "pill";
}) {
  const [, start] = useTransition();
  const router = useRouter();
  return (
    <RelationshipTypeSelect
      variant={variant}
      className={className}
      types={types}
      value={value}
      onChange={(a, b) => {
        start(async () => {
          await setRelationshipLabels(relationshipId, viewerIsA, a, b);
          router.refresh();
        });
      }}
    />
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
