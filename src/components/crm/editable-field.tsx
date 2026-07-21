"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addTenantOption, deleteTenantOption } from "@/app/(app)/customers/actions";
import { cn } from "@/lib/utils";
import { Combo } from "./combo";
import { DatePicker } from "./date-picker";
import { Pill } from "./primitives";

export type EditableType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "boolean"
  | "lookup";

type SaveAction = (
  id: string,
  field: string,
  value: string | number | boolean | null,
) => Promise<{ error?: string }>;

type Props = {
  id: string;
  field: string;
  value: string | number | boolean | null;
  action: SaveAction;
  type?: EditableType;
  options?: { value: string; label: string }[];
  /** Tenant-editable dropdown options (type="lookup"). */
  lookupOptions?: { id: string; label: string }[];
  /** tenant_options list_key for add-new / delete (type="lookup"). */
  listKey?: string;
  /** Override the lookup add-new handler (e.g. create a staff member). */
  onAddNew?: (label: string) => Promise<{ label?: string; error?: string }>;
  /** Override the lookup option-delete handler. */
  onDeleteOption?: (id: string) => Promise<{ error?: string }>;
  placeholder?: string;
  mono?: boolean;
  /** Show boolean as a red pill when true (e.g. Do-not-contact). */
  booleanDanger?: boolean;
  className?: string;
};

// Click-to-edit field. Text/number/date/textarea open an inline input that
// saves on Enter or blur (Esc cancels); select + boolean save on change. The
// value updates optimistically and reverts if the server rejects it.
export function EditableField({
  id,
  field,
  value,
  action,
  type = "text",
  options,
  lookupOptions,
  listKey,
  onAddNew,
  onDeleteOption,
  placeholder = "—",
  mono,
  booleanDanger,
  className,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [override, setOverride] = useState<{ v: string | number | boolean | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const router = useRouter();

  // Show the optimistic value until the server value catches up to it (no
  // clearing effect needed — derived purely from props/state).
  const current = override && override.v !== value ? override.v : value;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function save(next: string | number | boolean | null) {
    setEditing(false);
    setError(null);
    if (next === value) {
      setOverride(null);
      return;
    }
    setOverride({ v: next });
    startTransition(async () => {
      const res = await action(id, field, next);
      if (res?.error) {
        setError(res.error);
        setOverride(null);
      } else {
        // Server-action revalidation doesn't always re-render the client tree
        // here, so force a refresh to pull the saved value.
        router.refresh();
      }
    });
  }

  // --- lookup: a tenant-editable searchable dropdown -----------------------
  if (type === "lookup") {
    return (
      <Combo
        variant="text"
        mono={mono}
        className={className}
        options={(lookupOptions ?? []).map((o) => ({ id: o.id, value: o.label, label: o.label }))}
        value={(current as string) ?? null}
        onChange={(v) => save(v)}
        placeholder={placeholder}
        searchPlaceholder="Search or add…"
        onAddNew={onAddNew ?? (listKey ? (label) => addTenantOption(listKey, label) : undefined)}
        onDelete={onDeleteOption ?? (listKey ? (id) => deleteTenantOption(id) : undefined)}
      />
    );
  }

  // --- date: custom accent-themed picker -----------------------------------
  if (type === "date") {
    return (
      <DatePicker
        variant="text"
        className={className}
        value={(current as string) ?? null}
        onChange={(v) => save(v)}
        placeholder={placeholder}
      />
    );
  }

  // --- boolean: a toggle pill, no edit mode --------------------------------
  if (type === "boolean") {
    const on = !!current;
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => save(!on)}
        className={cn("transition-opacity", pending && "opacity-50", className)}
        title="Click to toggle"
      >
        {on ? (
          <Pill tone={booleanDanger ? "danger" : "success"}>Yes</Pill>
        ) : (
          <span className="text-[#a1a1aa] hover:text-[#71717a]">No</span>
        )}
      </button>
    );
  }

  // --- editing mode --------------------------------------------------------
  if (editing) {
    const commonCls =
      "rounded-md border border-[var(--accent-blue)] bg-white px-2 py-1 text-[12.5px] text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]";

    if (type === "select") {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          defaultValue={(current as string) ?? ""}
          onChange={(e) => save(e.target.value || null)}
          onBlur={() => setEditing(false)}
          className={cn(commonCls, className)}
        >
          <option value="">—</option>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }

    if (type === "textarea") {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          defaultValue={(current as string) ?? ""}
          rows={3}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
          className={cn(commonCls, "w-full resize-y text-left", className)}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        inputMode={type === "number" ? "decimal" : undefined}
        defaultValue={(current as string | number) ?? ""}
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        className={cn(commonCls, "text-right", mono && "font-mono", className)}
      />
    );
  }

  // --- read mode -----------------------------------------------------------
  const display = formatDisplay(current, type, options);
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={error ?? "Click to edit"}
      className={cn(
        "-mx-1 rounded px-1 text-right transition-colors hover:bg-[var(--accent-tint)]",
        pending && "opacity-50",
        error && "text-[#d64545]",
        mono && "font-mono",
        className,
      )}
    >
      {display || <span className="text-[#a1a1aa]">{placeholder}</span>}
    </button>
  );
}

function formatDisplay(
  v: string | number | boolean | null,
  type: EditableType,
  options?: { value: string; label: string }[],
): string {
  if (v === null || v === undefined || v === "") return "";
  if (type === "select" && options) {
    return options.find((o) => o.value === v)?.label ?? String(v);
  }
  if (type === "date") {
    const d = new Date(v as string);
    return Number.isNaN(d.getTime())
      ? String(v)
      : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  return String(v);
}
