import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { CartProvider } from "@/context/CartContext";
import { LocationProvider } from "@/context/LocationContext";
import { PlatformProvider } from "@/context/PlatformContext";
import LocationPromptModal from "@/components/LocationPromptModal";
import { PwaProvider } from "@/context/PwaContext";
import PwaManager from "@/components/PwaManager";
import ErrorBoundary from "@/components/ErrorBoundary";
import { GoogleAnalytics } from "@next/third-parties/google";
import QueryProvider from "@/components/QueryProvider";

// ... existing font setup ...


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
  metadataBase: new URL("https://ziprocket.in"),
  title: "ZipRocket - Fast Food & Grocery Delivery Platform",
  description: "ZipRocket is a fast food and grocery delivery platform that helps customers order from nearby restaurants and stores with quick doorstep delivery.",
  keywords: ["ZipRocket", "fast food delivery", "grocery delivery", "food delivery app", "online food order", "quick delivery", "nearby restaurants", "local stores"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ZipRocket",
  },
  formatDetection: {
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "ZipRocket - Fast Food & Grocery Delivery Platform",
    description:
      "Order food, groceries, and daily essentials online with ZipRocket. Quick doorstep delivery in tier-3 cities.",
    url: "https://ziprocket.in",
    siteName: "ZipRocket",
    type: "website",
    locale: "en_IN",
  },

  twitter: {
    card: "summary_large_image",
    title: "ZipRocket - Fast Food & Grocery Delivery Platform",
    description:
      "Order food, groceries, and daily essentials online with ZipRocket. Quick doorstep delivery in tier-3 cities.",
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
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://ziprocket.in/#organization",
    "name": "ZipRocket",
    "url": "https://ziprocket.in",
    "logo": {
      "@type": "ImageObject",
      "url": "https://ziprocket.in/logo.png",
      "width": "512",
      "height": "512"
    },
    "sameAs": [
      "https://www.facebook.com/ziprocket",
      "https://www.instagram.com/ziprocket.in"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-9117662441",
      "contactType": "customer service",
      "areaServed": "IN",
      "availableLanguage": ["en", "hi"]
    }
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://ziprocket.in/#website",
    "name": "ZipRocket",
    "url": "https://ziprocket.in",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://ziprocket.in/restaurants?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ZipRocket" />
        <meta name="application-name" content="ZipRocket" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://res.cloudinary.com" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-on-surface">
        <ErrorBoundary>
          <QueryProvider>
            <PwaProvider>
              <LocationProvider>
                <PlatformProvider>
                  <AuthProvider>
                    <SocketProvider>
                      <CartProvider>
                        {children}
                        <LocationPromptModal />
                        <PwaManager />
                      </CartProvider>
                    </SocketProvider>
                  </AuthProvider>
                </PlatformProvider>
              </LocationProvider>
            </PwaProvider>
          </QueryProvider>
        </ErrorBoundary>
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-SXXC7PQQKH"} />
      </body>
    </html>
  );
}

