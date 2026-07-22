import { redirect } from "next/navigation";

import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import {
  getSession,
  userDisplayName,
  userInitials,
} from "@/lib/company";
import { tenantThemeVars } from "@/lib/theme";
import { DialogsProvider } from "@/components/crm/dialogs";
import { ScreenTooSmall } from "@/components/app-shell/screen-too-small";

// Authenticated app shell: grey canvas, ~62px topbar, 76px icon rail and a
// white rounded content panel — matching the dashboard frame in the design
// handoff. The tenant accent is derived from the company row and applied as
// CSS custom properties on the shell root, so every child rebrands from here.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { user, company } = session;

  return (
    // DialogsProvider sits inside the themed root so the app's confirm/alert
    // dialogs pick up the tenant accent variables (see components/crm/dialogs).
    <div
      style={tenantThemeVars(company)}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f4f4f5]"
    >
      {/* Phone tier gets the "too small" screen instead of the shell — see the
          component for why the CRM is tablet-and-up. CSS-only so it is correct
          on the server, with no flash and no viewport JS. */}
      <ScreenTooSmall />
      <DialogsProvider>
        <div className="hidden h-full min-h-0 flex-1 flex-col overflow-hidden md:flex">
          <Topbar
            companyName={company?.name ?? "Vision"}
            logoUrl={company?.logo_url ?? null}
            userName={userDisplayName(user)}
            userEmail={user.email}
            userRole={user.role}
            userInitials={userInitials(user)}
          />
          <div className="flex min-h-0 min-w-0 flex-1 items-stretch overflow-hidden">
            <Sidebar />
            <main className="mr-4 mb-4 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#e7e7ea] bg-white shadow-[0_1px_3px_rgba(10,10,10,0.06)]">
              {children}
            </main>
          </div>
        </div>
      </DialogsProvider>
    </div>
  );
}
