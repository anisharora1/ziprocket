import type { Metadata } from "next";
import Header from "@/components/Header";
import StaticSearchBar from "@/components/SearchBar";
import HeroCarousel from "@/components/HeroCarousel";
import Categories from "@/components/Categories";
import TopRated from "@/components/TopRated";
import StaticRestaurantList from "@/components/RestaurantList";
import StaticFloatingCartButton from "@/components/FloatingCartButton";
import StaticBottomNavBar from "@/components/BottomNavBar";
import StaticFirstVisitInstallModal from "@/components/FirstVisitInstallModal";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "ZipRocket - Fast Food & Grocery Delivery Platform",
  description: "Order food and groceries online with ZipRocket. Get lightning-fast 10-minute grocery delivery and hot meals from your favorite local restaurants.",
  alternates: {
    canonical: SITE_URL,
  },
};

export default function Home() {
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#localbusiness`,
    "name": "ZipRocket Delivery Service",
    "image": `${SITE_URL}/logo.png`,
    "url": SITE_URL,
    "telephone": "+91-9117662441",
    "priceRange": "₹10-₹50",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Benipatti, Benipatti Bazar",
      "addressLocality": "Benipatti",
      "addressRegion": "Bihar",
      "postalCode": "847223",
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 26.443352,
      "longitude": 85.902705
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
      ],
      "opens": "08:00",
      "closes": "21:00"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is ZipRocket?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ZipRocket is a fast food and grocery delivery platform operating in tier-3 cities, offering lightning-fast grocery deliveries and on-demand hot food deliveries from local restaurants."
        }
      },
      {
        "@type": "Question",
        "name": "How fast does ZipGrocery deliver?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ZipGrocery items are delivered to your doorstep in 30 minutes or less from our local stores."
        }
      },
      {
        "@type": "Question",
        "name": "Are there delivery fees on ZipRocket?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Delivery fees on ZipRocket are kept minimal to serve local communities, and we offer frequent free delivery promotions for both food and groceries."
        }
      }
    ]
  };

  return (
    <div className="bg-surface text-on-surface pb-24 min-h-screen w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Header />

      <main className="pt-20 mt-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-xl w-full">
        <StaticSearchBar />
        <HeroCarousel />
        <Categories />
        <TopRated />
        <StaticRestaurantList />
      </main>

      <StaticBottomNavBar />
      <StaticFloatingCartButton />
      <StaticFirstVisitInstallModal />
    </div>
  );
}

