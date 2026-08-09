import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";
import * as sessionCacheService from "../services/sessionCacheService";

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret") as any;

            // Try loading from Redis session cache first
            let cachedUser = await sessionCacheService.getSession(decoded.id);
            let user;

            if (cachedUser) {
                // Rehydrate mongoose model from cache to keep document methods intact
                user = new User(cachedUser);
            } else {
                user = await User.findById(decoded.id).select("-password");
                if (user) {
                    // Cache the plain user object in Redis
                    await sessionCacheService.setSession(decoded.id, user.toObject());
                }
            }

            if (!user) {
                res.status(401).json({ success: false, message: "Not authorized, user not found" });
                return;
            }

            if (user.isBlocked) {
                res.status(403).json({ success: false, message: "User is blocked" });
                return;
            }

            req.user = user;
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ success: false, message: "Not authorized, token failed" });
        }
    } else {
        res.status(401).json({ success: false, message: "Not authorized, no token" });
    }
};

// Role authorization middlewares
export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ 
                success: false, 
                message: `User role '${req.user?.role}' is not authorized to access this route` 
            });
            return;
        }
        next();
    };
};
