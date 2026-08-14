import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/ui/Providers";

// Geist carries the whole UI. Nothing above 600: hierarchy comes from size
// and colour, not from weight escalation.
const sansFont = Geist({
  variable: "--font-sans-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Every number in the product renders in mono with tabular figures, so counts
// line up when they are compared down a column.
const monoFont = Geist_Mono({
  variable: "--font-mono-ui",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// Titles and the wordmark. This is the face that makes GuildBoard look like
// itself, so it carries all three title steps rather than the wordmark alone.
// Running text stays sans.
const displayFont = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GuildBoard - Where Guilds Shape What\u2019s Next",
  description: "A structured, async platform for engineering guilds to surface ideas, vote on what to explore, and track outcomes - cycle by cycle.",
  applicationName: "GuildBoard",
  appleWebApp: {
    capable: true,
    title: "GuildBoard",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E8913A" },
    { media: "(prefers-color-scheme: dark)", color: "#08080C" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sansFont.variable} ${monoFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
