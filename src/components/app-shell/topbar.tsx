"use client";

import { signOut } from "@/app/(auth)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TopbarProps = {
  companyName: string;
  logoUrl: string | null;
  userName: string;
  userEmail: string | null;
  userRole: string;
  userInitials: string;
};

// 62px topbar transcribed from the dashboard screen (Vision CRM Screens.dc.html):
// tenant logo mark, 400px pill search, user chip and the accent quick-action.
// The accent `+` button tracks the tenant accent; the rest is the screen's zinc
// chrome. Search + `+` are visual placeholders wired up in later phases.
export function Topbar({
  companyName,
  logoUrl,
  userName,
  userEmail,
  userRole,
  userInitials,
}: TopbarProps) {
  return (
    <header className="flex h-[62px] flex-none items-center gap-3.5 px-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl ?? "/vision-mark.png"}
        alt={companyName}
        width={30}
        height={30}
        className="size-[30px] flex-none object-contain"
      />

      <button
        type="button"
        aria-label="Search"
        className="flex h-10 w-[400px] max-w-full items-center gap-2.5 rounded-full border border-[#e7e7ea] bg-white px-4 text-left text-[13px] text-[#a1a1aa] shadow-[0_1px_2px_rgba(10,10,10,0.04)] transition-colors hover:border-[#d4d4d8] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--accent-blue)]/30"
      >
        <svg
          width={15}
          height={15}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx={11} cy={11} r={7} />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        Search customers, leads, contracts…
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-[#e7e7ea] bg-white py-1 pr-3 pl-1 shadow-[0_1px_2px_rgba(10,10,10,0.04)] outline-none transition-colors hover:bg-[#fafafa] focus-visible:ring-3 focus-visible:ring-[var(--accent-blue)]/30">
            <span className="flex size-7 items-center justify-center rounded-full bg-[#18181b] text-[11px] font-semibold text-white">
              {userInitials}
            </span>
            <span className="text-[13px] font-semibold text-[#18181b]">
              {userName}
            </span>
            <svg
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#71717a"
              strokeWidth={2}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-semibold">{userName}</span>
              {userEmail ? (
                <span className="truncate text-xs font-normal text-[#71717a]">
                  {userEmail}
                </span>
              ) : null}
              <span className="mt-1 text-[11px] font-medium tracking-wide text-[#a1a1aa] uppercase">
                {userRole.replace(/_/g, " ")}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void signOut();
              }}
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          aria-label="Create new"
          className="flex size-[38px] items-center justify-center rounded-full bg-[var(--accent-blue)] text-white shadow-[0_4px_12px_rgba(10,10,10,0.06)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--accent-blue)]/40"
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </header>
  );
}
