import admin from "../config/firebaseAdmin";
import DeviceToken from "../models/DeviceToken";
import NotificationCampaign, { INotificationCampaign } from "../models/NotificationCampaign";
import { getAudience, getKolkataDateString, isQuietHours, adjustScheduledTimeForQuietHours } from "./audienceService";
import { getOrCreateSettings } from "../controllers/platformSettingsController";

export const maskToken = (token: string): string => {
    if (!token) return "";
    return token.length > 8 ? `${token.substring(0, 8)}...` : token;
};

/**
 * Chunks an array into smaller slices of given size
 */
const chunkArray = <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

export interface SendPushOptions {
    campaignId: string;
    overrideQuietHours?: boolean;
}

/**
 * Sends a notification campaign to its targeted audience
 */
export const sendCampaign = async (campaignId: string, overrideQuietHours = false): Promise<void> => {
    const campaign = await NotificationCampaign.findById(campaignId);
    if (!campaign) {
        console.error(`[PushService] Campaign not found: ${campaignId}`);
        return;
    }

    if (campaign.status === "cancelled") {
        console.log(`[PushService] Campaign ${campaignId} was cancelled. Skipping send.`);
        return;
    }

    try {
        const settingsDoc = await getOrCreateSettings();
        const notificationSettings = settingsDoc.notificationSettings || {
            quietHoursStart: "22:00",
            quietHoursEnd: "08:00"
        };

        const now = new Date();
        const isQuiet = isQuietHours(now, notificationSettings.quietHoursStart, notificationSettings.quietHoursEnd);

        // If quiet hours and not overridden, reschedule to quietHoursEnd
        if (isQuiet && !overrideQuietHours) {
            const nextScheduled = adjustScheduledTimeForQuietHours(
                now,
                notificationSettings.quietHoursStart,
                notificationSettings.quietHoursEnd
            );
            campaign.status = "scheduled";
            campaign.scheduledAt = nextScheduled;
            await campaign.save();
            console.log(`[PushService] Campaign ${campaignId} deferred until quiet hours end: ${nextScheduled.toISOString()}`);
            return;
        }

        // Mark as sending
        campaign.status = "sending";
        await campaign.save();

        // Resolve audience
        const audienceResult = await getAudience({
            segment: campaign.segment,
            zoneIds: campaign.zoneIds,
            radius: campaign.radius,
            overrideQuietHours: true
        });

        const tokens = audienceResult.tokens;
        const totalTargeted = tokens.length;
        let totalSent = 0;
        let totalFailed = 0;

        const todayKolkata = getKolkataDateString(now);

        if (totalTargeted > 0) {
            // FCM multicast supports up to 500 tokens per call
            const tokenBatches = chunkArray(tokens, 500);

            for (const batch of tokenBatches) {
                const batchTokenStrings = batch.map(t => t.token);

                const multicastMessage: admin.messaging.MulticastMessage = {
                    tokens: batchTokenStrings,
                    notification: {
                        title: campaign.title,
                        body: campaign.body,
                        ...(campaign.imageUrl ? { imageUrl: campaign.imageUrl } : {})
                    },
                    android: {
                        priority: "high",
                        ttl: 4 * 60 * 60 * 1000, // 4 hours in ms
                        notification: {
                            channelId: "promotions_high",
                            sound: "default",
                            ...(campaign.imageUrl ? { imageUrl: campaign.imageUrl } : {})
                        }
                    },
                    data: {
                        type: "promo",
                        campaignId: campaign._id.toString(),
                        route: campaign.route
                    }
                };

                try {
                    const response = await admin.messaging().sendEachForMulticast(multicastMessage);

                    totalSent += response.successCount;
                    totalFailed += response.failureCount;

                    const successfulTokens: string[] = [];
                    const unregisteredTokens: string[] = [];

                    response.responses.forEach((resp, index) => {
                        const originalToken = batchTokenStrings[index];
                        if (resp.success) {
                            successfulTokens.push(originalToken);
                        } else {
                            const errorCode = resp.error?.code;
                            console.warn(
                                `[PushService] Send failure for token ${maskToken(originalToken)}: ${errorCode} - ${resp.error?.message}`
                            );
                            if (
                                errorCode === "messaging/registration-token-not-registered" ||
                                errorCode === "messaging/invalid-registration-token"
                            ) {
                                unregisteredTokens.push(originalToken);
                            }
                        }
                    });

                    // Increment marketingDay and marketingCount for successful tokens
                    if (successfulTokens.length > 0) {
                        // For tokens already marked with today's marketingDay, increment marketingCount
                        await DeviceToken.updateMany(
                            { token: { $in: successfulTokens }, marketingDay: todayKolkata },
                            { $inc: { marketingCount: 1 } }
                        );

                        // For tokens on a previous day or not set, set to today and count to 1
                        await DeviceToken.updateMany(
                            { token: { $in: successfulTokens }, marketingDay: { $ne: todayKolkata } },
                            { $set: { marketingDay: todayKolkata, marketingCount: 1 } }
                        );
                    }

                    // Remove invalid / unregistered tokens from DB
                    if (unregisteredTokens.length > 0) {
                        await DeviceToken.deleteMany({ token: { $in: unregisteredTokens } });
                        console.log(`[PushService] Removed ${unregisteredTokens.length} unregistered tokens`);
                    }
                } catch (batchErr: any) {
                    console.error(`[PushService] Batch send failed for campaign ${campaignId}:`, batchErr);
                    totalFailed += batch.length;
                }
            }
        }

        campaign.status = "sent";
        campaign.sentAt = new Date();
        campaign.stats = {
            targeted: totalTargeted,
            sent: totalSent,
            failed: totalFailed,
            skippedCap: audienceResult.counts.skippedCap,
            skippedQuiet: audienceResult.counts.skippedQuiet,
            opened: campaign.stats?.opened || 0
        };

        await campaign.save();
        console.log(
            `[PushService] Campaign ${campaignId} completed. Targeted: ${totalTargeted}, Sent: ${totalSent}, Failed: ${totalFailed}`
        );
    } catch (err: any) {
        console.error(`[PushService] Failed to execute campaign ${campaignId}:`, err);
        campaign.status = "failed";
        campaign.failureReason = err.message || "Unknown error occurred";
        await campaign.save();
    }
};

