import { Request, Response } from "express";
import Delivery from "../models/Delivery";
import CashSettlement from "../models/CashSettlement";
import User from "../models/User";

// Courier: log a cash handover or digital payment (self-reported, starts pending)
export const submitCashSettlement = async (req: Request, res: Response): Promise<void> => {
    try {
        const { type, amount, transactionId, paymentDate, notes } = req.body;
        if (!type || !["cash_handover", "digital_payment"].includes(type)) {
            res.status(400).json({ success: false, message: "A valid settlement type (cash_handover or digital_payment) is required." });
            return;
        }
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            res.status(400).json({ success: false, message: "A valid positive amount is required." });
            return;
        }
        if (type === "digital_payment" && (!transactionId || !transactionId.trim())) {
            res.status(400).json({ success: false, message: "A UTR/Transaction ID is required for digital payments." });
            return;
        }

        const settlement = await CashSettlement.create({
            deliveryBoy: req.user?._id,
            type,
            amount: Number(amount),
            transactionId: transactionId ? transactionId.trim() : undefined,
            paymentDate: paymentDate ? new Date(paymentDate) : (type === "digital_payment" ? new Date() : undefined),
            notes: notes ? notes.trim() : undefined,
            status: "pending"
        });

        res.status(201).json({ success: true, settlement });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Courier: view their own settlement history
export const getMySettlements = async (req: Request, res: Response): Promise<void> => {
    try {
        const settlements = await CashSettlement.find({ deliveryBoy: req.user?._id })
            .populate("confirmedBy", "name")
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: settlements.length, settlements });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: confirm or reject a pending settlement
export const reviewCashSettlement = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { action } = req.body; // "confirm" | "reject"

        if (!["confirm", "reject"].includes(action)) {
            res.status(400).json({ success: false, message: "Invalid action. Allowed values are 'confirm' or 'reject'." });
            return;
        }

        const settlement = await CashSettlement.findById(id);
        if (!settlement || settlement.status !== "pending") {
            res.status(400).json({ success: false, message: "This settlement is not pending review." });
            return;
        }

        settlement.status = action === "confirm" ? "confirmed" : "rejected";
        settlement.confirmedBy = req.user?._id;
        settlement.confirmedAt = new Date();
        await settlement.save();

        res.status(200).json({ success: true, message: `Settlement ${settlement.status} successfully`, settlement });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: pending settlements queue, across all couriers
export const getPendingSettlements = async (req: Request, res: Response): Promise<void> => {
    try {
        const pending = await CashSettlement.find({ status: "pending" })
            .populate("deliveryBoy", "name phone")
            .sort({ createdAt: 1 });

        res.status(200).json({ success: true, count: pending.length, settlements: pending });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: per-courier daily ops summary — orders, cash held, distance
export const getDeliveryOpsSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const { startDate, endDate } = req.query; // ISO date strings or YYYY-MM-DD, defaults to today
        let start: Date;
        let end: Date;

        if (startDate) {
            const parsedStart = new Date(startDate as string);
            start = new Date(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate(), 0, 0, 0, 0);
        } else {
            const today = new Date();
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        }

        if (endDate) {
            const parsedEnd = new Date(endDate as string);
            end = new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate(), 23, 59, 59, 999);
        } else {
            const today = new Date();
            end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        }

        const riders = await User.find({ role: "delivery" }, { name: 1, phone: 1 }).lean();

        const summary = await Promise.all(riders.map(async (rider) => {
            const deliveries = await Delivery.find({
                deliveryBoy: rider._id,
                status: "delivered",
                createdAt: { $gte: start, $lte: end }
            }).populate("order", "totalAmount paymentMethod distance");

            const ordersCompleted = deliveries.length;
            const totalDistanceKm = deliveries.reduce((sum, d: any) => sum + (d.order?.distance || 0), 0);
            const cashCollectedToday = deliveries.reduce((sum, d: any) => {
                return sum + (d.order?.paymentMethod === "COD" ? (d.order.totalAmount || 0) : 0);
            }, 0);

            // All-time outstanding balance (running total across all deliveries and confirmed settlements)
            const allTimeDeliveries = await Delivery.find({
                deliveryBoy: rider._id,
                status: "delivered"
            }).populate("order", "totalAmount paymentMethod");

            const totalCashEverCollected = allTimeDeliveries.reduce((sum, d: any) => {
                return sum + (d.order?.paymentMethod === "COD" ? (d.order.totalAmount || 0) : 0);
            }, 0);

            const confirmedHandovers = await CashSettlement.aggregate([
                { $match: { deliveryBoy: rider._id, status: "confirmed" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            const totalRemitted = confirmedHandovers[0]?.total || 0;
            const cashHeld = Math.max(0, totalCashEverCollected - totalRemitted);

            return {
                deliveryBoy: { _id: rider._id, name: rider.name, phone: rider.phone },
                ordersCompleted,
                totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
                cashCollectedToday,
                cashHeld
            };
        }));

        res.status(200).json({ success: true, period: { start, end }, summary });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: monthly distance report per courier
export const getMonthlyDistanceReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const now = new Date();
        const monthNum = req.query.month ? Number(req.query.month) : (now.getMonth() + 1);
        const yearNum = req.query.year ? Number(req.query.year) : now.getFullYear();

        const start = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
        const end = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

        const report = await Delivery.aggregate([
            { $match: { status: "delivered", createdAt: { $gte: start, $lte: end } } },
            { $lookup: { from: "orders", localField: "order", foreignField: "_id", as: "order" } },
            { $unwind: "$order" },
            { 
                $group: { 
                    _id: "$deliveryBoy", 
                    totalDistanceKm: { $sum: { $ifNull: ["$order.distance", 0] } }, 
                    totalOrders: { $sum: 1 } 
                } 
            },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "rider" } },
            { $unwind: "$rider" },
            { 
                $project: { 
                    "rider._id": "$rider._id",
                    "rider.name": "$rider.name", 
                    "rider.phone": "$rider.phone", 
                    totalDistanceKm: { $round: ["$totalDistanceKm", 1] }, 
                    totalOrders: 1 
                } 
            },
            { $sort: { totalDistanceKm: -1 } }
        ]);

        res.status(200).json({ success: true, month: monthNum, year: yearNum, report });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
