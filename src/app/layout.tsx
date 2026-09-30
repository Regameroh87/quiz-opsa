import type { Metadata, Viewport } from "next";
import { Bowlby_One, Rubik } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

// Display gruesa tipo sticker para títulos; Rubik para la UI (botones incluidos).
const display = Bowlby_One({ weight: "400", subsets: ["latin"], variable: "--font-bowlby" });
const ui = Rubik({ subsets: ["latin"], variable: "--font-rubik" });

export const metadata: Metadata = {
  title: "Quiz New Holland",
  description: "Plataforma interactiva de trivias y capacitaciones New Holland Agriculture",
  applicationName: "Quiz New Holland",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Quiz NH",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#00153f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${display.variable} ${ui.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
