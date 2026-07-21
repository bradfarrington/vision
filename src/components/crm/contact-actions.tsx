"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addCustomerContact,
  deleteCustomerContact,
  setDefaultContact,
} from "@/app/(app)/customers/actions";
import { Icon } from "./icon";
import { btnSecondary } from "./primitives";

export function AddContactButton({ customerId }: { customerId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex items-center gap-2.5">
      {error && (
        <span className="max-w-[380px] truncate text-[11.5px] font-medium text-[#d64545]" title={error}>
          {error}
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await addCustomerContact(customerId);
            if (res?.error) setError(res.error);
            else router.refresh();
          });
        }}
        className={btnSecondary}
      >
        <Icon name="plus" size={13} strokeWidth={2.2} /> {pending ? "Adding…" : "Add contact"}
      </button>
    </div>
  );
}

export function ContactCardActions({
  customerId,
  contactId,
  isDefault,
}: {
  customerId: string;
  contactId: string;
  isDefault: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="mt-3 border-t border-[#f4f4f5] pt-2.5">
      <div className="flex items-center gap-3">
        {!isDefault && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setDefaultContact(customerId, contactId))}
            className="text-[11.5px] font-semibold text-[var(--accent-blue)] disabled:opacity-50"
          >
            Set as default
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteCustomerContact(customerId, contactId))}
          className="ml-auto text-[11.5px] font-semibold text-[#d64545] disabled:opacity-50"
        >
          Remove
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-[11px] text-[#d64545]" title={error}>
          {error}
        </p>
      )}
    </div>
  );
}
