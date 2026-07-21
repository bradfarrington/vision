import { cn } from "@/lib/utils";
import { leadStage, STAGE_TONE_CLASS, type StageTone } from "@/lib/leads";
import { Icon } from "./icon";

// ---------------------------------------------------------------------------
// Initials avatar — circular, 3 tones from the design (neutral zinc, accent
// blue-tint, solid dark). Default zinc `#f4f4f5` / `#3f3f46`.
// ---------------------------------------------------------------------------
type AvatarProps = {
  name: string;
  size?: number;
  tone?: "neutral" | "accent" | "dark";
  className?: string;
};

const AVATAR_TONE: Record<NonNullable<AvatarProps["tone"]>, string> = {
  neutral: "bg-[#f4f4f5] text-[#3f3f46]",
  // Accent tone rebrands with the tenant.
  accent: "bg-[var(--accent-tint)] text-[var(--accent-active)]",
  dark: "bg-[#18181b] text-white",
};

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/[\s&]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 32, tone = "neutral", className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        AVATAR_TONE[tone],
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.33) }}
    >
      {initialsFrom(name)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stage badge — the lead pipeline pill. Resolves a `leads.status` string to its
// stage + tone. The `new` stage carries a leading dot per the design system.
// ---------------------------------------------------------------------------
export function StageBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const stage = leadStage(status);
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11px] font-semibold",
        STAGE_TONE_CLASS[stage.tone],
        className,
      )}
    >
      {stage.tone === "neutral" && (
        <span className="size-1.5 rounded-full bg-[#71717a]" />
      )}
      {stage.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Generic pill — tinted status/label chip used for milestones, results, counts.
// ---------------------------------------------------------------------------
export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: StageTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11px] font-semibold",
        STAGE_TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Count pill — the "3 · 1 live" style badge in list cells. Blue tint when there
// is at least one live item, otherwise flat zinc.
// ---------------------------------------------------------------------------
export function CountPill({
  total,
  live = 0,
  className,
}: {
  total: number;
  live?: number;
  className?: string;
}) {
  const hasLive = live > 0;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11px] font-semibold",
        hasLive
          ? "bg-[var(--accent-tint)] text-[var(--accent-blue)]"
          : "bg-[#f4f4f5] text-[#52525b]",
        className,
      )}
    >
      {total}
      {hasLive ? ` · ${live} live` : ""}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Reference code — JetBrains Mono chip for lead/contract numbers (L-2417).
// ---------------------------------------------------------------------------
export function RefChip({
  children,
  inverted = false,
  className,
}: {
  children: React.ReactNode;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-1 font-mono text-xs font-bold",
        inverted ? "bg-[#18181b] text-white" : "bg-[#f4f4f5] text-[#3f3f46]",
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Card — the standard white panel recipe used across CRM detail screens.
// ---------------------------------------------------------------------------
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#e7e7ea] bg-white px-[18px] py-4 shadow-[0_1px_3px_rgba(10,10,10,0.06)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "font-[family-name:var(--font-inter-tight)] text-[15px] font-bold text-[#0a0a0a]",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared button class strings — the exact secondary/primary button recipes from
// the design. Exported as class strings so they apply equally to <button>,
// <Link> and shadcn components without wrapping.
// ---------------------------------------------------------------------------
export const btnSecondary =
  "inline-flex items-center gap-[7px] rounded-lg border border-[#e7e7ea] bg-white px-3 py-2 text-[13px] font-semibold text-[#3f3f46] transition-colors hover:bg-[#fafafa] disabled:opacity-60";

export const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-[14px] py-[9px] text-[13px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60";

// Filter pill (default + active). Active tracks the tenant accent.
export const pillDefault =
  "inline-flex items-center gap-1.5 rounded-full border border-[#e7e7ea] bg-white px-3 py-[7px] text-[12.5px] font-medium text-[#3f3f46] transition-colors hover:bg-[#fafafa]";
export const pillActive =
  "inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-blue)] bg-[var(--accent-tint)] px-3 py-[7px] text-[12.5px] font-semibold text-[var(--accent-blue)]";

export { Icon };
