import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Reads the session from the request cookies so RLS applies: the JWT carries
 * the user's company_id, and Postgres confines every query to that tenant.
 *
 * Must be created per-request (never cached in a module global) because it is
 * bound to the current request's cookies. Always `await` it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component, where cookies are
            // read-only. Safe to ignore: the proxy refreshes the session cookie
            // on every request, so tokens still stay current.
          }
        },
      },
    },
  );
}
