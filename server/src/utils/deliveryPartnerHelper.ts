import Delivery from "../models/Delivery";

/**
 * Attaches masked delivery partner contact information ({ name: firstName, phone })
 * to active orders currently out for delivery or accepted by a delivery partner.
 * Never includes email, user ID, or sensitive internal fields.
 * No-ops for delivered, cancelled, or pending/placed orders.
 */
export async function attachDeliveryPartner(ordersInput: any): Promise<any> {
    if (!ordersInput) return ordersInput;
    const isArray = Array.isArray(ordersInput);
    const orderList: any[] = isArray ? ordersInput : [ordersInput];

    // Real statuses in models/Order.ts: "accepted_by_delivery", "on_the_way"
    // Also include common variants "out_for_delivery", "picked"
    const activeDeliveryStatuses = ["accepted_by_delivery", "on_the_way", "out_for_delivery", "picked"];

    const eligibleOrders = orderList.filter((order: any) =>
        order &&
        order.orderStatus &&
        activeDeliveryStatuses.includes(order.orderStatus) &&
        order.orderStatus !== "delivered" &&
        order.orderStatus !== "cancelled"
    );

    if (eligibleOrders.length === 0) {
        return ordersInput;
    }

    const orderIds = eligibleOrders.map((o: any) => o._id || o.id);

    // One batched query across all eligible orders
    const deliveries = await Delivery.find({
        order: { $in: orderIds },
        status: { $in: ["assigned", "picked", "on_the_way"] }
    })
        .populate("deliveryBoy", "name phone")
        .lean();

    const deliveryMap = new Map<string, { name: string; phone: string }>();

    for (const d of deliveries) {
        if (d.order && d.deliveryBoy) {
            const boy = d.deliveryBoy as any;
            const fullName = (boy.name || "").trim();
            const firstName = fullName.split(/\s+/)[0] || "Delivery Partner";
            const phone = boy.phone || "";
            deliveryMap.set(d.order.toString(), {
                name: firstName,
                phone
            });
        }
    }

    for (const order of eligibleOrders) {
        const orderIdStr = (order._id || order.id)?.toString();
        const partner = orderIdStr ? deliveryMap.get(orderIdStr) : undefined;
        if (partner) {
            order.deliveryPartner = partner;
        }
    }

    return ordersInput;
}

