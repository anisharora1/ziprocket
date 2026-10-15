import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import * as sessionCacheService from "../services/sessionCacheService";

export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            const token = req.headers.authorization.split(" ")[1];
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret") as any;
                if (decoded && decoded.id) {
                    let cachedUser = await sessionCacheService.getSession(decoded.id);
                    let user;

                    if (cachedUser) {
                        user = new User(cachedUser);
                    } else {
                        user = await User.findById(decoded.id).select("-password");
                        if (user) {
                            await sessionCacheService.setSession(decoded.id, user.toObject());
                        }
                    }

                    if (user && !user.isBlocked) {
                        req.user = user;
                    }
                }
            }
        } catch (error) {
            // Optional auth silently ignores expired/malformed tokens and proceeds as guest
        }
    }
    next();
};
