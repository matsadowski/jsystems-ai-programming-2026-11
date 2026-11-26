import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const nunito = localFont({
  src: [
    { path: "../../public/fonts/NunitoSans-VariableFont.woff2", weight: "200 1000", style: "normal" },
    { path: "../../public/fonts/NunitoSans-Italic-VariableFont.woff2", weight: "200 1000", style: "italic" },
  ],
  variable: "--font-nunito",
  display: "swap",
});

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
    <html lang="pl" className={nunito.variable}>
      <body>{children}</body>
    </html>
  );
}
