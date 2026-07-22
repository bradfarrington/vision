import Image from "next/image";

// Shared shell for sign-in / reset screens: centred card on the Vision canvas.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The document is locked to the viewport (see the root layout), so this
    // screen owns its own scroll. The centring lives on an inner `min-h-full`
    // wrapper, not on the scroller — centring a scroll container clips the top
    // of anything taller than the window.
    <div className="h-full flex-1 overflow-y-auto bg-[var(--canvas)]">
      <div className="flex min-h-full items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex justify-center">
            <Image
              src="/vision-lockup.png"
              alt="Vision by Digital Craft"
              width={150}
              height={32}
              priority
              className="h-7 w-auto"
            />
          </div>
          <div className="rounded-xl border border-[var(--hairline)] bg-card p-8 shadow-sm">
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
            Vision by Digital Craft
          </p>
        </div>
      </div>
    </div>
  );
}
