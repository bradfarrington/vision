import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// TEMPORARY diagnostic — visit /whoami to see exactly what your session token
// carries. Delete this route once the tenant claim is confirmed working.
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Decode the access-token payload — this is what Postgres RLS sees via
  // auth.jwt(). The company_id claim is added by custom_access_token_hook.
  let jwtClaims: Record<string, unknown> | null = null;
  if (session?.access_token) {
    try {
      const payload = session.access_token.split(".")[1];
      jwtClaims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      jwtClaims = { error: "could not decode token" };
    }
  }

  // What RLS actually resolves the tenant to (null → the hook isn't stamping it).
  const { data: cid } = await supabase.rpc("current_company_id");

  // RLS-scoped count of customers the caller can see.
  const { count, error: countError } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true });

  return NextResponse.json(
    {
      signedInAs: user?.email ?? null,
      userId: user?.id ?? null,
      getUser_app_metadata: user?.app_metadata ?? null,
      JWT_app_metadata: (jwtClaims?.app_metadata as unknown) ?? null,
      current_company_id_rpc: cid ?? null,
      visible_customers: count ?? null,
      customers_error: countError?.message ?? null,
    },
    { status: 200 },
  );
}
