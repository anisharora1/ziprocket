import { apiClient } from "./api";

export const getAllRestaurants = async (status = 'approved', zoneId?: string | null) => {
  try {
    const query = new URLSearchParams();
    if (status) query.append("status", status);
    if (zoneId) query.append("deliveryZone", zoneId);
    
    // Customers should typically see active approved restaurants
    query.append("isActive", "true");

    const response = await apiClient.get(`/restaurants?${query.toString()}`);
    return response.data.restaurants || [];
  } catch (error) {
    console.error("Failed to fetch restaurants:", error);
    return [];
  }
};
