"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setDiaryColour } from "@/app/(app)/diary/actions";
import { WORK_CATEGORIES, type WorkCategory, type WorkCategoryDef } from "@/lib/appointments";
import type { DiaryColours } from "@/lib/data/tenant-settings";
import { ColourPicker, isHex } from "@/components/crm/colour-picker";
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
 * A GRID: hues across, shades down.
 *
 * A single row of twelve made you hunt for "a slightly darker green"; laid out
 * as a matrix the eye can find a hue by column and a weight by row, which is
 * how everyone reads a palette. Every value sits in the 600–800 range because
 * these colours are used as TEXT on their own 14% tint — a pastel would be
 * unreadable there, and the picker below is the escape hatch for anyone who
 * wants one anyway.
 */
const PALETTE: string[][] = [
  ["#b91c1c", "#c2410c", "#a16207", "#4d7c0f", "#047857", "#0f766e", "#1d4ed8", "#6d28d9"],
  ["#dc2626", "#ea580c", "#ca8a04", "#65a30d", "#059669", "#0d9488", "#2563eb", "#7c3aed"],
  ["#991b1b", "#9a3412", "#854d0e", "#3f6212", "#065f46", "#115e59", "#1e40af", "#5b21b6"],
  ["#be185d", "#a21caf", "#0369a1", "#0e7490", "#18181b", "#3f3f46", "#52525b", "#71717a"],
];

export function CategoryColourButton({ category }: { category: WorkCategoryDef }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hex, setHex] = useState(category.fg);
  const [error, setError] = useState<string | null>(null);
  /** The drag-to-choose picker, opened from the swatch beside the hex field. */
  const [custom, setCustom] = useState(false);

  const apply = (value: string, close?: () => void) => {
    const clean = value.trim();
    if (!isHex(clean)) {
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
      width={248}
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

          {/* FLEX-WRAP with fixed 24px swatches, not a grid template: eight
              fit the popover's width exactly, and if a utility class ever
              fails to make it into the stylesheet these degrade to a wrapped
              row of small squares rather than one column of huge blocks —
              which is what a missing `grid-cols-8` turned them into. */}
          <div className="flex flex-wrap gap-1">
            {PALETTE.flat().map((p) => (
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
                  "size-6 shrink-0 rounded-[5px] border transition-transform hover:scale-110",
                  p.toLowerCase() === category.fg.toLowerCase()
                    ? "border-[#0a0a0a]"
                    : "border-black/10",
                )}
                style={{ background: p }}
              />
            ))}
          </div>

          {custom && (
            <ColourPicker value={isHex(hex) ? hex : category.fg} onChange={setHex} />
          )}

          <div className="flex items-center gap-1.5">
            {/* The swatch is the way IN to the custom picker — clicking the
                colour to change the colour is where anyone would press. */}
            <button
              type="button"
              onClick={() => setCustom((c) => !c)}
              aria-label={custom ? "Close the colour picker" : "Pick a custom colour"}
              title={custom ? "Close the colour picker" : "Pick a custom colour"}
              className={cn(
                "size-7 shrink-0 rounded-md border transition-transform hover:scale-105",
                custom ? "border-[var(--accent-blue)] ring-2 ring-[var(--accent-tint)]" : "border-black/15",
              )}
              style={{ background: isHex(hex) ? hex : "#fff" }}
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
        </div>
      )}
    </Popover>
  );
}
