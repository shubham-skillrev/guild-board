import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
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

// Numbers and the small tracked-caps labels. Tabular figures, so counts line
// up down a column.
const monoFont = Geist_Mono({
  variable: "--font-mono-ui",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// The accent voice: one italic word per headline. It only ships in 400, and
// only the italic is used, but the upright is kept for the rare fallback.
const displayFont = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

/* Runs before first paint so the page never flashes the wrong theme. An
   explicit choice ("light" / "dark") wins; otherwise the OS decides. The
   ThemeToggle component writes the same key. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('gb-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export const metadata: Metadata = {
  title: "GuildBoard by SkillRev \u00b7 Where SkillRev talks tech",
  description:
    "SkillRev's monthly engineering guild. New tech, old tech, something you learned, a problem you're stuck on. Put it on the board, then talk it through.",
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
    { media: "(prefers-color-scheme: light)", color: "#FAFAF8" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the theme script adds `dark` to this element
    // before React hydrates, which is intended.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sansFont.variable} ${monoFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