/**
 * Sends a test push directly to calling admin's devices
 */
export const sendTestPush = async (
    userId: string,
    payload: { title: string; body: string; imageUrl?: string; route: string }
): Promise<{ success: boolean; targeted: number; sent: number; failed: number; message: string }> => {
    const tokens = await DeviceToken.find({ user: userId }).exec();

    if (!tokens || tokens.length === 0) {
        return {
            success: false,
            targeted: 0,
            sent: 0,
            failed: 0,
            message: "No registered device tokens found for your admin account. Open the mobile app and log in first."
        };
    }

    const tokenStrings = tokens.map(t => t.token);

    const multicastMessage: admin.messaging.MulticastMessage = {
        tokens: tokenStrings,
        notification: {
            title: payload.title,
            body: payload.body,
            ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {})
        },
        android: {
            priority: "high",
            ttl: 4 * 60 * 60 * 1000,
            notification: {
                channelId: "promotions_high",
                sound: "default",
                ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {})
            }
        },
        data: {
            type: "promo",
            route: payload.route
        }
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(multicastMessage);
        const unregisteredTokens: string[] = [];

        response.responses.forEach((resp, idx) => {
            const tok = tokenStrings[idx];
            if (!resp.success) {
                console.warn(
                    `[PushService Test] Failure for token ${maskToken(tok)}: ${resp.error?.code} - ${resp.error?.message}`
                );
                if (
                    resp.error?.code === "messaging/registration-token-not-registered" ||
                    resp.error?.code === "messaging/invalid-registration-token"
                ) {
                    unregisteredTokens.push(tok);
                }
            }
        });

        if (unregisteredTokens.length > 0) {
            await DeviceToken.deleteMany({ token: { $in: unregisteredTokens } });
        }

        return {
            success: response.successCount > 0,
            targeted: tokenStrings.length,
            sent: response.successCount,
            failed: response.failureCount,
            message: `Sent test notification to ${response.successCount} of ${tokenStrings.length} devices.`
        };
    } catch (err: any) {
        console.error("[PushService Test Error]", err);
        throw err;
    }
};
