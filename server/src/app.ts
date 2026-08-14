import express from "express";
import cors from "cors";

// Security Middlewares
import helmetMiddleware from "./middlewares/helmetMiddleware";
import securityHeadersMiddleware from "./middlewares/securityHeadersMiddleware";
import { globalLimiter } from "./middlewares/rateLimitMiddleware";
import { nosqlSanitizer, xssSanitizer } from "./middlewares/authSecurityMiddleware";
import { errorHandler } from "./middlewares/errorHandler";

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

// CORS configuration
app.use(cors());

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

// Global Error Handler to catch Multer and other unhandled errors
app.use(errorHandler);

export default app;