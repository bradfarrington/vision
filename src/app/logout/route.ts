import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// A plain GET logout endpoint — visit /logout to end the session and land on
// /login. A always-available fallback to the topbar user-menu sign-out (handy
// when the token needs re-minting, e.g. after enabling the access-token hook).
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
