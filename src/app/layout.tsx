import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Gestión Comparsa - Barraca",
  description: "Sistema de gestión de crédito para socios de comparsa",
  manifest: "/manifest.json",
  icons: [{ rel: "icon", url: "/favicon.png", type: "image/png" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-dvh flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
