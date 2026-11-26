import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hardware Service Decision Copilot",
  description: "Asystent decyzji zwrotów i reklamacji sprzętu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
