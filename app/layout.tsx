import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWARegister from "./pwa-register";
import AppDialogs from "@/components/AppDialogs";

export const metadata: Metadata = {
  title: "Goldencar",
  applicationName: "Goldencar",
  description: "Gestionale officina Goldencar",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    title: "Goldencar",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>
        <PWARegister />
        <AppDialogs />
        {children}
      </body>
    </html>
  );
}
