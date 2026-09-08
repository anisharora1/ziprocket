import 'dotenv/config';
import mongoose from 'mongoose';
import dbConnect from '../config/dbConnect';
import Restaurant from '../models/Restaurant';
import Order from '../models/Order';
import * as restaurantCacheService from '../services/restaurantCacheService';

async function syncRestaurantTotalOrders() {
    try {
        await dbConnect();
        console.log("Connected to database. Starting totalOrders correction...");

        const restaurants = await Restaurant.find({});
        console.log(`Found ${restaurants.length} restaurants.`);

        for (const restaurant of restaurants) {
            const deliveredOrdersCount = await Order.countDocuments({
                restaurant: restaurant._id,
                orderType: "food",
                orderStatus: "delivered"
            });

            const previousCount = restaurant.totalOrders || 0;
            restaurant.totalOrders = deliveredOrdersCount;
            await restaurant.save();

            console.log(`Restaurant "${restaurant.name}" (${restaurant._id}): updated totalOrders from ${previousCount} to ${deliveredOrdersCount}`);
            await restaurantCacheService.invalidateRestaurantCache(restaurant._id.toString());
        }

        await restaurantCacheService.invalidateRestaurantCache();
        console.log("All restaurant totalOrders corrected and caches invalidated.");
    } catch (error: any) {
        console.error("Error during sync:", error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

syncRestaurantTotalOrders();
