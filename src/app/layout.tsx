import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "RENTORA — najem opreme in strojev", template: "%s · RENTORA" },
  description: "Najemite gradbeno mehanizacijo, orodja in opremo pri preverjenih izposojevalnicah. RENTORA Business je sistem za vodenje izposojevalnic.",
  openGraph: { siteName: "RENTORA", locale: "sl_SI", type: "website" },
};

export const viewport: Viewport = { themeColor: "#16191d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sl" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
