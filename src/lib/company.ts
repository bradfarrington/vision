import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
};

export type SessionCompany = {
  name: string | null;
  slug: string | null;
  plan: string | null;
  brand_color_1: string | null;
  brand_color_2: string | null;
  logo_url: string | null;
};

export type Session = {
  user: SessionUser;
  company: SessionCompany | null;
};

/**
 * Resolve the signed-in user's profile + their tenant company for the app shell.
 *
 * Both reads are RLS-scoped: the company row is confined to the tenant stamped
 * in the JWT, so the shell can only ever theme itself with the caller's own
 * brand. Returns null when there is no authenticated user (the shell layout
 * redirects to /login in that case).
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: company }] = await Promise.all([
    supabase
      .from("users")
      .select("first_name, last_name, role")
      .eq("id", user.id)
      .single(),
    supabase
      .from("companies")
      .select("name, slug, plan, brand_color_1, brand_color_2, logo_url")
      .maybeSingle(),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      role: profile?.role ?? "staff",
    },
    company: company ?? null,
  };
}

/** Initials for the avatar chip — from name, falling back to email. */
export function userInitials(user: SessionUser): string {
  const first = user.first_name?.trim()?.[0] ?? "";
  const last = user.last_name?.trim()?.[0] ?? "";
  const initials = `${first}${last}`.toUpperCase();
  if (initials) return initials;
  return (user.email?.trim()?.[0] ?? "?").toUpperCase();
}

/** Display name for the user chip — name, falling back to the email local part. */
export function userDisplayName(user: SessionUser): string {
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  if (name) return name;
  return user.email?.split("@")[0] ?? "Account";
}
