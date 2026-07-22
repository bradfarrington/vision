import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Vision typography: Inter (body/UI), Inter Tight (display/headings),
// JetBrains Mono (reference codes / tabular figures). All variable fonts.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vision",
  description: "Vision — the operating system for home-improvement installers.",
  // The CRM must be invisible to search engines. The public marketing site
  // that sells/gates Vision (getvision.uk — not yet built) is the SEO surface,
  // separate again from tenant AI-built websites. This app is never indexed.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The app is a fixed viewport frame: the document itself never scrolls in
    // either axis. Every screen scrolls inside its own panel instead, so the
    // topbar and rail stay put and there is no page-level scrollbar.
    <html
      lang="en-GB"
      className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable} h-full overflow-hidden antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden">{children}</body>
    </html>
  );
}
