"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addCustomFieldOption,
  deleteCustomFieldOption,
  setCustomFieldValue,
} from "@/app/(app)/customers/actions";
import { cn } from "@/lib/utils";
import { Combo } from "./combo";

// A custom field's value editor. Select-type fields (with options) render the
// tenant-editable dropdown (search + add-new); everything else is inline text.
export function CustomFieldValue({
  customerId,
  definitionId,
  dataType,
  value,
  options,
}: {
  customerId: string;
  definitionId: number;
  dataType: string;
  value: string | null;
  options: string[];
}) {
  const [, start] = useTransition();
  const router = useRouter();

  const isLookup = dataType === "select" || options.length > 0;

  function persist(v: string | null) {
    start(async () => {
      await setCustomFieldValue(customerId, definitionId, v);
      router.refresh();
    });
  }

  if (isLookup) {
    return (
      <Combo
        variant="text"
        options={options.map((o) => ({ id: o, value: o, label: o }))}
        value={value}
        onChange={(v) => persist(v)}
        placeholder="—"
        searchPlaceholder="Search or add…"
        onAddNew={(label) => addCustomFieldOption(definitionId, label)}
        onDelete={(id) => deleteCustomFieldOption(definitionId, id)}
      />
    );
  }

  return <InlineText value={value} onSave={persist} />;
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
