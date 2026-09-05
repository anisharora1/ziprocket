import { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: "ZipGrocery - 15-Minute Fresh Grocery Delivery | ZipRocket",
  description: "Get fresh vegetables, fruits, dairy, bread, flour, munchies, beverages and household essentials delivered in 15 minutes from ZipGrocery.",
  alternates: {
    canonical: `${SITE_URL}/grocery`,
  },
};

export default function GroceryLayout({ children }: { children: React.ReactNode }) {
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
        "name": "Grocery",
        "item": `${SITE_URL}/grocery`
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
