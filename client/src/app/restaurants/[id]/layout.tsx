import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const res = await fetch(`${apiUrl}/restaurants/${id}`, {
      next: { revalidate: 60 } // cache for 1 minute
    });
    if (res.ok) {
      const data = await res.json();
      const rest = data.restaurant || data.data?.restaurant;
      if (data.success && rest) {
        return {
          title: `${rest.name} - Menu & Order Food Online | ZipRocket`,
          description: `Order delicious food online from ${rest.name} in ${rest.location?.address || 'your area'}. View menu, ratings, delivery details and customer reviews on ZipRocket.`,
          alternates: {
            canonical: `https://ziprocket.in/restaurants/${id}`,
          },
        };
      }
    }
  } catch (error) {
    console.error("Failed to fetch restaurant metadata:", error);
  }

  return {
    title: "Restaurant Menu | Fast Food Delivery - ZipRocket",
    description: "Browse menu and order delicious fast food online for quick delivery via ZipRocket.",
    alternates: {
      canonical: `https://ziprocket.in/restaurants/${id}`,
    },
  };
}

export default async function RestaurantDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let restaurant: any = null;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const res = await fetch(`${apiUrl}/restaurants/${id}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        restaurant = data.restaurant || data.data?.restaurant;
      }
    }
  } catch (error) {
    console.error("Failed to fetch restaurant for schema:", error);
  }

  // Generate schemas
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
        "name": "Restaurants",
        "item": "https://ziprocket.in/restaurants"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": restaurant ? restaurant.name : "Restaurant Menu",
        "item": `https://ziprocket.in/restaurants/${id}`
      }
    ]
  };

  const localBusinessSchema = restaurant ? {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `https://ziprocket.in/restaurants/${id}#restaurant`,
    "name": restaurant.name,
    "image": restaurant.image || "https://ziprocket.in/logo.png",
    "url": `https://ziprocket.in/restaurants/${id}`,
    "servesCuisine": restaurant.cuisines || "Multi-cuisine",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": restaurant.location?.address || "Main Street",
      "addressLocality": "Benipatti",
      "addressRegion": "Bihar",
      "postalCode": "847223",
      "addressCountry": "IN"
    },
    "geo": restaurant.location?.lat && restaurant.location?.lng ? {
      "@type": "GeoCoordinates",
      "latitude": restaurant.location.lat,
      "longitude": restaurant.location.lng
    } : undefined,
    "aggregateRating": restaurant.rating > 0 ? {
      "@type": "AggregateRating",
      "ratingValue": restaurant.rating,
      "ratingCount": restaurant.totalOrders > 0 ? restaurant.totalOrders : 1,
      "bestRating": "5",
      "worstRating": "1"
    } : undefined
  } : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {localBusinessSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      )}
      {children}
    </>
  );
}
