import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Partner With Us - Register Your Restaurant | ZipRocket",
  description: "Become a restaurant partner on ZipRocket. Grow your business, get more orders and manage deliveries seamlessly.",
  alternates: {
    canonical: "https://ziprocket.in/register-partner",
  },
};

export default function RegisterPartnerLayout({ children }: { children: React.ReactNode }) {
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
        "name": "Register Partner",
        "item": "https://ziprocket.in/register-partner"
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
