// server/server.ts
import 'dotenv/config';
import http from 'http';

import app from "./src/app";
import dbConnect from "./src/config/dbConnect";
import { initSocketServer } from "./src/services/socketService";

const PORT = process.env.PORT || 5000;

// Wrap Express app in a native HTTP server so Socket.IO can attach to the same port
const httpServer = http.createServer(app);

// Initialize Socket.IO on the HTTP server
initSocketServer(httpServer);

httpServer.listen(PORT, () => {
    try {
        console.log(`Server running on port ${PORT}`);
        dbConnect();
    } catch (e: any) {
        console.log(e.message);
    }
});