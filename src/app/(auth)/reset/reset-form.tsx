"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestReset, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    requestReset,
    {},
  );

  if (state.message) {
    return (
      <div className="mt-6 space-y-4">
        <p className="rounded-md bg-[var(--success)]/8 px-3 py-2.5 text-sm text-[var(--success)]">
          {state.message}
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-[var(--accent-blue)] hover:text-[var(--accent-hover)]"
        >
          &larr; Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.co.uk"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-[var(--danger)]">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>

      <Link
        href="/login"
        className="block text-center text-sm font-medium text-[var(--accent-blue)] hover:text-[var(--accent-hover)]"
      >
        &larr; Back to sign in
      </Link>
    </form>
  );
}
