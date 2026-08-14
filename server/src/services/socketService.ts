// server/src/services/socketService.ts
import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import jwt from "jsonwebtoken";
import User from "../models/User";
import Restaurant from "../models/Restaurant";

let io: SocketIOServer | null = null;

/**
 * Initializes the Socket.IO server and attaches it to the given HTTP server.
 * Call this once from server.ts after creating the HTTP server.
 */
export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || "*",
            methods: ["GET", "POST"],
            credentials: true,
        },
        // Tune transport and ping settings for reliability
        transports: ["websocket", "polling"],
        pingTimeout: 30000,
        pingInterval: 10000,
    });

    // --- Redis Adapter for multi-process scalability ---
    // Use dedicated pub/sub clients (NOT the cache client) to avoid blocking
    const redisEnabled = process.env.REDIS_ENABLED !== "false";
    if (redisEnabled) {
        try {
            const redisOpts = {
                host: process.env.REDIS_HOST || "127.0.0.1",
                port: Number(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                maxRetriesPerRequest: null, // required for pub/sub clients
                enableOfflineQueue: true,
            };
            const pubClient = new Redis(redisOpts);
            const subClient = pubClient.duplicate();

            pubClient.on("error", (err) => console.error("[Socket Redis Pub Error]", err.message));
            subClient.on("error", (err) => console.error("[Socket Redis Sub Error]", err.message));

            io.adapter(createAdapter(pubClient, subClient));
            console.log("Socket.IO Redis adapter attached ✅");
        } catch (err: any) {
            console.error("[Socket.IO] Failed to attach Redis adapter, falling back to in-memory:", err.message);
        }
    }

    // --- JWT Authentication Middleware ---
    io.use(async (socket: Socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace("Bearer ", "");

            if (!token) {
                return next(new Error("Authentication error: No token"));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret") as any;
            const user = await User.findById(decoded.id).select("-password").lean();

            if (!user) {
                return next(new Error("Authentication error: User not found"));
            }
            if (user.isBlocked) {
                return next(new Error("Authentication error: User is blocked"));
            }

            // Attach user data to the socket for use in connection handler
            socket.data.user = user;
            next();
        } catch (err: any) {
            console.error("[Socket.IO Auth Error]", err.message);
            next(new Error("Authentication error: Invalid token"));
        }
    });

    // --- Connection Handler ---
    io.on("connection", async (socket: Socket) => {
        const user = socket.data.user;
        if (!user) {
            socket.disconnect();
            return;
        }

        const userId = user._id.toString();
        console.log(`[Socket.IO] Connected: ${user.name} (${user.role}) | socketId: ${socket.id}`);

        // 1. Every user joins their personal room for direct messages
        socket.join(`user:${userId}`);

        // 2. Role-specific rooms
        try {
            if (user.role === "admin") {
                socket.join("admin");
            } else if (user.role === "seller") {
                // Find the restaurant owned by this seller
                const restaurant = await Restaurant.findOne({ owner: user._id }).select("_id").lean();
                if (restaurant) {
                    const restaurantId = restaurant._id.toString();
                    socket.join(`seller:${restaurantId}`);
                    socket.data.restaurantId = restaurantId;
                    console.log(`[Socket.IO] Seller ${user.name} joined room: seller:${restaurantId}`);
                }
            } else if (user.role === "grocery_moderator") {
                const assignedZones: any[] = (user as any).assignedZones || [];
                for (const zoneId of assignedZones) {
                    socket.join(`grocery:${zoneId.toString()}`);
                }
                console.log(`[Socket.IO] Moderator ${user.name} joined ${assignedZones.length} grocery room(s)`);
            } else if (user.role === "delivery") {
                // Join their personal delivery room (used for assignment notifications)
                socket.join(`delivery:${userId}`);
                // Optionally join zone room if profile exists — handled lazily via event
                console.log(`[Socket.IO] Delivery boy ${user.name} joined room: delivery:${userId}`);
            }
        } catch (err: any) {
            console.error("[Socket.IO] Error setting up rooms:", err.message);
        }

        // Allow delivery boy to join their zone room after loading profile
        socket.on("join_delivery_zone", (zoneId: string) => {
            if (user.role === "delivery" && zoneId) {
                socket.join(`delivery_zone:${zoneId}`);
                console.log(`[Socket.IO] Delivery ${user.name} joined zone: delivery_zone:${zoneId}`);
            }
        });

        socket.on("disconnect", (reason) => {
            console.log(`[Socket.IO] Disconnected: ${user.name} | Reason: ${reason}`);
        });
    });

    console.log("Socket.IO server initialized ✅");
    return io;
};

/**
 * Returns the initialized Socket.IO server instance.
 * Safe to call from controllers — returns null if not initialized yet.
 */
export const getIO = (): SocketIOServer | null => io;

/**
 * Emit an event to one or more rooms/sockets safely.
 * Silently skips if Socket.IO is not initialized.
 */
export const emitToRooms = (rooms: string | string[], event: string, data: any): void => {
    if (!io) return;
    const roomList = Array.isArray(rooms) ? rooms : [rooms];
    for (const room of roomList) {
        if (room) {
            io.to(room).emit(event, data);
        }
    }
};
