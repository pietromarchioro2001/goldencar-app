import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goldencar Officina",
  description: "Gestionale officina Goldencar",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}