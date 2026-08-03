"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setDiaryColour } from "@/app/(app)/diary/actions";
import { WORK_CATEGORIES, type WorkCategory, type WorkCategoryDef } from "@/lib/appointments";
import type { DiaryColours } from "@/lib/data/tenant-settings";
import { Popover } from "@/components/crm/data-list";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The diary's job-type colours, RECOLOURABLE PER TENANT.
//
// This reverses the "platform-fixed" note the legend shipped with: the four
// bands were transcribed from the design and hard-coded so a tenant's brand
// couldn't make a survey look like a cancellation. A tenant asking for its own
// colours is a different thing from the accent leaking in — they're choosing
// the legend deliberately, and every firm already has its own idea of what
// colour a fit is.
//
// ONE colour is stored per category — the strong one, used for text and the
// legend swatch. The pale block fill is DERIVED from it (`color-mix`), so the
// two can never drift into an unreadable pairing, and nobody has to pick two
// colours to change one.
// ---------------------------------------------------------------------------

/** Pale fill derived from the strong colour — 14% of it over white. */
export function tintOf(hex: string): string {
  return `color-mix(in srgb, ${hex} 14%, #fff)`;
}

const ColoursContext = createContext<WorkCategoryDef[]>(WORK_CATEGORIES);

/** The categories with the tenant's colours applied. Falls back per category,
 *  so a partially-set tenant still renders. */
export function useWorkCategories(): WorkCategoryDef[] {
  return useContext(ColoursContext);
}

export function useCategory(key: WorkCategory): WorkCategoryDef {
  const all = useWorkCategories();
  return all.find((c) => c.key === key) ?? WORK_CATEGORIES[WORK_CATEGORIES.length - 1];
}

export function DiaryColoursProvider({
  colours,
  children,
}: {
  colours: DiaryColours;
  children: React.ReactNode;
}) {
  const resolved = WORK_CATEGORIES.map((c) =>
    colours[c.key] ? { ...c, fg: colours[c.key]!, bg: tintOf(colours[c.key]!) } : c,
  );
  return <ColoursContext.Provider value={resolved}>{children}</ColoursContext.Provider>;
}

// ---------------------------------------------------------------------------
// The picker

/**
 * A ready-made palette plus a hex field.
 *
 * The presets exist because most people want "a green" and not a colour
 * science exercise, and because they're pre-checked to stay legible as text on
 * their own 14% tint — which a freely-chosen pale yellow would not be. The hex
 * field is there for the firm that has a brand colour it wants matched exactly.
 */
const PRESETS = [
  "#1f56a3", "#2f7de1", "#0e7490", "#1a7f3e", "#4d7c0f", "#b86e00",
  "#c2410c", "#d64545", "#a21caf", "#6d28d9", "#3f3f46", "#71717a",
];

export function CategoryColourButton({ category }: { category: WorkCategoryDef }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hex, setHex] = useState(category.fg);
  const [error, setError] = useState<string | null>(null);

  const apply = (value: string, close?: () => void) => {
    const clean = value.trim();
    if (!/^#[0-9a-f]{6}$/i.test(clean)) {
      setError("Use a 6-digit hex colour, like #2f7de1.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await setDiaryColour(category.key, clean);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close?.();
      router.refresh();
    });
  };

  return (
    <Popover
      label={category.label}
      width={228}
      // The swatch IS the trigger's icon — the label alone would make the
      // legend a row of buttons rather than a legend.
      swatch={category.bg}
      swatchBorder={category.fg}
      quiet
    >
      {(close) => (
        <div className="flex flex-col gap-2 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#a1a1aa]">
            {category.label}
          </p>

          <div className="grid grid-cols-6 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setHex(p);
                  apply(p, close);
                }}
                disabled={pending}
                aria-label={p}
                title={p}
                className={cn(
                  "size-6 rounded-md border transition-transform hover:scale-110",
                  p.toLowerCase() === category.fg.toLowerCase()
                    ? "border-[#0a0a0a]"
                    : "border-black/10",
                )}
                style={{ background: p }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className="size-6 shrink-0 rounded-md border border-black/10"
              style={{ background: /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#fff" }}
            />
            <input
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply(hex, close);
              }}
              spellCheck={false}
              className="min-w-0 flex-1 rounded-md border border-[#d4d4d8] px-2 py-1 font-mono text-[12px] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-tint)]"
            />
            <button
              type="button"
              onClick={() => apply(hex, close)}
              disabled={pending}
              className="shrink-0 rounded-md bg-[var(--accent-blue)] px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-60"
            >
              Set
            </button>
          </div>

          {error && <p className="text-[11.5px] font-medium text-[#d64545]">{error}</p>}
          <p className="text-[11px] text-[#a1a1aa]">
            Everyone at your company sees this colour — a legend only works if it
            means the same thing to all of you.
          </p>
        </div>
      )}
    </Popover>
  );
}
