import cron from "node-cron";
import NotificationCampaign from "../models/NotificationCampaign";
import { sendCampaign } from "../services/pushService";

export function startNotificationJob() {
    // Runs every minute to dispatch scheduled push notification campaigns
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();

            // Find all candidate campaigns whose scheduled time has arrived
            const dueCampaigns = await NotificationCampaign.find(
                {
                    status: "scheduled",
                    scheduledAt: { $lte: now }
                },
                { _id: 1 }
            ).lean();

            for (const candidate of dueCampaigns) {
                // ATOMIC CLAIM: only transitions if status is STILL "scheduled"
                // Guarantees that neither multiple instances nor sudden restarts send duplicate pushes
                const claimed = await NotificationCampaign.findOneAndUpdate(
                    {
                        _id: candidate._id,
                        status: "scheduled"
                    },
                    {
                        $set: { status: "sending" }
                    },
                    { new: true }
                );

                if (claimed) {
                    console.log(`[Notification Scheduler] Claimed campaign ${claimed._id}. Sending now...`);
                    try {
                        await sendCampaign(claimed._id.toString());
                    } catch (sendErr: any) {
                        console.error(`[Notification Scheduler] Failed sending campaign ${claimed._id}:`, sendErr);
                    }
                }
            }
        } catch (err: any) {
            console.error("[Notification Scheduler Error]", err);
        }
    });

    console.log("[Notification Scheduler] Cron job (* * * * *) initialized.");
}
