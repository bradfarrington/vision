import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and keeps the token
 * cookie current for both Server Components and the browser. Called from the
 * Next.js Proxy (src/proxy.ts — the Next 16 rename of "middleware").
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: revalidate the session here and do NOT run other code between
  // createServerClient and getUser() — it triggers the token refresh. A mistake
  // here causes hard-to-debug random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth gating goes here once /login exists. Until then we let all requests
  // through so the app still renders during the build-out.
  //
  // if (!user && !request.nextUrl.pathname.startsWith("/login")) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = "/login";
  //   return NextResponse.redirect(url);
  // }
  void user;

  // IMPORTANT: return `supabaseResponse` as-is. If you build your own response,
  // copy over supabaseResponse.cookies or sessions will break.
  return supabaseResponse;
}
