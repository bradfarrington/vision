import Image from "next/image";

/**
 * Below 1280px the CRM shows this instead of the app — phones AND tablets.
 *
 * **Deliberately blunt for now.** The screens are built to the desktop layout
 * (the customer overview is a four-column bento); a tablet tier would mean
 * genuine layout work per screen, and doing it half-heartedly is what produced
 * a two-column stack that clipped. Blocking is honest until that work is done —
 * revisit when there is a reason to support tablets properly, and pick the
 * threshold from the layouts rather than from the device tiers.
 *
 * Tenant WEBSITES from the AI builder ARE mobile-first. Different product,
 * different rules — don't apply this decision to them.
 *
 * The gate is pure CSS (`xl:hidden` here, `hidden xl:flex` on the shell), so it
 * renders correctly server-side with no flash, no viewport JS and no hydration
 * mismatch.
 */
export function ScreenTooSmall() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 bg-[var(--canvas)] px-8 text-center xl:hidden">
      <Image
        src="/vision-lockup.png"
        alt="Vision by Digital Craft"
        width={150}
        height={32}
        priority
        className="h-7 w-auto"
      />
      <div className="max-w-[320px]">
        <h1 className="font-[family-name:var(--font-inter-tight)] text-[19px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
          This screen is too small
        </h1>
        <p className="mt-2 text-[13px] leading-[1.6] text-[#71717a]">
          Vision needs a computer. Open it again on a wider screen and you&rsquo;ll
          pick up right where you left off.
        </p>
      </div>
      <p className="text-[11.5px] text-[#a1a1aa]">Minimum width 1280px</p>
    </div>
  );
}
