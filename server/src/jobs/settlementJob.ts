import cron from "node-cron";
import { runSettlementCalculation } from "../controllers/payoutController";

export function startSettlementJob() {
    // Runs once daily at 02:00 AM; the settlement calculation itself is idempotent per period (unique index + paid-skip protection),
    // so running daily and letting it no-op on non-boundary days is simpler and safer than trying to schedule exactly every 3rd day.
    cron.schedule("0 2 * * *", async () => {
        console.log("[Settlement Job] Running daily settlement check...");
        try {
            await runSettlementCalculation();
        } catch (err: any) {
            console.error("[Settlement Job] Failed:", err.message);
        }
    });
    console.log("[Settlement Job] Scheduled 3-day settlement cron (0 2 * * *) initialized.");
}
