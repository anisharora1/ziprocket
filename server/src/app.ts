import express from "express";
import cors from "cors";
import compression from "compression";
import mongoose from "mongoose";

// Security Middlewares
import helmetMiddleware from "./middlewares/helmetMiddleware";
import securityHeadersMiddleware from "./middlewares/securityHeadersMiddleware";
import { globalLimiter } from "./middlewares/rateLimitMiddleware";
import { nosqlSanitizer, xssSanitizer } from "./middlewares/authSecurityMiddleware";
import { errorHandler } from "./middlewares/errorHandler";
import { getClient as getRedisClient } from "./services/redisService";

import authRoutes from "./routes/authRoutes";
import adminRoutes from "./routes/adminRoutes";
import restaurantRoutes from "./routes/restaurantRoutes";
import orderRoutes from "./routes/orderRoutes";
import deliveryRoutes from "./routes/deliveryRoutes";
import deliveryZoneRoutes from "./routes/deliveryZoneRoutes";
import applicationRoutes from "./routes/applicationRoutes";
import groceryRoutes from "./routes/groceryRoutes";
import payoutRoutes from "./routes/payoutRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import addressRoutes from "./routes/addressRoutes";
import locationRoutes from "./routes/locationRoutes";
import couponRoutes from "./routes/couponRoutes";
import cartRoutes from "./routes/cartRoutes";
import recommendationRoutes from "./routes/recommendationRoutes";
import searchRoutes from "./routes/searchRoutes";
import promotionsRoutes from "./routes/promotionsRoutes";
import platformRoutes from "./routes/platformRoutes";
import { responseStandardizer } from "./middlewares/responseStandardizer";

const app = express();

// Enable Response Standardizer early in the middleware stack
app.use(responseStandardizer);

// Set trust proxy to true (1) if behind a load balancer (Haproxy, Nginx, AWS ALB, etc.)
// This ensures express-rate-limit correctly resolves client IP addresses rather than the load balancer's IP.
app.set("trust proxy", 1);

// Enable security headers (Helmet.js)
app.use(helmetMiddleware);

// Enable auxiliary custom headers
app.use(securityHeadersMiddleware);

// Enable response compression (gzip/deflate) to optimize payload transfer sizes
app.use(compression());

// CORS configuration with explicit allowlist
const defaultAllowedOrigins = [
  "https://ziprocket.in",
  "https://www.ziprocket.in",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173"
];

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : defaultAllowedOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl, mobile tools)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true
  })
);

// Configure body limits to prevent payload flooding / DoS attacks
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Enable recursive input sanitization against NoSQL Injections and XSS scripting
app.use(nosqlSanitizer);
app.use(xssSanitizer);

// Apply global rate limiting to all requests
app.use(globalLimiter);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/payouts", payoutRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/delivery-zones", deliveryZoneRoutes);
app.use("/api/grocery", groceryRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/promotions", promotionsRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/applications", applicationRoutes);

app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

// Health check endpoint for monitoring and deployment platforms (e.g., Render)
app.get("/health", (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const redisClient = getRedisClient();
  const redisStatus = redisClient && redisClient.status === "ready" ? "connected" : "disconnected";

  const isHealthy = mongoStatus === "connected" && redisStatus === "connected";
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isHealthy ? "ok" : "error",
    mongo: mongoStatus,
    redis: redisStatus
  });
});

// Global Error Handler to catch Multer and other unhandled errors
app.use(errorHandler);

export default app;