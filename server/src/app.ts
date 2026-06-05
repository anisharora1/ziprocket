import express from "express";
import cors from "cors";

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

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", payoutRoutes);
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
import { Request, Response, NextFunction } from "express";

app.use("/api/applications", applicationRoutes);

app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

// Global Error Handler to catch Multer and other unhandled errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Global Error Handler caught:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export default app;