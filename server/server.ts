// server/server.ts
import 'dotenv/config';
import http from 'http';

import app from "./src/app";
import dbConnect from "./src/config/dbConnect";
import { initSocketServer } from "./src/services/socketService";
import { startSettlementJob } from "./src/jobs/settlementJob";
import Address from "./src/models/Address";
import Order from "./src/models/Order";

const PORT = process.env.PORT || 5000;

// Wrap Express app in a native HTTP server so Socket.IO can attach to the same port
const httpServer = http.createServer(app);

// Initialize Socket.IO on the HTTP server
initSocketServer(httpServer);

httpServer.listen(PORT, async () => {
    try {
        console.log(`Server running on port ${PORT}`);
        await dbConnect();
        
        // One-time backfill for existing saved addresses and orders missing locationSource
        try {
            await Address.updateMany({ locationSource: { $exists: false } }, { $set: { locationSource: "manual" } });
            await Order.updateMany({ "address.locationSource": { $exists: false } }, { $set: { "address.locationSource": "manual" } });
        } catch (migErr: any) {
            console.warn("Address/Order locationSource backfill skipped:", migErr.message);
        }

        startSettlementJob();
    } catch (e: any) {
        console.log(e.message);
    }
});