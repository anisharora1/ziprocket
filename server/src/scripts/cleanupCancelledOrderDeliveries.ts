import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

import Order from "../models/Order";
import Delivery from "../models/Delivery";

async function runCleanup() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/ziprocket";
        console.log("Connecting to MongoDB...");
        await mongoose.connect(mongoUri);
        console.log("Connected to MongoDB.");

        // Find all cancelled orders
        const cancelledOrders = await Order.find({ orderStatus: "cancelled" }).select("_id").lean();
        const cancelledOrderIds = cancelledOrders.map(o => o._id);

        console.log(`Found ${cancelledOrderIds.length} cancelled orders.`);

        if (cancelledOrderIds.length > 0) {
            // Find any deliveries linked to cancelled orders that are still active (not delivered and not cancelled)
            const orphanedDeliveries = await Delivery.find({
                order: { $in: cancelledOrderIds },
                status: { $nin: ["delivered", "cancelled"] }
            });

            console.log(`Found ${orphanedDeliveries.length} orphaned active deliveries tied to cancelled orders.`);

            const result = await Delivery.updateMany(
                {
                    order: { $in: cancelledOrderIds },
                    status: { $nin: ["delivered", "cancelled"] }
                },
                {
                    $set: { status: "cancelled" }
                }
            );

            console.log(`Updated ${result.modifiedCount} delivery record(s) to 'cancelled'.`);
        } else {
            console.log("No cancelled orders found.");
        }

        await mongoose.disconnect();
        console.log("Cleanup finished successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Error running cleanup script:", err);
        process.exit(1);
    }
}

runCleanup();
