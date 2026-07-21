"use client";

import { useState } from "react";

// Lightweight tab strip for detail screens. Panels are server-rendered and
// passed in as content; this only toggles which one is visible. Underline +
// active weight match the lead-detail tab bar.
export type TabDef = {
  label: string;
  count?: number;
  content: React.ReactNode;
};

export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-end gap-0.5 overflow-x-auto border-b border-[#e7e7ea]">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setActive(i)}
            className={`relative whitespace-nowrap px-3.5 pb-[11px] pt-[9px] text-[13px] ${
              i === active ? "font-bold text-[#0a0a0a]" : "font-medium text-[#71717a] hover:text-[#3f3f46]"
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1 text-[11px] text-[#a1a1aa]">{t.count}</span>
            )}
            {i === active && (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-sm bg-[var(--accent-blue)]" />
            )}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-4">{tabs[active]?.content}</div>
    </div>
  );
}
