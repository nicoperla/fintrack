import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FinTrack Admin", template: "%s · FinTrack Admin" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#14161c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-svh">{children}</body>
    </html>
  );
}
