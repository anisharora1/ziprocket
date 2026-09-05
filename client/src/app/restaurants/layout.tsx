import { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: "Top Restaurants | Fast Food Delivery - ZipRocket",
  description: "Browse local restaurants, check menus, ratings and order food online for quick delivery via ZipRocket.",
  alternates: {
    canonical: `${SITE_URL}/restaurants`,
  },
};

export default function RestaurantsLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": SITE_URL
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Restaurants",
        "item": `${SITE_URL}/restaurants`
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
