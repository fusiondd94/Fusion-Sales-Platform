import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./design-system-append.css";
import "./phase2-append.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Fusion Digital Dynamics Sales Platform",
  description: "Guided website design sales platform for Fusion Digital Dynamics LLC."
};

export const viewport: Viewport = {
  themeColor: "#004443"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
