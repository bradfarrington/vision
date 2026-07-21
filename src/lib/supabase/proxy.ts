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

  // Auth gate. Public paths: the sign-in and reset screens, and the Supabase
  // email-link handler under /auth. Everything else requires a session.
  const path = request.nextUrl.pathname;
  const isPublicPath =
    path === "/login" ||
    path.startsWith("/reset") ||
    path.startsWith("/auth");

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Already signed in? Skip the sign-in screen.
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: return `supabaseResponse` as-is. If you build your own response,
  // copy over supabaseResponse.cookies or sessions will break.
  return supabaseResponse;
}
