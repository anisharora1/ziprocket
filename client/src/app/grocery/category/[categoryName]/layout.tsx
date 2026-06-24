import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ categoryName: string }> }): Promise<Metadata> {
  const { categoryName } = await params;
  const decodedCategory = decodeURIComponent(categoryName);
  return {
    title: `Buy Fresh ${decodedCategory} Online | ZipGrocery - ZipRocket`,
    description: `Shop fresh ${decodedCategory}, quality products, and daily essentials online at ZipGrocery. Fast 15-minute doorstep delivery in your city.`,
    alternates: {
      canonical: `https://ziprocket.in/grocery/category/${categoryName}`,
    },
  };
}

export default async function GroceryCategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ categoryName: string }>;
}) {
  const { categoryName } = await params;
  const decodedCategory = decodeURIComponent(categoryName);

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
        "name": "Grocery",
        "item": "https://ziprocket.in/grocery"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": decodedCategory,
        "item": `https://ziprocket.in/grocery/category/${categoryName}`
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
