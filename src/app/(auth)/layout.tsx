import Image from "next/image";

// Shared shell for sign-in / reset screens: centred card on the Vision canvas.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[var(--canvas)] px-4 py-12">
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
  );
}
