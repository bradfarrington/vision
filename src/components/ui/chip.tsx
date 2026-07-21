import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Status chip per the Vision design system: pill, tinted background + solid
// text. Semantic tones (success/warning/danger/info) are platform-fixed; the
// `accent` tone tracks the tenant accent so it rebrands with the shell.
const chipVariants = cva(
  "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&>svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-[var(--muted)] text-[var(--text-body)]",
        accent:
          "bg-[var(--accent-tint)] text-[var(--accent-active)]",
        success: "bg-[var(--success-tint,#e7f5ee)] text-[var(--success)]",
        warning: "bg-[var(--warning-tint,#fbf1df)] text-[var(--warning)]",
        danger: "bg-[var(--danger-tint,#fdecec)] text-[var(--danger)]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

function Chip({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return (
    <span
      data-slot="chip"
      className={cn(chipVariants({ tone }), className)}
      {...props}
    />
  );
}

export { Chip, chipVariants };
