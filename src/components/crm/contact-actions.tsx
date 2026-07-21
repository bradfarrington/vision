"use client";

import { useTransition } from "react";

import {
  addCustomerContact,
  deleteCustomerContact,
  setDefaultContact,
} from "@/app/(app)/customers/actions";
import { Icon } from "./icon";
import { btnSecondary } from "./primitives";

export function AddContactButton({ customerId }: { customerId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void addCustomerContact(customerId))}
      className={btnSecondary}
    >
      <Icon name="plus" size={13} strokeWidth={2.2} /> {pending ? "Adding…" : "Add contact"}
    </button>
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
  return (
    <div className="mt-3 flex items-center gap-3 border-t border-[#f4f4f5] pt-2.5">
      {!isDefault && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => void setDefaultContact(customerId, contactId))}
          className="text-[11.5px] font-semibold text-[var(--accent-blue)] disabled:opacity-50"
        >
          Set as default
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => void deleteCustomerContact(customerId, contactId))}
        className="ml-auto text-[11.5px] font-semibold text-[#d64545] disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}
