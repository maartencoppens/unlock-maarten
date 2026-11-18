import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Unlock Maarten",
  description: "Een sollicitatie die je moet ontgrendelen. Stel vragen, leer Maarten kennen, en de foto wordt scherper.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d0b10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
