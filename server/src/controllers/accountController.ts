import { Request, Response } from "express";
import User from "../models/User";
import Order from "../models/Order";
import Address from "../models/Address";
import Cart from "../models/Cart";
import DeviceToken from "../models/DeviceToken";
import Review from "../models/Review";
import PaymentIntent from "../models/PaymentIntent";
import admin from "../config/firebaseAdmin";
import { deleteFromCloudinary } from "../services/cloudinaryService";
import * as sessionCacheService from "../services/sessionCacheService";
import * as cartCacheService from "../services/cartCacheService";

/**
 * Permanently delete customer account and personal data (Google Play Store compliance)
 */
export const deleteMyAccount = async (req: Request, res: Response): Promise<void> => {
    try {
        const currentUser = req.user;
        if (!currentUser) {
            res.status(401).json({ success: false, message: "Not authorized, user not found" });
            return;
        }

        const user = await User.findById(currentUser._id);
        if (!user) {
            res.status(401).json({ success: false, message: "Not authorized, user not found" });
            return;
        }

        // Safe to run twice: If already marked as deleted, return success immediately
        if (user.isDeleted) {
            res.status(200).json({ success: true, message: "Account deleted" });
            return;
        }

        // 1. Only role "customer" can self-delete
        if (user.role !== "customer") {
            res.status(403).json({
                success: false,
                message: "Please contact support to delete this account."
            });
            return;
        }

        // 2. Refuse with 409 if the user has any order that is not finished (not delivered or cancelled)
        const activeOrder = await Order.findOne({
            user: user._id,
            orderStatus: { $nin: ["delivered", "cancelled"] }
        });

        if (activeOrder) {
            res.status(409).json({
                success: false,
                message: "You have an active order. You can delete your account after it is completed."
            });
            return;
        }

        // 3. Require body { "confirm": "DELETE" }, otherwise 400
        if (!req.body || req.body.confirm !== "DELETE") {
            res.status(400).json({
                success: false,
                message: 'Confirmation required. Please provide { "confirm": "DELETE" } in request body.'
            });
            return;
        }

        const userIdStr = user._id.toString();

        // 4. Execution steps in order:
        // a. Delete user's saved addresses, cart, notification device tokens/preferences, reviews, and transient payment intents
        await Promise.allSettled([
            Address.deleteMany({ user: user._id }),
            Cart.deleteMany({ user: user._id }),
            DeviceToken.deleteMany({ user: user._id }),
            Review.deleteMany({ user: user._id }),
            PaymentIntent.deleteMany({ user: user._id })
        ]);

        // b. If the user has a Firebase uid (not starting with "mock-"), call admin.auth().deleteUser(uid) in try/catch
        if (user.firebaseUid && !user.firebaseUid.startsWith("mock-")) {
            try {
                await admin.auth().deleteUser(user.firebaseUid);
            } catch (fbError: any) {
                console.error(`[deleteMyAccount] Firebase user deletion skipped/failed for user ${userIdStr}:`, fbError?.message || fbError);
            }
        }

        // c. If the user has a Cloudinary profile photo, delete it from Cloudinary (try/catch)
        if (user.profilePhoto?.publicId) {
            try {
                await deleteFromCloudinary(user.profilePhoto.publicId);
            } catch (cloudError: any) {
                console.error(`[deleteMyAccount] Cloudinary photo deletion failed for user ${userIdStr}:`, cloudError?.message || cloudError);
            }
        }

        // d. Remove the Redis session/cache for this user
        await Promise.allSettled([
            sessionCacheService.deleteSession(userIdStr),
            cartCacheService.deleteCachedCart(userIdStr)
        ]);

        // e. Anonymise the User document:
        // name "Deleted User", phone "deleted_<userId>", clear addresses, photo, firebaseUid, isDeleted=true, deletedAt=now
        user.name = "Deleted User";
        user.phone = `deleted_${userIdStr}`;
        user.addresses = [];
        user.profilePhoto = undefined;
        user.firebaseUid = undefined;
        user.isDeleted = true;
        user.deletedAt = new Date();
        await user.save();

        // Ensure sparse indexed and subdocument fields are completely unset in MongoDB
        await User.updateOne(
            { _id: user._id },
            {
                $unset: {
                    firebaseUid: 1,
                    profilePhoto: 1
                }
            }
        );

        // f. Keep order records for accounting/legal reasons (do not delete orders).
        // 6. Return response without logging phone numbers or tokens
        console.log(`[deleteMyAccount] Account anonymized and deleted successfully for user ID: ${userIdStr}`);
        res.status(200).json({ success: true, message: "Account deleted" });
    } catch (error: any) {
        console.error("[deleteMyAccount] Account deletion failed:", error?.message || error);
        res.status(500).json({ success: false, message: "Failed to delete account. Please try again." });
    }
};
