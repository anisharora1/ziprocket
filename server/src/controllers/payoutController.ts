import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../models/Order";
import Delivery from "../models/Delivery";
import Restaurant from "../models/Restaurant";
import User from "../models/User";
import Payout from "../models/Payout";
import GroceryProduct from "../models/GroceryProduct";

// Helper: Calculate 3-day rolling settlement period anchored to fixed epoch
export function getSettlementPeriod(referenceDate: Date) {
    // Anchor 3-day cycles to a fixed epoch so periods are consistent and non-overlapping regardless of when this runs
    const epoch = new Date("2026-01-01T00:00:00Z");
    const msPerCycle = 3 * 24 * 60 * 60 * 1000;
    const cyclesSinceEpoch = Math.floor((referenceDate.getTime() - epoch.getTime()) / msPerCycle);
    const periodStart = new Date(epoch.getTime() + cyclesSinceEpoch * msPerCycle);
    const periodEnd = new Date(periodStart.getTime() + msPerCycle - 1);
    const identifier = `${periodStart.toISOString().split("T")[0]}_${periodEnd.toISOString().split("T")[0]}`;
    return { periodStart, periodEnd, identifier };
}

// --- CORE SETTLEMENT CALCULATION ENGINE ---
// Callable by both the scheduled job and manual admin triggers
export async function runSettlementCalculation(targetDate?: Date): Promise<{
    identifier: string;
    periodStart: Date;
    periodEnd: Date;
    restaurantPayoutsCount: number;
    riderPayoutsCount: number;
    groceryProcessed: boolean;
}> {
    // Default to the previous 3-day cycle if not explicitly specified
    const refDate = targetDate || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const { periodStart, periodEnd, identifier } = getSettlementPeriod(refDate);

    console.log(`[Settlement Engine] Calculating settlements for period ${identifier} (${periodStart.toISOString()} to ${periodEnd.toISOString()})`);

    // 1. Fetch delivered orders within the 3-day settlement period using deliveredAt (with createdAt fallback for legacy orders)
    const periodOrders = await Order.find({
        orderStatus: "delivered",
        $or: [
            { deliveredAt: { $gte: periodStart, $lte: periodEnd } },
            { deliveredAt: { $exists: false }, createdAt: { $gte: periodStart, $lte: periodEnd } },
            { deliveredAt: null, createdAt: { $gte: periodStart, $lte: periodEnd } }
        ]
    }).populate("restaurant");

    // --- A. RESTAURANT SETTLEMENTS ---
    const restaurantOrdersMap = new Map<string, any[]>();
    periodOrders.forEach(order => {
        if (order.orderType === "food" && order.restaurant) {
            const restId = order.restaurant._id ? order.restaurant._id.toString() : order.restaurant.toString();
            const list = restaurantOrdersMap.get(restId) || [];
            list.push(order);
            restaurantOrdersMap.set(restId, list);
        }
    });

    const allRestaurants = await Restaurant.find();
    let restaurantPayoutsCount = 0;

    for (const rest of allRestaurants) {
        const restId = rest._id.toString();
        const orders = restaurantOrdersMap.get(restId) || [];
        const totalOrders = orders.length;

        let totalItemRevenue = 0;
        let codCollected = 0;
        let onlinePayments = 0;

        // CRITICAL FIX: Sum pure item value (price * quantity), not totalAmount (which includes delivery, platform fee, GST, packaging)
        orders.forEach(o => {
            const orderItemValue = (o.items || []).reduce((sum: number, item: any) => {
                return sum + ((item.price || 0) * (item.quantity || 1));
            }, 0);
            totalItemRevenue += orderItemValue;

            if (o.paymentMethod === "COD") {
                codCollected += orderItemValue;
            } else {
                onlinePayments += orderItemValue;
            }
        });

        const commissionRate = rest.commission !== undefined ? rest.commission : 10;
        const platformCommission = Math.round((totalItemRevenue * commissionRate) / 100);
        const refundsAndAdjustments = 0; // Populate from real refund/dispute source once available
        const finalPayoutAmount = totalItemRevenue - platformCommission - refundsAndAdjustments;

        const existingPayout = await Payout.findOne({
            recipientType: "restaurant",
            restaurant: rest._id,
            periodIdentifier: identifier
        });

        if (existingPayout && existingPayout.status === "paid") {
            // Do NOT touch already-"paid" payouts — skip and warn if amounts differ
            if (existingPayout.finalPayoutAmount !== finalPayoutAmount) {
                console.warn(`[Payout Mismatch] Restaurant ${rest._id}, period ${identifier}: recalculated amount (₹${finalPayoutAmount}) differs from already-paid amount (₹${existingPayout.finalPayoutAmount}). Skipped update — investigate manually.`);
            }
            continue;
        }

        // Upsert pending/processing payout document with accurate item total
        await Payout.findOneAndUpdate(
            { recipientType: "restaurant", restaurant: rest._id, periodIdentifier: identifier },
            {
                periodStartDate: periodStart,
                periodEndDate: periodEnd,
                periodIdentifier: identifier,
                totalOrders,
                totalRevenue: totalItemRevenue,
                platformCommission,
                refundsAndAdjustments,
                codCollected,
                onlinePayments,
                finalPayoutAmount,
                $setOnInsert: {
                    status: "pending",
                    auditLogs: [{ status: "pending", updatedBy: "System", notes: "Settlement calculated." }]
                }
            },
            { upsert: true, new: true }
        );
        restaurantPayoutsCount++;
    }

    // --- B. DELIVERY PERSONNEL SETTLEMENTS ---
    const periodDeliveries = await Delivery.find({
        status: "delivered",
        $or: [
            { updatedAt: { $gte: periodStart, $lte: periodEnd } },
            { createdAt: { $gte: periodStart, $lte: periodEnd } }
        ]
    }).populate("order");

    const riderDeliveriesMap = new Map<string, any[]>();
    periodDeliveries.forEach(delivery => {
        if (delivery.deliveryBoy) {
            const riderId = delivery.deliveryBoy.toString();
            const list = riderDeliveriesMap.get(riderId) || [];
            list.push(delivery);
            riderDeliveriesMap.set(riderId, list);
        }
    });

    const allRiders = await User.find({ role: "delivery" });
    let riderPayoutsCount = 0;

    for (const rider of allRiders) {
        const riderId = rider._id.toString();
        const deliveries = riderDeliveriesMap.get(riderId) || [];
        const totalOrders = deliveries.length;
        let totalEarnings = 0;
        let codCollected = 0;

        deliveries.forEach(d => {
            totalEarnings += d.earnings || 0;
            const orderDoc = d.order as any;
            if (orderDoc && orderDoc.paymentMethod === "COD") {
                codCollected += orderDoc.totalAmount || 0;
            }
        });

        const finalPayoutAmount = totalEarnings;

        const existingPayout = await Payout.findOne({
            recipientType: "delivery",
            deliveryBoy: rider._id,
            periodIdentifier: identifier
        });

        if (existingPayout && existingPayout.status === "paid") {
            if (existingPayout.finalPayoutAmount !== finalPayoutAmount) {
                console.warn(`[Payout Mismatch] Delivery ${rider._id}, period ${identifier}: recalculated amount (₹${finalPayoutAmount}) differs from already-paid amount (₹${existingPayout.finalPayoutAmount}). Skipped update — investigate manually.`);
            }
            continue;
        }

        await Payout.findOneAndUpdate(
            { recipientType: "delivery", deliveryBoy: rider._id, periodIdentifier: identifier },
            {
                periodStartDate: periodStart,
                periodEndDate: periodEnd,
                periodIdentifier: identifier,
                totalOrders,
                totalRevenue: totalEarnings,
                platformCommission: 0,
                refundsAndAdjustments: 0,
                codCollected,
                onlinePayments: 0,
                finalPayoutAmount,
                $setOnInsert: {
                    status: "pending",
                    auditLogs: [{ status: "pending", updatedBy: "System", notes: "Settlement calculated." }]
                }
            },
            { upsert: true, new: true }
        );
        riderPayoutsCount++;
    }

    // --- C. GROCERY PLATFORM SALES REVENUE ---
    const groceryOrders = periodOrders.filter(o => o.orderType === "grocery");
    const totalGroceryOrders = groceryOrders.length;
    let totalGrocerySales = 0;
    let groceryCodCollected = 0;
    let groceryOnlinePayments = 0;

    groceryOrders.forEach(o => {
        const orderItemValue = (o.items || []).reduce((sum: number, item: any) => {
            return sum + ((item.price || 0) * (item.quantity || 1));
        }, 0);
        totalGrocerySales += orderItemValue;

        if (o.paymentMethod === "COD") {
            groceryCodCollected += orderItemValue;
        } else {
            groceryOnlinePayments += orderItemValue;
        }
    });

    const groceryProfit = Math.round(totalGrocerySales * 0.20);
    const finalGroceryPayout = totalGrocerySales - groceryProfit;

    const existingGroceryPayout = await Payout.findOne({ recipientType: "grocery", periodIdentifier: identifier });
    let groceryProcessed = false;

    if (existingGroceryPayout && existingGroceryPayout.status === "paid") {
        if (existingGroceryPayout.finalPayoutAmount !== finalGroceryPayout) {
            console.warn(`[Payout Mismatch] Grocery, period ${identifier}: recalculated amount (₹${finalGroceryPayout}) differs from already-paid amount (₹${existingGroceryPayout.finalPayoutAmount}). Skipped update — investigate manually.`);
        }
    } else {
        await Payout.findOneAndUpdate(
            { recipientType: "grocery", periodIdentifier: identifier },
            {
                periodStartDate: periodStart,
                periodEndDate: periodEnd,
                periodIdentifier: identifier,
                totalOrders: totalGroceryOrders,
                totalRevenue: totalGrocerySales,
                platformCommission: groceryProfit,
                refundsAndAdjustments: 0,
                codCollected: groceryCodCollected,
                onlinePayments: groceryOnlinePayments,
                finalPayoutAmount: finalGroceryPayout,
                isEstimatedMargin: true,
                $setOnInsert: {
                    status: "pending",
                    auditLogs: [{ status: "pending", updatedBy: "System", notes: "Settlement calculated." }]
                }
            },
            { upsert: true, new: true }
        );
        groceryProcessed = true;
    }

    return {
        identifier,
        periodStart,
        periodEnd,
        restaurantPayoutsCount,
        riderPayoutsCount,
        groceryProcessed
    };
}

