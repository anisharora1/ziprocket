// server/src/services/tokenDenylistService.ts
import crypto from "crypto";
import jwt from "jsonwebtoken";
import * as redisService from "./redisService";

/**
 * Deny (revoke) a JWT by storing its sha256 hash in Redis with a TTL
 * equal to the remaining seconds until token expiration (minimum 1 second).
 * If Redis is unavailable, logs a warning and does not crash.
 */
export const denyToken = async (token: string): Promise<void> => {
    if (!token) return;

    try {
        const client = redisService.getClient();
        if (!client || client.status !== "ready") {
            console.warn("[TokenDenylist] Redis is unavailable; cannot deny token");
            return;
        }

        const cleanToken = token.startsWith("Bearer ") ? token.slice(7).trim() : token.trim();
        const hash = crypto.createHash("sha256").update(cleanToken).digest("hex");
        const key = `denylist:${hash}`;

        let remainingSeconds = 0;
        try {
            const decoded = jwt.decode(cleanToken) as { exp?: number } | null;
            if (decoded && typeof decoded.exp === "number") {
                const nowInSeconds = Math.floor(Date.now() / 1000);
                remainingSeconds = decoded.exp - nowInSeconds;
            }
        } catch (decodeErr: any) {
            console.warn("[TokenDenylist] Failed to decode token exp:", decodeErr.message);
        }

        const ttlSeconds = Math.max(1, remainingSeconds);
        await redisService.set(key, "revoked", ttlSeconds);
    } catch (error: any) {
        console.warn("[TokenDenylist] Failed to deny token:", error.message);
    }
};

/**
 * Check if a token has been denied (revoked).
 * Returns true if the token's sha256 hash exists in Redis denylist.
 * If Redis is unavailable, logs a warning and returns false to let the request through.
 */
export const isTokenDenied = async (token: string): Promise<boolean> => {
    if (!token) return false;

    try {
        const client = redisService.getClient();
        if (!client || client.status !== "ready") {
            console.warn("[TokenDenylist] Redis is unavailable; skipping token revocation check");
            return false;
        }

        const cleanToken = token.startsWith("Bearer ") ? token.slice(7).trim() : token.trim();
        const hash = crypto.createHash("sha256").update(cleanToken).digest("hex");
        const key = `denylist:${hash}`;

        const value = await redisService.get(key);
        return value !== null;
    } catch (error: any) {
        console.warn("[TokenDenylist] Error checking token denylist:", error.message);
        return false;
    }
};
