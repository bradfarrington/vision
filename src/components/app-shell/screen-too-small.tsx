import Image from "next/image";

/**
 * Phone tier (<768px) is not a supported size for the CRM.
 *
 * This is a deliberate product decision, not a gap: the CRM is a dense
 * multi-column record system — a customer record is nine cards and ten tabs, a
 * documents screen is a two-pane viewer. Shrinking that to 390px would mean
 * designing and maintaining a second product. Tenant WEBSITES (the AI builder,
 * later) are mobile-first; the CRM behind them is desk software.
 *
 * The gate is pure CSS (`md:hidden` here, `hidden md:flex` on the shell), so it
 * renders correctly server-side with no flash, no viewport JS and no hydration
 * mismatch. If a phone view is ever wanted, it starts here.
 */
export function ScreenTooSmall() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 bg-[var(--canvas)] px-8 text-center md:hidden">
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
          Vision needs a tablet or computer. Open it again on a wider screen and
          you&rsquo;ll pick up right where you left off.
        </p>
      </div>
      <p className="text-[11.5px] text-[#a1a1aa]">Minimum width 768px</p>
    </div>
  );
}
