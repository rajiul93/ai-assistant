import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141417" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 font-sans text-zinc-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
