import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Building Blocks Q&A",
  description: "Ask anything about IBM Building Blocks — powered by Headless Bob",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased h-full">{children}</body>
    </html>
  );
}
