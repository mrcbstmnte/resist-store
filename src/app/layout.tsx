import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RESIST -- Faster than my excuses", template: "%s | RESIST" },
  description: "Active wear from Bacolod. Made to move, built for everyday.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
