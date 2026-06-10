import { Request, Response, NextFunction } from "express";

export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    // 1. Permissions Policy to restrict browser features
    res.setHeader(
        "Permissions-Policy",
        "geolocation=(), camera=(), microphone=(), payment=(), usb=(), vr=()"
    );

    // 2. DNS Prefetch Control
    res.setHeader("X-DNS-Prefetch-Control", "off");

    // 3. Prevent IE from executing downloads in site context
    res.setHeader("X-Download-Options", "noopen");

    // 4. Force cache control for sensitive paths (auth, payment, admin, etc.)
    const sensitivePaths = ["/api/auth", "/api/payments", "/api/admin"];
    const isSensitive = sensitivePaths.some((path) => req.originalUrl.startsWith(path));
    if (isSensitive) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
    }

    next();
};

export default securityHeadersMiddleware;