// --- CONTROLLER: CALCULATE SETTLEMENTS (Admin Endpoint) ---
export const calculateSettlements = async (req: Request, res: Response): Promise<void> => {
    try {
        const { date } = req.body;
        const targetDate = date ? new Date(date) : undefined;
        const result = await runSettlementCalculation(targetDate);

        res.status(200).json({
            success: true,
            message: `3-day settlements for cycle ${result.identifier} calculated successfully!`,
            periodIdentifier: result.identifier,
            period: { start: result.periodStart, end: result.periodEnd },
            summary: {
                restaurants: result.restaurantPayoutsCount,
                riders: result.riderPayoutsCount,
                grocery: result.groceryProcessed
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Aliased for backwards compatibility
export const calculateWeeklyPayouts = calculateSettlements;

// --- CONTROLLER: GET PAYOUTS SUMMARY (Admin Dashboard) ---
export const getPayoutsSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const { period, week, recipientType, status, search } = req.query;

        let filter: any = {};
        const periodId = period || week;
        if (periodId) filter.periodIdentifier = periodId as string;
        if (recipientType) filter.recipientType = recipientType as string;
        if (status) filter.status = status as string;

        let payouts = await Payout.find(filter)
            .populate("restaurant", "name phone owner cuisines commission")
            .populate("deliveryBoy", "name phone email")
            .sort({ createdAt: -1 });

        if (search) {
            const query = (search as string).toLowerCase();
            payouts = payouts.filter(p => {
                if (p.recipientType === "restaurant" && p.restaurant) {
                    const r = p.restaurant as any;
                    return r.name.toLowerCase().includes(query) || (r.phone && r.phone.includes(query));
                } else if (p.recipientType === "delivery" && p.deliveryBoy) {
                    const d = p.deliveryBoy as any;
                    return d.name.toLowerCase().includes(query) || (d.phone && d.phone.includes(query));
                } else if (p.recipientType === "grocery") {
                    return "grocery".includes(query);
                }
                return false;
            });
        }

        let totalRevenue = 0;
        let platformCommission = 0;
        let pendingSettlement = 0;
        let codCashToCollect = 0;

        payouts.forEach(p => {
            if (p.recipientType !== "grocery") {
                totalRevenue += p.totalRevenue;
                platformCommission += p.platformCommission;
            }
            if (p.status !== "paid") {
                pendingSettlement += p.finalPayoutAmount;
            }
            if (p.recipientType === "delivery") {
                codCashToCollect += p.codCollected;
            }
        });

        res.status(200).json({
            success: true,
            payouts,
            stats: {
                totalRevenue,
                platformCommission,
                pendingSettlement,
                codCashToCollect
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- CONTROLLER: UPDATE PAYOUT STATUS & LOG AUDIT TRAIL ---
export const updatePayoutStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status, transactionId, notes } = req.body;

        if (!["pending", "processing", "paid", "failed"].includes(status)) {
            res.status(400).json({ success: false, message: "Invalid status value" });
            return;
        }

        // PHASE 3: Mandatory transaction ID when marking as paid
        if (status === "paid" && !transactionId?.trim()) {
            res.status(400).json({
                success: false,
                message: "A Transaction ID / UTR number is required to mark a payout as paid."
            });
            return;
        }

        const payout = await Payout.findById(id);
        if (!payout) {
            res.status(404).json({ success: false, message: "Payout record not found" });
            return;
        }

        const oldStatus = payout.status;
        const adminUser = (req as any).user;
        const updatedByName = adminUser?.name || adminUser?._id?.toString() || "Unknown Admin";

        // PHASE 4: Explicit correction trail for post-paid changes
        if (payout.status === "paid" && transactionId && transactionId.trim() !== payout.paymentDetails?.transactionId) {
            payout.auditLogs.push({
                status: "correction",
                updatedBy: updatedByName,
                updatedAt: new Date(),
                notes: `UTR corrected from "${payout.paymentDetails?.transactionId || "none"}" to "${transactionId.trim()}". Reason: ${notes || "not specified"}`
            });
        } else if (oldStatus !== status) {
            payout.auditLogs.push({
                status,
                updatedBy: updatedByName,
                updatedAt: new Date(),
                notes: `Status transitioned from ${oldStatus} to ${status}. ${notes || ""}`
            });
        }

        payout.status = status;
        payout.paymentDetails = {
            transactionId: transactionId ? transactionId.trim() : payout.paymentDetails?.transactionId,
            paidAt: status === "paid" ? (payout.paymentDetails?.paidAt || new Date()) : payout.paymentDetails?.paidAt,
            notes: notes !== undefined ? notes : payout.paymentDetails?.notes
        };

        await payout.save();

        res.status(200).json({
            success: true,
            message: "Payout status updated successfully!",
            payout
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- CONTROLLER: RESTAURANT-FACING PAYOUT HISTORY ---
export const getMyPayouts = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurant = await Restaurant.findOne({ owner: req.user?._id });
        if (!restaurant) {
            res.status(404).json({ success: false, message: "No restaurant found." });
            return;
        }

        const payouts = await Payout.find({ recipientType: "restaurant", restaurant: restaurant._id })
            .sort({ periodStartDate: -1 })
            .select("periodStartDate periodEndDate periodIdentifier totalOrders totalRevenue platformCommission refundsAndAdjustments adjustmentNotes finalPayoutAmount status paymentDetails createdAt");

        res.status(200).json({
            success: true,
            payouts
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- CONTROLLER: GROCERY ANALYTICS ---
export const getGroceryFinancialAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
        const { period, week } = req.query;
        const targetPeriod = (period || week) as string;

        if (!targetPeriod) {
            res.status(400).json({ success: false, message: "Period identifier query parameter is required." });
            return;
        }

        const payout = await Payout.findOne({ recipientType: "grocery", periodIdentifier: targetPeriod });
        if (!payout) {
            res.status(200).json({
                success: true,
                message: "No grocery revenue logs found for this period.",
                analytics: { totalSales: 0, profit: 0, itemsCount: 0, categories: [] }
            });
            return;
        }

        const groceryOrders = await Order.find({
            orderType: "grocery",
            orderStatus: "delivered",
            createdAt: { $gte: payout.periodStartDate, $lte: payout.periodEndDate }
        });

        const categorySalesMap = new Map<string, { revenue: number, quantity: number }>();
        let totalItemsCount = 0;

        for (const order of groceryOrders) {
            for (const item of order.items) {
                if (item.groceryItem) {
                    const qty = item.quantity || 1;
                    const price = item.price || 0;
                    const subtotal = qty * price;
                    totalItemsCount += qty;

                    const prod = await GroceryProduct.findById(item.groceryItem);
                    const category = prod ? prod.category : "General";

                    const catData = categorySalesMap.get(category) || { revenue: 0, quantity: 0 };
                    catData.revenue += subtotal;
                    catData.quantity += qty;
                    categorySalesMap.set(category, catData);
                }
            }
        }

        const categoriesBreakdown = Array.from(categorySalesMap.entries()).map(([name, data]) => ({
            categoryName: name,
            revenue: data.revenue,
            unitsSold: data.quantity
        }));

        res.status(200).json({
            success: true,
            analytics: {
                totalSales: payout.totalRevenue,
                profit: payout.platformCommission,
                itemsCount: totalItemsCount,
                categories: categoriesBreakdown
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
