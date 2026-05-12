import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/ui/Providers";

const sansFont = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const displayFont = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "GuildBoard — Where Guilds Shape What\u2019s Next",
  description: "A structured, async platform for engineering guilds to surface ideas, vote on what to explore, and track outcomes — cycle by cycle.",
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
      className={`${sansFont.variable} ${displayFont.variable} h-full antialiased`}
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
