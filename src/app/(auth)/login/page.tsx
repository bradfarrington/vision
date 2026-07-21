import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <h1 className="font-[family-name:var(--font-inter-tight)] text-[24px] font-bold tracking-[-0.02em] text-foreground">
        Sign in
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Welcome back. Enter your details to continue.
      </p>
      {error === "invalid_link" ? (
        <p className="mt-4 rounded-md bg-[var(--danger)]/8 px-3 py-2 text-sm text-[var(--danger)]">
          That link has expired or already been used. Request a new one below.
        </p>
      ) : null}
      <LoginForm />
    </>
  );
}
