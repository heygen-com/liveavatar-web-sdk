import "./globals.css";
import type { Metadata, Viewport } from "next";
import { SessionProvider } from "../src/components/providers/SessionProvider";

export const metadata: Metadata = {
  title: "Live Avatar SDK Demo",
  description: "Interactive avatar demo with HeyGen Live Avatar SDK",
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
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
