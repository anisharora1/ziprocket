import RestaurantDetailClient from "./RestaurantDetailClient";

async function getRestaurantData(id: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const [restRes, menuRes] = await Promise.all([
      fetch(`${apiUrl}/restaurants/${id}`, { next: { revalidate: 60 } }),
      fetch(`${apiUrl}/restaurants/${id}/menu`, { next: { revalidate: 60 } }),
    ]);

    const restData = restRes.ok ? await restRes.json() : null;
    const menuData = menuRes.ok ? await menuRes.json() : null;

    return {
      restaurant: restData?.restaurant || restData?.data?.restaurant || null,
      menuItems: menuData?.menuItems || menuData?.data?.menuItems || [],
    };
  } catch (err) {
    console.error("Failed to fetch restaurant data server-side:", err);
    return {
      restaurant: null,
      menuItems: [],
    };
  }
}

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { restaurant, menuItems } = await getRestaurantData(id);

  return (
    <RestaurantDetailClient
      initialRestaurant={restaurant}
      initialMenuItems={menuItems}
      restaurantId={id}
    />
  );
}
