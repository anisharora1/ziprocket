export function sanitizeOrderForRestaurant(order: any): any {
    if (!order) return order;
    const obj = typeof order.toObject === "function" ? order.toObject() : JSON.parse(JSON.stringify(order));
    delete obj.checkoutGroupId;
    delete obj.groupRole;
    delete obj.multiVendorFee;
    delete obj.sibling;
    delete obj.siblingOrder;
    delete obj.siblingSummary;
    delete obj.deliveryOtp;
    delete obj.moderator;

    if (Array.isArray(obj.items)) {
        obj.items = obj.items.filter((item: any) => !item.groceryItem);
    }
    return obj;
}

export function sanitizeOrderForGrocery(order: any): any {
    if (!order) return order;
    const obj = typeof order.toObject === "function" ? order.toObject() : JSON.parse(JSON.stringify(order));
    delete obj.restaurant;
    delete obj.multiVendorFee;
    delete obj.sibling;
    delete obj.siblingOrder;
    delete obj.siblingSummary;
    delete obj.deliveryOtp;

    if (Array.isArray(obj.items)) {
        obj.items = obj.items.filter((item: any) => !item.menuItem);
    }
    return obj;
}

export function buildRestaurantSocketPayload(event: string, order: any, extra: Record<string, any> = {}): any {
    const sanitizedOrder = sanitizeOrderForRestaurant(order);
    return {
        event,
        order: sanitizedOrder,
        orderId: (order._id || order.id)?.toString(),
        orderStatus: order.orderStatus,
        orderType: "food",
        restaurantId: (order.restaurant?._id || order.restaurant)?.toString(),
        userId: (order.user?._id || order.user)?.toString(),
        ...extra
    };
}

export function buildRestaurantPushPayload(order: any, title?: string, body?: string): any {
    const sanitized = sanitizeOrderForRestaurant(order);
    return {
        notification: {
            title: title || "New Food Order",
            body: body || `You have a new food order with ${sanitized.items?.length || 0} item(s).`
        },
        data: {
            orderId: (order._id || order.id)?.toString(),
            orderStatus: order.orderStatus,
            orderType: "food",
            itemTotal: String(sanitized.itemTotal || sanitized.totalAmount || 0)
        }
    };
}

