import { UpdatePasswordForm } from "./update-form";

export default function ResetUpdatePage() {
  return (
    <>
      <h1 className="font-[family-name:var(--font-inter-tight)] text-[24px] font-bold tracking-[-0.02em] text-foreground">
        Set a new password
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Choose a new password for your account.
      </p>
      <UpdatePasswordForm />
    </>
  );
}
