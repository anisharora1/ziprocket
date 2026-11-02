process.env.REDIS_ENABLED = "false";

import Delivery from "../src/models/Delivery";
import Order from "../src/models/Order";
import Restaurant from "../src/models/Restaurant";
import { deliverOrder, populateSiblingForDelivery } from "../src/controllers/deliveryController";

let passCount = 0;
let failCount = 0;

function report(testName: string, passed: boolean, details?: string) {
    if (passed) {
        passCount++;
        console.log(`[PASS] ${testName}${details ? ` - ${details}` : ""}`);
    } else {
        failCount++;
        console.error(`[FAIL] ${testName}${details ? ` - ${details}` : ""}`);
    }
}

// In-memory mock store
const mockOrders: Record<string, any> = {};
const mockDeliveries: Record<string, any> = {};
let restaurantIncCalls = 0;

function setupMocks() {
    // Stub Order.findById
    (Order as any).findById = async (id: any) => {
        const key = id?.toString ? id.toString() : String(id);
        const order = mockOrders[key];
        if (!order) return null;
        return {
            ...order,
            save: async function () {
                Object.assign(order, this);
                return order;
            }
        };
    };

    // Stub Order.findOne
    (Order as any).findOne = (query: any) => {
        let results = Object.values(mockOrders);
        if (query.checkoutGroupId) {
            results = results.filter((o: any) => o.checkoutGroupId === query.checkoutGroupId);
        }
        if (query._id && query._id.$ne) {
            const neId = query._id.$ne?.toString ? query._id.$ne.toString() : String(query._id.$ne);
            results = results.filter((o: any) => String(o._id) !== neId);
        }
        const found = results[0] || null;
        return {
            populate: function () {
                return this;
            },
            lean: async function () {
                return found ? JSON.parse(JSON.stringify(found)) : null;
            },
            then: (resolve: any) => resolve(found ? {
                ...found,
                save: async function () {
                    Object.assign(found, this);
                    return found;
                }
            } : null)
        };
    };

    // Stub Delivery.findOne
    (Delivery as any).findOne = async (query: any) => {
        const orderKey = query.order?.toString ? query.order.toString() : String(query.order);
        const riderKey = query.deliveryBoy?.toString ? query.deliveryBoy.toString() : String(query.deliveryBoy);
        const deliv = Object.values(mockDeliveries).find((d: any) =>
            String(d.order) === orderKey && String(d.deliveryBoy) === riderKey
        );
        if (!deliv) return null;
        return {
            ...deliv,
            save: async function () {
                Object.assign(deliv, this);
                return deliv;
            }
        };
    };

    // Stub Restaurant.findByIdAndUpdate to track order completion count
    (Restaurant as any).findByIdAndUpdate = async (_id: any, update: any) => {
        if (update && update.$inc && update.$inc.totalOrders) {
            restaurantIncCalls += update.$inc.totalOrders;
        }
        return { _id };
    };
}

function createMockReqRes(body: any, userId = "rider_1") {
    let statusCode = 200;
    let jsonBody: any = null;

    const req: any = {
        body,
        user: { _id: userId }
    };

    const res: any = {
        status: (code: number) => {
            statusCode = code;
            return res;
        },
        json: (data: any) => {
            jsonBody = data;
            return res;
        }
    };

    return { req, res, getStatus: () => statusCode, getJson: () => jsonBody };
}

