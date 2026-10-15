import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Hind_Siliguri } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/providers";
import "katex/dist/katex.min.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Geist has no Bangla letters, so Bangla used to fall back to the phone's own (often heavy) font.
// The browser takes English from Geist and Bangla from Hind Siliguri, which the design uses.
const bangla = Hind_Siliguri({
  variable: "--font-bangla",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  themeColor: "#ffffff",
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
