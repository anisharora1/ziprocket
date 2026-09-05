import { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: "Login to ZipRocket | Fast Food & Grocery Delivery",
  description: "Log in to your ZipRocket account to track orders, manage addresses, or register as a merchant or delivery boy.",
  alternates: {
    canonical: `${SITE_URL}/auth/login`,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
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
        "name": "Login",
        "item": `${SITE_URL}/auth/login`
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
