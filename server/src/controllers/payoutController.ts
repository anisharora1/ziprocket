import { Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../models/Order";
import Delivery from "../models/Delivery";
import Restaurant from "../models/Restaurant";
import User from "../models/User";
import Payout from "../models/Payout";
import GroceryProduct from "../models/GroceryProduct";

// Helper: Calculate Monday (00:00) and Sunday (23:59) for a given date
const getWeekRange = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { monday, sunday };
};

// Helper: Generate a week identifier (e.g. "2026-W21")
const getWeekIdentifier = (startDate: Date) => {
    const year = startDate.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const numberOfDays = Math.floor((startDate.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);
    return `${year}-W${String(weekNumber).padStart(2, "0")}`;
};

// --- CALCULATE WEEKLY SETTLEMENTS ---
export const calculateWeeklyPayouts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { date } = req.body; // Can pass any date inside target week
        const targetDate = date ? new Date(date) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Defaults to previous week
        
        const { monday, sunday } = getWeekRange(targetDate);
        const weekIdentifier = getWeekIdentifier(monday);

        console.log(`Calculating Payouts for ${weekIdentifier} (${monday.toISOString()} to ${sunday.toISOString()})`);

        // 1. Fetch delivered orders in target week
        const weeklyOrders = await Order.find({
            orderStatus: "delivered",
            createdAt: { $gte: monday, $lte: sunday }
        }).populate("restaurant");

        // --- A. RESTAURANT SETTLEMENTS ---
        const restaurantOrdersMap = new Map<string, any[]>();
        weeklyOrders.forEach(order => {
            if (order.orderType === "food" && order.restaurant) {
                const restId = order.restaurant._id.toString();
                const list = restaurantOrdersMap.get(restId) || [];
                list.push(order);
                restaurantOrdersMap.set(restId, list);
            }
        });

        // Resolve all approved restaurants to create payouts even if they had 0 orders (optional, let's create for active ones)
        const allRestaurants = await Restaurant.find();
        
        for (const rest of allRestaurants) {
            const restId = rest._id.toString();
            const orders = restaurantOrdersMap.get(restId) || [];
            
            const totalOrders = orders.length;
            let totalRevenue = 0;
            let codCollected = 0;
            let onlinePayments = 0;

            orders.forEach(o => {
                totalRevenue += o.totalAmount || 0;
                if (o.paymentMethod === "COD") {
                    codCollected += o.totalAmount || 0;
                } else {
                    onlinePayments += o.totalAmount || 0;
                }
            });

            const commissionRate = rest.commission !== undefined ? rest.commission : 10;
            const platformCommission = Math.round((totalRevenue * commissionRate) / 100);
            const finalPayoutAmount = totalRevenue - platformCommission; // owed to restaurant

            // Upsert Payout document
            await Payout.findOneAndUpdate(
                { recipientType: "restaurant", restaurant: rest._id, weekIdentifier },
                {
                    weekStartDate: monday,
                    weekEndDate: sunday,
                    totalOrders,
                    totalRevenue,
                    platformCommission,
                    codCollected,
                    onlinePayments,
                    finalPayoutAmount,
                    // keep status paid if it was already marked as paid, otherwise pending
                    $setOnInsert: { status: "pending", auditLogs: [{ status: "pending", updatedBy: "System", notes: "Settlement calculated." }] }
                },
                { upsert: true, new: true }
            );
        }

        // --- B. DELIVERY PERSONNEL SETTLEMENTS ---
        // Fetch delivered items in Delivery model
        const weeklyDeliveries = await Delivery.find({
            status: "delivered",
            createdAt: { $gte: monday, $lte: sunday }
        }).populate("order");

        const riderDeliveriesMap = new Map<string, any[]>();
        weeklyDeliveries.forEach(delivery => {
            if (delivery.deliveryBoy) {
                const riderId = delivery.deliveryBoy.toString();
                const list = riderDeliveriesMap.get(riderId) || [];
                list.push(delivery);
                riderDeliveriesMap.set(riderId, list);
            }
        });

        const allRiders = await User.find({ role: "delivery" });
        for (const rider of allRiders) {
            const riderId = rider._id.toString();
            const deliveries = riderDeliveriesMap.get(riderId) || [];
            
            const totalOrders = deliveries.length;
            let totalRevenue = 0; // Total delivery boy earnings
            let codCollected = 0; // Cash collected from COD deliveries

            deliveries.forEach(d => {
                totalRevenue += d.earnings || 0;
                const orderDoc = d.order as any;
                if (orderDoc && orderDoc.paymentMethod === "COD") {
                    codCollected += orderDoc.totalAmount || 0;
                }
            });

            // For riders, the payout is their total delivery earnings. Cash in hand is tracked separately.
            const finalPayoutAmount = totalRevenue;

            await Payout.findOneAndUpdate(
                { recipientType: "delivery", deliveryBoy: rider._id, weekIdentifier },
                {
                    weekStartDate: monday,
                    weekEndDate: sunday,
                    totalOrders,
                    totalRevenue,
                    platformCommission: 0,
                    codCollected,
                    onlinePayments: 0,
                    finalPayoutAmount,
                    $setOnInsert: { status: "pending", auditLogs: [{ status: "pending", updatedBy: "System", notes: "Settlement calculated." }] }
                },
                { upsert: true, new: true }
            );
        }

        // --- C. GROCERY PLATFORM SALES REVENUE ---
        const groceryOrders = weeklyOrders.filter(o => o.orderType === "grocery");
        const totalGroceryOrders = groceryOrders.length;
        let totalGrocerySales = 0;
        let groceryCodCollected = 0;
        let groceryOnlinePayments = 0;

        groceryOrders.forEach(o => {
            totalGrocerySales += o.totalAmount || 0;
            if (o.paymentMethod === "COD") {
                groceryCodCollected += o.totalAmount || 0;
            } else {
                groceryOnlinePayments += o.totalAmount || 0;
            }
        });

        // Grocery margin estimated as standard 20% quick commerce margin
        const groceryProfit = Math.round(totalGrocerySales * 0.20);

        await Payout.findOneAndUpdate(
            { recipientType: "grocery", weekIdentifier },
            {
                weekStartDate: monday,
                weekEndDate: sunday,
                totalOrders: totalGroceryOrders,
                totalRevenue: totalGrocerySales,
                platformCommission: groceryProfit, // We store grocery profits under platform commission
                codCollected: groceryCodCollected,
                onlinePayments: groceryOnlinePayments,
                finalPayoutAmount: totalGrocerySales - groceryProfit,
                $setOnInsert: { status: "pending", auditLogs: [{ status: "pending", updatedBy: "System", notes: "Settlement calculated." }] }
            },
            { upsert: true, new: true }
        );

        res.status(200).json({
            success: true,
            message: `Weekly payouts for cycle ${weekIdentifier} calculated successfully!`,
            weekIdentifier,
            period: { start: monday, end: sunday }
        });

    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- GET PAYOUTS SUMMARY WITH FILTERS & KPIS ---
export const getPayoutsSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const { week, recipientType, status, search } = req.query;

        // Default to current or previous week if not provided
        let filter: any = {};
        if (week) filter.weekIdentifier = week as string;
        if (recipientType) filter.recipientType = recipientType as string;
        if (status) filter.status = status as string;

        // Fetch payouts populated with recipients
        let payouts = await Payout.find(filter)
            .populate("restaurant", "name phone owner cuisines commission")
            .populate("deliveryBoy", "name phone email");

        // Filter by search text if provided
        if (search) {
            const query = (search as string).toLowerCase();
            payouts = payouts.filter(p => {
                if (p.recipientType === "restaurant" && p.restaurant) {
                    const r = p.restaurant as any;
                    return r.name.toLowerCase().includes(query) || r.phone.includes(query);
                } else if (p.recipientType === "delivery" && p.deliveryBoy) {
                    const d = p.deliveryBoy as any;
                    return d.name.toLowerCase().includes(query) || d.phone.includes(query);
                } else if (p.recipientType === "grocery") {
                    return "grocery".includes(query);
                }
                return false;
            });
        }

        // Calculate dynamic platform-wide KPIs for the fetched set
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

// --- UPDATE PAYOUT STATUS & LOG TRANSACTION ---
export const updatePayoutStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status, transactionId, notes } = req.body;

        if (!["pending", "processing", "paid", "failed"].includes(status)) {
            res.status(400).json({ success: false, message: "Invalid status value" });
            return;
        }

        const payout = await Payout.findById(id);
        if (!payout) {
            res.status(404).json({ success: false, message: "Payout record not found" });
            return;
        }

        const oldStatus = payout.status;
        payout.status = status;
        payout.paymentDetails = {
            transactionId: transactionId || payout.paymentDetails?.transactionId,
            paidAt: status === "paid" ? new Date() : payout.paymentDetails?.paidAt,
            notes: notes || payout.paymentDetails?.notes
        };

        // Append audit log
        payout.auditLogs.push({
            status,
            updatedBy: "Admin",
            updatedAt: new Date(),
            notes: `Status transitioned from ${oldStatus} to ${status}. ${notes || ""}`
        });

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

// --- GET GROCERY WEEKLY ANALYTICS ---
export const getGroceryFinancialAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
        const { week } = req.query;
        if (!week) {
            res.status(400).json({ success: false, message: "Week identifier query parameter is required." });
            return;
        }

        const weekStr = week as string;
        // Parse date from week identifier or locate Payout start/end dates
        const payout = await Payout.findOne({ recipientType: "grocery", weekIdentifier: weekStr });
        if (!payout) {
            res.status(200).json({
                success: true,
                message: "No grocery revenue logs found for this week.",
                analytics: { totalSales: 0, profit: 0, itemsCount: 0, categories: [] }
            });
            return;
        }

        // Fetch grocery orders delivered in the week range
        const groceryOrders = await Order.find({
            orderType: "grocery",
            orderStatus: "delivered",
            createdAt: { $gte: payout.weekStartDate, $lte: payout.weekEndDate }
        });

        // Dynamic category sales grouping
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
