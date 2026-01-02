import "./globals.css";
import type { Metadata, Viewport } from "next";
import { SessionProvider } from "../src/components/providers/SessionProvider";
import { ErudaLoader } from "../src/components/debug/ErudaLoader";

export const metadata: Metadata = {
  title: "Clara - Tu Asesora de Skincare | Beta Skin Tech",
  description:
    "Clara es tu asistente virtual de skincare. Obtiene recomendaciones personalizadas para el cuidado de tu piel.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ErudaLoader />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
