import 'dotenv/config';
import * as redisService from '../services/redisService';

async function flushMenuCache() {
    try {
        console.log("Connecting to Redis to flush stale menu caches...");
        
        // Wait a brief moment for Redis connection if needed
        const client = redisService.getClient();
        if (!client) {
            console.log("Redis is disabled or client could not be initialized.");
            process.exit(0);
        }

        if (client.status !== "ready") {
            await new Promise<void>((resolve, reject) => {
                client.once("ready", () => resolve());
                client.once("error", (err) => reject(err));
                setTimeout(() => resolve(), 3000);
            });
        }

        console.log("Flushing menu cache pattern 'restaurant:menu:*'...");
        await redisService.deletePattern("restaurant:menu:*");
        
        console.log("Flushing restaurant listings cache pattern 'restaurants:*'...");
        await redisService.deletePattern("restaurants:*");

        console.log("Flushing restaurant details cache pattern 'restaurant:detail:*'...");
        await redisService.deletePattern("restaurant:detail:*");

        console.log("✅ Successfully cleared all cached restaurant menus & details — next request per restaurant will re-cache with correctly normalized/flattened images.");
    } catch (error: any) {
        console.error("❌ Error flushing menu cache:", error.message || error);
    } finally {
        const client = redisService.getClient();
        if (client) {
            await client.quit().catch(() => {});
        }
        process.exit(0);
    }
}

flushMenuCache();
