import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./(auth)/actions";
import { Button } from "@/components/ui/button";

// Temporary authenticated landing — proves the full loop end to end:
// login -> session -> RLS-scoped reads. Replaced by the real app shell +
// dashboard in the next phase.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Both reads are RLS-scoped to the signed-in user's tenant.
  const { data: profile } = await supabase
    .from("users")
    .select("first_name, last_name, role")
    .eq("id", user.id)
    .single();

  // Note: entitlement columns (plan, seat_limit…) appear here after the
  // 090300 migration is pushed and types are regenerated.
  const { data: company } = await supabase
    .from("companies")
    .select("name, slug")
    .maybeSingle();

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[var(--canvas)] px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-[var(--hairline)] bg-card p-8 shadow-sm">
        <h1 className="font-[family-name:var(--font-inter-tight)] text-[24px] font-bold tracking-[-0.02em] text-foreground">
          You&rsquo;re signed in
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          The app shell and dashboard land here next.
        </p>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between border-b border-[var(--hairline)] pb-3">
            <dt className="text-[var(--text-muted)]">Signed in as</dt>
            <dd className="font-medium text-foreground">{user.email}</dd>
          </div>
          <div className="flex justify-between border-b border-[var(--hairline)] pb-3">
            <dt className="text-[var(--text-muted)]">Name</dt>
            <dd className="font-medium text-foreground">
              {profile
                ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                  "—"
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between border-b border-[var(--hairline)] pb-3">
            <dt className="text-[var(--text-muted)]">Role</dt>
            <dd className="font-medium text-foreground">
              {profile?.role ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-muted)]">Company (via RLS)</dt>
            <dd className="font-medium text-foreground">
              {company?.name ?? "—"}
            </dd>
          </div>
        </dl>

        <form action={signOut} className="mt-8">
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