async function runTests() {
    console.log("=== Running Mixed Delivery Completion Test Suite ===\n");
    setupMocks();

    // ─────────────────────────────────────────────────────────────────
    // TEST 1: Delivering a COD group marks both delivered once
    // ─────────────────────────────────────────────────────────────────
    {
        mockOrders["food_1"] = {
            _id: "food_1",
            checkoutGroupId: "group_cod_101",
            orderType: "food",
            groupRole: "food",
            restaurant: "rest_1",
            user: "cust_1",
            paymentMethod: "COD",
            paymentStatus: "pending",
            orderStatus: "accepted_by_delivery",
            totalAmount: 260,
            items: [{ menuItem: "m1", quantity: 2, price: 130 }],
            deliveryOtp: undefined
        };
        mockOrders["groc_1"] = {
            _id: "groc_1",
            checkoutGroupId: "group_cod_101",
            orderType: "grocery",
            groupRole: "grocery",
            deliveryZone: "zone_1",
            user: "cust_1",
            paymentMethod: "COD",
            paymentStatus: "pending",
            orderStatus: "accepted_by_delivery",
            totalAmount: 140,
            items: [{ groceryItem: "g1", quantity: 1, price: 140 }],
            deliveryOtp: undefined
        };
        mockDeliveries["deliv_food_1"] = {
            _id: "deliv_food_1",
            order: "food_1",
            deliveryBoy: "rider_1",
            status: "assigned"
        };
        mockDeliveries["deliv_groc_1"] = {
            _id: "deliv_groc_1",
            order: "groc_1",
            deliveryBoy: "rider_1",
            status: "assigned"
        };

        const initialIncCount = restaurantIncCalls;
        const { req, res, getStatus, getJson } = createMockReqRes({ orderId: "food_1" });
        await deliverOrder(req, res);

        const status = getStatus();
        const json = getJson();
        const foodOrderDelivered = mockOrders["food_1"].orderStatus === "delivered" && mockOrders["food_1"].paymentStatus === "paid";
        const grocOrderDelivered = mockOrders["groc_1"].orderStatus === "delivered" && mockOrders["groc_1"].paymentStatus === "paid";
        const foodDelivDelivered = mockDeliveries["deliv_food_1"].status === "delivered";
        const grocDelivDelivered = mockDeliveries["deliv_groc_1"].status === "delivered";
        const restInc = restaurantIncCalls === initialIncCount + 1;

        report(
            "delivering a COD group marks both delivered once",
            status === 200 && json?.success === true &&
            foodOrderDelivered && grocOrderDelivered &&
            foodDelivDelivered && grocDelivDelivered && restInc,
            `status=${status}, foodStatus=${mockOrders["food_1"].orderStatus}, grocStatus=${mockOrders["groc_1"].orderStatus}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: OTP wrong -> neither delivered
    // ─────────────────────────────────────────────────────────────────
    {
        mockOrders["food_2"] = {
            _id: "food_2",
            checkoutGroupId: "group_online_202",
            orderType: "food",
            groupRole: "food",
            restaurant: "rest_2",
            user: "cust_2",
            paymentMethod: "ONLINE",
            paymentStatus: "paid",
            orderStatus: "accepted_by_delivery",
            totalAmount: 300,
            items: [{ menuItem: "m2", quantity: 1, price: 300 }],
            deliveryOtp: "4567"
        };
        mockOrders["groc_2"] = {
            _id: "groc_2",
            checkoutGroupId: "group_online_202",
            orderType: "grocery",
            groupRole: "grocery",
            deliveryZone: "zone_2",
            user: "cust_2",
            paymentMethod: "ONLINE",
            paymentStatus: "paid",
            orderStatus: "accepted_by_delivery",
            totalAmount: 200,
            items: [{ groceryItem: "g2", quantity: 2, price: 100 }],
            deliveryOtp: "4567"
        };
        mockDeliveries["deliv_food_2"] = {
            _id: "deliv_food_2",
            order: "food_2",
            deliveryBoy: "rider_1",
            status: "assigned"
        };
        mockDeliveries["deliv_groc_2"] = {
            _id: "deliv_groc_2",
            order: "groc_2",
            deliveryBoy: "rider_1",
            status: "assigned"
        };

        const { req, res, getStatus } = createMockReqRes({ orderId: "food_2", otp: "0000" });
        await deliverOrder(req, res);

        const status = getStatus();
        const neitherDelivered =
            mockOrders["food_2"].orderStatus === "accepted_by_delivery" &&
            mockOrders["groc_2"].orderStatus === "accepted_by_delivery" &&
            mockDeliveries["deliv_food_2"].status === "assigned" &&
            mockDeliveries["deliv_groc_2"].status === "assigned";

        report(
            "OTP wrong -> neither delivered",
            status === 400 && neitherDelivered,
            `status=${status}, foodDeliveryStatus=${mockDeliveries["deliv_food_2"].status}, grocDeliveryStatus=${mockDeliveries["deliv_groc_2"].status}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: Sibling cancelled -> only the tapped order delivered
    // ─────────────────────────────────────────────────────────────────
    {
        mockOrders["food_3"] = {
            _id: "food_3",
            checkoutGroupId: "group_cod_303",
            orderType: "food",
            groupRole: "food",
            restaurant: "rest_3",
            user: "cust_3",
            paymentMethod: "COD",
            paymentStatus: "pending",
            orderStatus: "accepted_by_delivery",
            totalAmount: 220,
            items: [{ menuItem: "m3", quantity: 1, price: 220 }],
            deliveryOtp: undefined
        };
        mockOrders["groc_3"] = {
            _id: "groc_3",
            checkoutGroupId: "group_cod_303",
            orderType: "grocery",
            groupRole: "grocery",
            deliveryZone: "zone_3",
            user: "cust_3",
            paymentMethod: "COD",
            paymentStatus: "pending",
            orderStatus: "cancelled", // cancelled by moderator/customer
            totalAmount: 110,
            items: [{ groceryItem: "g3", quantity: 1, price: 110 }],
            deliveryOtp: undefined
        };
        mockDeliveries["deliv_food_3"] = {
            _id: "deliv_food_3",
            order: "food_3",
            deliveryBoy: "rider_1",
            status: "assigned"
        };
        mockDeliveries["deliv_groc_3"] = {
            _id: "deliv_groc_3",
            order: "groc_3",
            deliveryBoy: "rider_1",
            status: "assigned"
        };

        const { req, res, getStatus } = createMockReqRes({ orderId: "food_3" });
        await deliverOrder(req, res);

        const status = getStatus();
        const tappedDelivered = mockOrders["food_3"].orderStatus === "delivered" && mockDeliveries["deliv_food_3"].status === "delivered";
        const siblingNotDelivered = mockOrders["groc_3"].orderStatus === "cancelled" && mockDeliveries["deliv_groc_3"].status === "assigned";

        report(
            "sibling cancelled -> only the tapped order delivered",
            status === 200 && tappedDelivered && siblingNotDelivered,
            `foodStatus=${mockOrders["food_3"].orderStatus}, grocStatus=${mockOrders["groc_3"].orderStatus}, grocDeliv=${mockDeliveries["deliv_groc_3"].status}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: Retrying deliverOrder does not double-count
    // ─────────────────────────────────────────────────────────────────
    {
        // food_1 and groc_1 are already delivered from TEST 1
        const incCallsBefore = restaurantIncCalls;
        const { req, res, getStatus, getJson } = createMockReqRes({ orderId: "food_1" });
        await deliverOrder(req, res);

        const status = getStatus();
        const json = getJson();
        const noDoubleCount = restaurantIncCalls === incCallsBefore;
        const bothDelivered =
            mockOrders["food_1"].orderStatus === "delivered" &&
            mockOrders["groc_1"].orderStatus === "delivered" &&
            mockDeliveries["deliv_food_1"].status === "delivered" &&
            mockDeliveries["deliv_groc_1"].status === "delivered";

        report(
            "retrying deliverOrder does not double-count",
            status === 200 && json?.success === true && noDoubleCount && bothDelivered,
            `restaurantIncCallsBefore=${incCallsBefore}, after=${restaurantIncCalls}, status=${status}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 5: Cash totals match the customer's grand total
    // ─────────────────────────────────────────────────────────────────
    {
        // Mixed COD order: food 260 + grocery 140 = 400
        const foodOrder = mockOrders["food_1"];
        const grocOrder = mockOrders["groc_1"];
        const customerGrandTotal = foodOrder.totalAmount + grocOrder.totalAmount; // 400

        // Test populateSiblingForDelivery computes groupCodAmount and groupItemCount accurately
        const foodPopulated = await populateSiblingForDelivery(foodOrder);
        const grocPopulated = await populateSiblingForDelivery(grocOrder);

        const groupCodMatches = foodPopulated.groupCodAmount === customerGrandTotal && grocPopulated.groupCodAmount === customerGrandTotal;
        const groupItemsMatches = foodPopulated.groupItemCount === (2 + 1) && grocPopulated.groupItemCount === (2 + 1);

        // Test delivery ops aggregation logic: each delivered order contributes its totalAmount once
        const deliveredRecords = [
            { order: mockOrders["food_1"], status: "delivered" },
            { order: mockOrders["groc_1"], status: "delivered" }
        ];

        const cashCollectedToday = deliveredRecords.reduce((sum, d: any) => {
            return sum + (d.order?.paymentMethod === "COD" ? (d.order.totalAmount || 0) : 0);
        }, 0);

        report(
            "cash totals match the customer's grand total",
            groupCodMatches && groupItemsMatches && cashCollectedToday === customerGrandTotal,
            `customerGrandTotal=${customerGrandTotal}, groupCodAmount=${foodPopulated.groupCodAmount}, cashCollectedToday=${cashCollectedToday}`
        );
    }

    console.log("\n========================================");
    console.log(`Summary: ${passCount} PASSED, ${failCount} FAILED`);
    console.log("========================================\n");

    process.exit(failCount === 0 ? 0 : 1);
}

runTests().catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
});

