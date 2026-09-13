import Restaurant from "../models/Restaurant";
import * as restaurantCacheService from "../services/restaurantCacheService";

/**
 * Shared logic executed whenever an order reaches the "delivered" terminal state.
 * Increments restaurant's total fulfilled orders counter and invalidates cache.
 */
export async function handleOrderDelivered(order: any): Promise<void> {
    if (order.orderType === "food" && order.restaurant) {
        await Restaurant.findByIdAndUpdate(order.restaurant, { $inc: { totalOrders: 1 } });
        await restaurantCacheService.invalidateRestaurantCache(order.restaurant.toString());
    }
}
