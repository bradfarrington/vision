import { redirect } from "next/navigation";

import { Sidebar } from "@/components/app-shell/sidebar";
import { BOTTOM_NAV, MAIN_NAV } from "@/components/app-shell/nav";
import { Topbar } from "@/components/app-shell/topbar";
import { SectionMemorySaver } from "@/components/crm/view-state";
import {
  getSession,
  userDisplayName,
  userInitials,
} from "@/lib/company";
import { tenantThemeVars } from "@/lib/theme";
import { DialogsProvider } from "@/components/crm/dialogs";
import { ScreenTooSmall } from "@/components/app-shell/screen-too-small";

// Authenticated app shell: grey canvas, ~62px topbar, 76px icon rail and a
// white content panel that runs full-bleed to the right and bottom of the
// viewport (see the note on <main>). The tenant accent is derived from the
// company row and applied as CSS custom properties on the shell root, so every
// child rebrands from here.
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
      {/* Under 1280px the app is replaced by the "too small" screen — see the
          component for why the CRM is desktop-only for now. CSS-only so it is
          correct on the server, with no flash and no viewport JS. */}
      <ScreenTooSmall />
      <DialogsProvider>
        <div className="hidden h-full min-h-0 flex-1 flex-col overflow-hidden xl:flex">
          <Topbar
            companyName={company?.name ?? "Vision"}
            logoUrl={company?.logo_url ?? null}
            userName={userDisplayName(user)}
            userEmail={user.email}
            userRole={user.role}
            userInitials={userInitials(user)}
          />
          {/* Remembers the last page you had open in each sidebar section, so
              the rail resumes an open record instead of always reopening the
              list. */}
          <SectionMemorySaver
            sections={[...MAIN_NAV, ...BOTTOM_NAV].map((n) => n.href)}
          />
          <div className="flex min-h-0 min-w-0 flex-1 items-stretch overflow-hidden">
            <Sidebar />
            {/* The panel runs FLUSH to the right and bottom of the viewport — no
                gutter, so screen height and width go to content. Only the
                top-left corner is rounded and only the left/top edges are
                bordered: the other two sit on the viewport edge, where a radius
                cuts a grey notch out of the panel and a rule draws a line along
                an edge that already ends. `overflow-hidden` still clips the
                square-cornered table inside it. */}
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-2xl border-l border-t border-[#e7e7ea] bg-white shadow-[0_1px_3px_rgba(10,10,10,0.06)]">
              {children}
            </main>
          </div>
        </div>
      </DialogsProvider>
    </div>
  );
}
