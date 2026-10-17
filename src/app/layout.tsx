import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Tiro_Bangla } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/providers";
import "katex/dist/katex.min.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Geist has no Bangla letters, so Bangla used to fall back to the phone's own (often heavy) font.
// The browser takes English from Geist and all Bangla from Tiro Bangla (the owner's choice,
// 2026-10-15). It has one weight, so bold Bangla is drawn bold by the browser. Only its Bengali
// part: English always comes from Geist, so a preloaded Latin copy went unused (console warning).
const bangla = Tiro_Bangla({
  variable: "--font-bangla",
  subsets: ["bengali"],
  weight: "400",
  fallback: ["serif"],
});

// Used on a few pages only (timers, typing, code), so it isn't preloaded on every page — that
// showed as "preloaded but not used" in the console; it loads when a page needs it.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Prep — Job Preparation",
  description: "Personal job preparation and study management.",
  applicationName: "Prep",
  // Installed on a phone's home screen, it opens full screen like an app.
  appleWebApp: { capable: true, title: "Prep", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Draw under the iPhone notch/home bar; the layout pads itself with the safe-area insets.
  viewportFit: "cover",
  // Light only (no dark mode), so the browser bar stays white too.
  themeColor: "#f3f3ef",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${bangla.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 font-sans text-zinc-950">
        <Providers>{children}</Providers>
        {/* Real-user page speed (Vercel → Speed Insights); does nothing outside Vercel. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
