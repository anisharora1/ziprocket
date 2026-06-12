import { Response } from "express";

let clients: Response[] = [];

// Initialize keep-alive interval to prevent timeout in reverse proxies (like nginx or ALB)
setInterval(() => {
    clients.forEach(client => {
        try {
            client.write(`: ping\n\n`);
        } catch (err) {
            // client will be cleaned up on close event
        }
    });
}, 30000);

export const addClient = (res: Response) => {
    clients.push(res);
    console.log(`[Platform SSE] Client connected. Total active connections: ${clients.length}`);
};

export const removeClient = (res: Response) => {
    clients = clients.filter(client => client !== res);
    console.log(`[Platform SSE] Client disconnected. Total active connections: ${clients.length}`);
};

export const broadcastSettings = (settings: any) => {
    const payload = JSON.stringify(settings);
    console.log(`[Platform SSE] Broadcasting settings to ${clients.length} clients`);
    clients.forEach(client => {
        try {
            client.write(`data: ${payload}\n\n`);
        } catch (err: any) {
            console.error("[Platform SSE] Broadcast write error:", err.message);
        }
    });
};
