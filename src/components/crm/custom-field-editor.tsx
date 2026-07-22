"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addCustomFieldDefinition,
  addTenantOption,
  deleteCustomFieldDefinition,
  deleteTenantOption,
  setCustomFieldValue,
} from "@/app/(app)/customers/actions";
import { cn } from "@/lib/utils";
import { Combo } from "./combo";
import { useDialogs } from "./dialogs";
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

// A custom field's value editor. Dropdown fields (list_key set) render the same
// tenant_options dropdown as everywhere else; others are inline free text.
export function CustomFieldValue({
  customerId,
  definitionId,
  listKey,
  value,
  options,
}: {
  customerId: string;
  definitionId: number;
  listKey: string | null;
  value: string | null;
  options: { id: string; label: string }[];
}) {
  const [, start] = useTransition();
  const router = useRouter();

  function persist(v: string | null) {
    start(async () => {
      await setCustomFieldValue(customerId, definitionId, v);
      router.refresh();
    });
  }

  if (listKey) {
    return (
      <Combo
        variant="text"
        options={options.map((o) => ({ id: o.id, value: o.label, label: o.label }))}
        value={value}
        onChange={(v) => persist(v || null)}
        placeholder="—"
        searchPlaceholder="Search or add…"
        onAddNew={(label) => addTenantOption(listKey, label)}
        onDelete={(id) => deleteTenantOption(id)}
      />
    );
  }

  return <InlineText value={value} onSave={persist} />;
}

/** Remove a whole question from this tenant's Additional info (answers go too). */
export function CustomFieldRemove({
  definitionId,
  question,
}: {
  definitionId: number;
  question: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { confirm } = useDialogs();
  return (
    <button
      type="button"
      aria-label={`Remove ${question}`}
      title="Remove this field"
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({
          title: `Remove “${question}”?`,
          message:
            "The field disappears from every customer record, along with every answer recorded against it.",
          confirmLabel: "Remove field",
          tone: "danger",
        });
        if (!ok) return;
        start(async () => {
          await deleteCustomFieldDefinition(definitionId);
          router.refresh();
        });
      }}
      className="shrink-0 rounded px-1 text-[12px] text-[#d4d4d8] opacity-0 transition-colors hover:text-[#d64545] focus:opacity-100 disabled:opacity-40 group-hover/row:opacity-100"
    >
      ✕
    </button>
  );
}

// Define a new question without leaving the record. Tenant-scoped: whatever a
// tenant adds here is theirs alone (the standard three are seeded per tenant).
export function AddCustomFieldButton({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [type, setType] = useState<"text" | "select">("text");
  const [values, setValues] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function reset() {
    setQuestion("");
    setType("text");
    setValues([]);
    setDraft("");
    setError(null);
  }

  function addDraft() {
    const v = draft.trim();
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) setValues([...values, v]);
    setDraft("");
  }

  function submit() {
    setError(null);
    // A value typed but not yet committed with Enter still counts.
    const all = draft.trim() && !values.includes(draft.trim()) ? [...values, draft.trim()] : values;
    start(async () => {
      const res = await addCustomFieldDefinition(question, type, type === "select" ? all : []);
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
      <DialogTrigger className={compact ? btnSecondary : btnPrimary}>
        <Icon name="plus" size={13} strokeWidth={2.2} /> Add field
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-inter-tight)] text-[17px] font-bold">
            New additional-info field
          </DialogTitle>
          <DialogDescription>
            Capture something specific to your business. The field appears on every customer record
            — and only your team can see it.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-[#f3c7c7] bg-[#fdecec] px-3 py-2 text-[12.5px] font-medium text-[#d64545]">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#52525b]">Question</span>
            <input
              autoFocus
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Parking on site?"
              className="w-full rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[13px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#52525b]">Answer type</span>
            <div className="flex gap-2">
              {([
                { id: "text", label: "Free text", hint: "Anything typed in" },
                { id: "select", label: "Dropdown", hint: "Pick from your list" },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-left transition-colors",
                    type === t.id
                      ? "border-[var(--accent-blue)] bg-[var(--accent-tint)]"
                      : "border-[#d4d4d8] bg-white hover:border-[#a1a1aa]",
                  )}
                >
                  <span
                    className={cn(
                      "block text-[12.5px] font-semibold",
                      type === t.id ? "text-[var(--accent-active)]" : "text-[#3f3f46]",
                    )}
                  >
                    {t.label}
                  </span>
                  <span className="block text-[11px] text-[#71717a]">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {type === "select" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-[#52525b]">Dropdown values</span>
              {values.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {values.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-tint)] px-2.5 py-1 text-[12px] font-semibold text-[var(--accent-active)]"
                    >
                      {v}
                      <button
                        type="button"
                        aria-label={`Remove ${v}`}
                        onClick={() => setValues(values.filter((x) => x !== v))}
                        className="text-[11px] opacity-60 hover:opacity-100"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addDraft();
                    }
                  }}
                  placeholder="Type a value, press Enter"
                  className="flex-1 rounded-lg border border-[#d4d4d8] bg-white px-3 py-2 text-[13px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
                />
                <button type="button" onClick={addDraft} className={btnSecondary}>
                  Add
                </button>
              </div>
              <span className="text-[11px] text-[#a1a1aa]">
                Staff can still add more values later, straight from the dropdown.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={pending} className={btnPrimary}>
            {pending ? "Adding…" : "Add field"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InlineText({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function commit(next: string) {
    setEditing(false);
    if (next.trim() === (value ?? "").trim()) return;
    onSave(next.trim() || null);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        defaultValue={value ?? ""}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        className="rounded-md border border-[var(--accent-blue)] bg-white px-2 py-1 text-right text-[12.5px] text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "-mx-1 rounded px-1 text-right text-[12.5px] font-medium text-[#3f3f46] transition-colors hover:bg-[var(--accent-tint)]",
        !value && "text-[#a1a1aa]",
      )}
    >
      {value || "—"}
    </button>
  );
}
