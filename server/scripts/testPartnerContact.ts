process.env.REDIS_ENABLED = "false";

import Order from "../src/models/Order";
import Delivery from "../src/models/Delivery";
import Restaurant from "../src/models/Restaurant";
import User from "../src/models/User";
import * as redisService from "../src/services/redisService";
import { getUserOrders, getOrderById } from "../src/controllers/orderController";
import { attachDeliveryPartner } from "../src/utils/deliveryPartnerHelper";
import {
    sanitizeOrderForRestaurant,
    sanitizeOrderForGrocery,
    buildRestaurantSocketPayload,
    buildRestaurantPushPayload
} from "../src/utils/orderSanitizer";

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

// In-memory mock stores
const mockOrders: Record<string, any> = {};
const mockDeliveries: Record<string, any> = {};
let lastCachedData: Record<string, any> = {};

function setupMocks() {
    // Intercept redisService setJson and getJson
    (redisService as any).setJson = async (key: string, data: any, ttl?: number) => {
        lastCachedData[key] = JSON.parse(JSON.stringify(data));
        return true;
    };
    (redisService as any).getJson = async (key: string) => {
        return lastCachedData[key] ? JSON.parse(JSON.stringify(lastCachedData[key])) : null;
    };
    (redisService as any).del = async (key: string) => {
        delete lastCachedData[key];
        return 1;
    };
    (redisService as any).deletePattern = async () => {
        return 1;
    };

    // Stub Order.find
    (Order as any).find = (query: any) => {
        let results = Object.values(mockOrders);
        if (query.user) {
            results = results.filter((o: any) => String(o.user?._id || o.user) === String(query.user));
        }
        return {
            populate: function () {
                return this;
            },
            sort: function () {
                return this;
            },
            skip: function () {
                return this;
            },
            limit: function () {
                return this;
            },
            lean: async function () {
                return JSON.parse(JSON.stringify(results));
            }
        };
    };

    // Stub Order.countDocuments
    (Order as any).countDocuments = async (query: any) => {
        let results = Object.values(mockOrders);
        if (query.user) {
            results = results.filter((o: any) => String(o.user?._id || o.user) === String(query.user));
        }
        return results.length;
    };

    // Stub Order.findById
    (Order as any).findById = (id: any) => {
        const key = id?.toString ? id.toString() : String(id);
        const order = mockOrders[key];
        return {
            populate: function () {
                return this;
            },
            lean: async function () {
                return order ? JSON.parse(JSON.stringify(order)) : null;
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
            }
        };
    };

    // Stub Delivery.find
    (Delivery as any).find = (query: any) => {
        let results = Object.values(mockDeliveries);
        if (query.order && query.order.$in) {
            const ids = query.order.$in.map((id: any) => id?.toString ? id.toString() : String(id));
            results = results.filter((d: any) => ids.includes(String(d.order)));
        }
        if (query.status && query.status.$in) {
            results = results.filter((d: any) => query.status.$in.includes(d.status));
        }
        return {
            populate: function () {
                return this;
            },
            lean: async function () {
                return JSON.parse(JSON.stringify(results));
            }
        };
    };

    // Stub Delivery.findOne
    (Delivery as any).findOne = (query: any) => {
        let results = Object.values(mockDeliveries);
        if (query.order) {
            const ordKey = query.order?.toString ? query.order.toString() : String(query.order);
            results = results.filter((d: any) => String(d.order) === ordKey);
        }
        if (query.deliveryBoy) {
            const boyKey = query.deliveryBoy?.toString ? query.deliveryBoy.toString() : String(query.deliveryBoy);
            results = results.filter((d: any) => String(d.deliveryBoy?._id || d.deliveryBoy) === boyKey);
        }
        const found = results[0] || null;
        return {
            select: function () {
                return this;
            },
            lean: async function () {
                return found ? JSON.parse(JSON.stringify(found)) : null;
            }
        };
    };

    // Stub Restaurant.findById
    (Restaurant as any).findById = (id: any) => {
        return {
            select: function () {
                return this;
            },
            lean: async function () {
                return { _id: id, owner: "seller_123" };
            }
        };
    };

    // Stub User.findById
    (User as any).findById = (id: any) => {
        return {
            select: function () {
                return this;
            },
            lean: async function () {
                return { _id: id, assignedZones: [] };
            }
        };
    };
}

