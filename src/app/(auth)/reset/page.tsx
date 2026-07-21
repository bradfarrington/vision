import { ResetForm } from "./reset-form";

export default function ResetRequestPage() {
  return (
    <>
      <h1 className="font-[family-name:var(--font-inter-tight)] text-[24px] font-bold tracking-[-0.02em] text-foreground">
        Reset your password
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Enter your email and we&rsquo;ll send you a link to set a new password.
      </p>
      <ResetForm />
    </>
  );
}
