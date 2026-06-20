import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { LocationProvider } from "@/context/LocationContext";
import { PlatformProvider } from "@/context/PlatformContext";
import LocationPromptModal from "@/components/DynamicLocationPromptModal";
import { PwaProvider } from "@/context/PwaContext";
import PwaManager from "@/components/DynamicPwaManager";
import { GoogleAnalytics } from "@next/third-parties/google";


const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

export const viewport: Viewport = {
  themeColor: "#FF5C00",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "ZipRocket",
  description: "ZipRocket - Fast food and groceries delivery",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ZipRocket",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icon-192x192.png',
    shortcut: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-on-surface">
        <PwaProvider>
          <LocationProvider>
            <PlatformProvider>
              <AuthProvider>
                <CartProvider>
                  {children}
                  <LocationPromptModal />
                  <PwaManager />
                </CartProvider>
              </AuthProvider>
            </PlatformProvider>
          </LocationProvider>
        </PwaProvider>
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-SXXC7PQQKH"} />
      </body>
    </html>
  );
}