function createMockReqRes(params: any = {}, user: any = {}, query: any = {}) {
    let statusCode = 200;
    let jsonBody: any = null;

    const req: any = {
        params,
        user,
        query,
        ip: "127.0.0.1"
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
    console.log("=== Running Delivery Partner Contact & Security Test Suite ===\n");
    setupMocks();

    const CUST_A = "65a00000000000000000000a";
    const CUST_B = "65b00000000000000000000b";
    const ADMIN = "65c00000000000000000000c";

    // Populate order for Customer B
    mockOrders["order_b_1"] = {
        _id: "order_b_1",
        user: { _id: CUST_B, name: "Customer B", phone: "9876543210" },
        restaurant: { _id: "rest_1", name: "Spice Kitchen" },
        orderType: "food",
        orderStatus: "accepted_by_delivery",
        totalAmount: 350,
        items: [{ menuItem: "m1", quantity: 1, price: 350 }]
    };

    mockDeliveries["deliv_b_1"] = {
        _id: "deliv_b_1",
        order: "order_b_1",
        deliveryBoy: {
            _id: "rider_55",
            name: "Vikas Sharma",
            phone: "9811122233",
            email: "vikas@secret.com"
        },
        status: "assigned"
    };

    // ─────────────────────────────────────────────────────────────────
    // TEST 1: Customer A cannot read Customer B's orders (403)
    // ─────────────────────────────────────────────────────────────────
    {
        const { req, res, getStatus, getJson } = createMockReqRes(
            { userId: CUST_B },
            { _id: CUST_A, role: "customer" }
        );
        await getUserOrders(req, res);

        const status = getStatus();
        const json = getJson();
        report(
            "customer A cannot read customer B's orders (403)",
            status === 403 && json?.success === false && json?.message === "Unauthorized",
            `status=${status}, message="${json?.message}"`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: Admin can read Customer B's orders
    // ─────────────────────────────────────────────────────────────────
    {
        const { req, res, getStatus, getJson } = createMockReqRes(
            { userId: CUST_B },
            { _id: ADMIN, role: "admin" }
        );
        await getUserOrders(req, res);

        const status = getStatus();
        const json = getJson();
        report(
            "admin can read customer B's orders (200)",
            status === 200 && json?.success === true && Array.isArray(json?.orders) && json.orders.length > 0,
            `status=${status}, ordersCount=${json?.orders?.length}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: deliveryPartner appears only while order is accepted/active
    // and is absent when delivered or cancelled
    // ─────────────────────────────────────────────────────────────────
    {
        // 3a: Active order (accepted_by_delivery / on_the_way)
        const activeOrder1 = {
            _id: "order_act_1",
            orderStatus: "accepted_by_delivery"
        };
        const activeOrder2 = {
            _id: "order_act_2",
            orderStatus: "on_the_way"
        };
        const deliveredOrder = {
            _id: "order_term_1",
            orderStatus: "delivered"
        };
        const cancelledOrder = {
            _id: "order_term_2",
            orderStatus: "cancelled"
        };
        const placedOrder = {
            _id: "order_pre_1",
            orderStatus: "placed"
        };

        mockDeliveries["deliv_act_1"] = {
            order: "order_act_1",
            deliveryBoy: { name: "Rajesh Kumar Verma", phone: "9800011122", email: "rajesh@internal.com" },
            status: "assigned"
        };
        mockDeliveries["deliv_act_2"] = {
            order: "order_act_2",
            deliveryBoy: { name: "Amit Singh", phone: "9800033344", email: "amit@internal.com" },
            status: "on_the_way"
        };
        mockDeliveries["deliv_term_1"] = {
            order: "order_term_1",
            deliveryBoy: { name: "Suresh", phone: "9800055566" },
            status: "delivered"
        };

        const batch = [activeOrder1, activeOrder2, deliveredOrder, cancelledOrder, placedOrder];
        await attachDeliveryPartner(batch);

        const act1HasPartner =
            (activeOrder1 as any).deliveryPartner?.name === "Rajesh" &&
            (activeOrder1 as any).deliveryPartner?.phone === "9800011122" &&
            (activeOrder1 as any).deliveryPartner?.email === undefined &&
            (activeOrder1 as any).deliveryPartner?._id === undefined;

        const act2HasPartner =
            (activeOrder2 as any).deliveryPartner?.name === "Amit" &&
            (activeOrder2 as any).deliveryPartner?.phone === "9800033344";

        const deliveredHasNoPartner = (deliveredOrder as any).deliveryPartner === undefined;
        const cancelledHasNoPartner = (cancelledOrder as any).deliveryPartner === undefined;
        const placedHasNoPartner = (placedOrder as any).deliveryPartner === undefined;

        report(
            "deliveryPartner appears only while order is accepted/active and is absent when delivered or cancelled",
            act1HasPartner && act2HasPartner && deliveredHasNoPartner && cancelledHasNoPartner && placedHasNoPartner,
            `act1Name="${(activeOrder1 as any).deliveryPartner?.name}", deliveredHasPartner=${!deliveredHasNoPartner}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: Restaurant payload never contains deliveryPartner
    // ─────────────────────────────────────────────────────────────────
    {
        const orderWithPartner = {
            _id: "order_test_rest",
            restaurant: "rest_1",
            orderType: "food",
            orderStatus: "accepted_by_delivery",
            totalAmount: 400,
            deliveryPartner: { name: "Vikas", phone: "9811122233" },
            items: [
                { menuItem: "m1", name: "Paneer Curry", price: 200, quantity: 2 },
                { groceryItem: "g1", name: "Basmati Rice", price: 100, quantity: 1 }
            ]
        };

        const restSanitized = sanitizeOrderForRestaurant(orderWithPartner);
        const grocSanitized = sanitizeOrderForGrocery(orderWithPartner);
        const socketPayload = buildRestaurantSocketPayload("order_status_updated", orderWithPartner);
        const pushPayload = buildRestaurantPushPayload(orderWithPartner);

        const restJson = JSON.stringify(restSanitized);
        const grocJson = JSON.stringify(grocSanitized);
        const socketJson = JSON.stringify(socketPayload);
        const pushJson = JSON.stringify(pushPayload);

        const partnerAbsentFromRest = !restJson.includes("9811122233") && restSanitized.deliveryPartner === undefined;
        const partnerAbsentFromGroc = !grocJson.includes("9811122233") && grocSanitized.deliveryPartner === undefined;
        const partnerAbsentFromSocket = !socketJson.includes("9811122233") && socketPayload.order?.deliveryPartner === undefined && socketPayload.deliveryPartner === undefined;
        const partnerAbsentFromPush = !pushJson.includes("9811122233") && pushPayload.data?.deliveryPartner === undefined;

        report(
            "a restaurant payload never contains deliveryPartner",
            partnerAbsentFromRest && partnerAbsentFromGroc && partnerAbsentFromSocket && partnerAbsentFromPush,
            `restHasPartner=${!partnerAbsentFromRest}, grocHasPartner=${!partnerAbsentFromGroc}, socketHasPartner=${!partnerAbsentFromSocket}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 5: The cached list response never contains the phone number
    // ─────────────────────────────────────────────────────────────────
    {
        // Clear cache and call getUserOrders on cache miss for Customer B
        lastCachedData = {};
        const { req, res, getStatus, getJson } = createMockReqRes(
            { userId: CUST_B },
            { _id: CUST_B, role: "customer" },
            { page: "1", limit: "20" }
        );
        await getUserOrders(req, res);

        const resBody = getJson();
        const cacheKey = `order:user_recent:${CUST_B}:p1:l20`;
        const rawCachedData = lastCachedData[cacheKey];

        const cachedJson = JSON.stringify(rawCachedData || {});
        const responseJson = JSON.stringify(resBody || {});

        const phoneInResponse = responseJson.includes("9811122233");
        const phoneInCache = cachedJson.includes("9811122233");
        const partnerInCache = cachedJson.includes("deliveryPartner");

        report(
            "the cached list response never contains the phone number",
            getStatus() === 200 && phoneInResponse && !phoneInCache && !partnerInCache,
            `phoneInResponse=${phoneInResponse}, phoneInCache=${phoneInCache}, partnerInCache=${partnerInCache}`
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // TEST 6: Mixed order getOrderById provides deliveryPartner for both siblings
    // ─────────────────────────────────────────────────────────────────
    {
        const GROUP_ID = "group_mixed_contact_999";
        mockOrders["food_sibling"] = {
            _id: "food_sibling",
            checkoutGroupId: GROUP_ID,
            groupRole: "food",
            orderType: "food",
            orderStatus: "accepted_by_delivery",
            user: { _id: CUST_B },
            restaurant: { _id: "rest_1", name: "Burger Town" },
            totalAmount: 250
        };
        mockOrders["groc_sibling"] = {
            _id: "groc_sibling",
            checkoutGroupId: GROUP_ID,
            groupRole: "grocery",
            orderType: "grocery",
            orderStatus: "accepted_by_delivery",
            user: { _id: CUST_B },
            deliveryZone: { _id: "zone_1", name: "Sector 1 Hub" },
            totalAmount: 150
        };

        mockDeliveries["deliv_food_sibling"] = {
            order: "food_sibling",
            deliveryBoy: { name: "Sunil Grover", phone: "9822233344" },
            status: "assigned"
        };
        mockDeliveries["deliv_groc_sibling"] = {
            order: "groc_sibling",
            deliveryBoy: { name: "Sunil Grover", phone: "9822233344" },
            status: "assigned"
        };

        const { req, res, getStatus, getJson } = createMockReqRes(
            { id: "food_sibling" },
            { _id: CUST_B, role: "customer" }
        );
        await getOrderById(req, res);

        const status = getStatus();
        const json = getJson();
        const mainPartner = json?.order?.deliveryPartner;
        const siblingPartner = json?.order?.sibling?.deliveryPartner;

        const mainHasPartner = mainPartner?.name === "Sunil" && mainPartner?.phone === "9822233344";
        const siblingHasPartner = siblingPartner?.name === "Sunil" && siblingPartner?.phone === "9822233344";

        report(
            "mixed order getOrderById provides deliveryPartner for both siblings",
            status === 200 && mainHasPartner && siblingHasPartner,
            `mainName="${mainPartner?.name}", siblingName="${siblingPartner?.name}"`
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

