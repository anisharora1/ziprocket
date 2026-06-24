import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Join ZipRocket as a Delivery Partner | ZipRocket",
  description: "Become a delivery rider with ZipRocket. Flexible hours, competitive payout rates, and instant registration.",
  alternates: {
    canonical: "https://ziprocket.in/register-delivery",
  },
};

export default function RegisterDeliveryLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://ziprocket.in"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Register Delivery Rider",
        "item": "https://ziprocket.in/register-delivery"
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
