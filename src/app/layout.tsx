import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeDocAI",
  description: "AI trade document compliance for cross-border sellers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
