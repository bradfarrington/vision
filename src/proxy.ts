import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js Proxy (formerly "middleware", renamed in Next 16). Runs on every
// matched request before rendering; here it refreshes the Supabase session.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico and common image assets
     * - pdf.worker.min.mjs — pdf.js fetches its worker from /public, and a
     *   session redirect would hand it HTML instead of a script.
     * Adjust as needed; auth checks must also live in Server Actions/Components,
     * not only here (see Next 16 proxy docs on Server Function coverage).
     */
    "/((?!_next/static|_next/image|favicon.ico|pdf\\.worker\\.min\\.mjs|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
