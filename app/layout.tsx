import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goldencar Officina",
  description: "Gestionale officina Goldencar",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
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