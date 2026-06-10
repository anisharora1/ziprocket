import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

// --- NOSQL INJECTION SANITIZATION ---
const hasMongoOperator = (obj: any): boolean => {
    if (!obj || typeof obj !== "object") return false;
    for (const key in obj) {
        if (key.startsWith("$") || key.includes(".")) return true;
        if (typeof obj[key] === "object" && hasMongoOperator(obj[key])) return true;
    }
    return false;
};

const sanitizeMongo = (obj: any): any => {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
        return obj.map(sanitizeMongo);
    }
    const sanitized: any = {};
    for (const key in obj) {
        // Strip out any keys starting with $ or containing a dot
        if (!key.startsWith("$") && !key.includes(".")) {
            sanitized[key] = sanitizeMongo(obj[key]);
        }
    }
    return sanitized;
};

export const nosqlSanitizer = (req: Request, res: Response, next: NextFunction): void => {
    let injectionDetected = false;
    
    if (req.body && hasMongoOperator(req.body)) {
        injectionDetected = true;
        const sanitized = sanitizeMongo(req.body);
        for (const key in req.body) {
            delete req.body[key];
        }
        Object.assign(req.body, sanitized);
    }
    
    if (req.query && hasMongoOperator(req.query)) {
        injectionDetected = true;
        const sanitized = sanitizeMongo(req.query);
        for (const key in req.query) {
            delete req.query[key];
        }
        Object.assign(req.query, sanitized);
    }
    
    if (req.params && hasMongoOperator(req.params)) {
        injectionDetected = true;
        const sanitized = sanitizeMongo(req.params);
        for (const key in req.params) {
            delete req.params[key];
        }
        Object.assign(req.params, sanitized);
    }
    
    if (injectionDetected) {
        console.warn(`[SECURITY WARNING] Potential NoSQL injection attempt sanitized. IP: ${req.ip}, Path: ${req.originalUrl}`);
    }
    next();
};

// --- XSS PROTECTION SANITIZATION ---
const escapeHtml = (str: string): string => {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;");
};

const sanitizeXss = (obj: any): any => {
    if (typeof obj === "string") {
        return escapeHtml(obj);
    }
    if (obj && typeof obj === "object") {
        if (Array.isArray(obj)) {
            return obj.map(sanitizeXss);
        }
        const sanitized: any = {};
        for (const key in obj) {
            sanitized[key] = sanitizeXss(obj[key]);
        }
        return sanitized;
    }
    return obj;
};

export const xssSanitizer = (req: Request, res: Response, next: NextFunction): void => {
    if (req.body) {
        const sanitized = sanitizeXss(req.body);
        for (const key in req.body) {
            delete req.body[key];
        }
        Object.assign(req.body, sanitized);
    }
    
    if (req.query) {
        const sanitized = sanitizeXss(req.query);
        for (const key in req.query) {
            delete req.query[key];
        }
        Object.assign(req.query, sanitized);
    }
    
    if (req.params) {
        const sanitized = sanitizeXss(req.params);
        for (const key in req.params) {
            delete req.params[key];
        }
        Object.assign(req.params, sanitized);
    }
    
    next();
};

// --- MONGO OBJECTID PARAMETER VALIDATION ---
export const validateObjectId = (paramNames: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        for (const param of paramNames) {
            const val = req.params[param];
            if (val) {
                const isInvalid = typeof val !== "string" || !mongoose.Types.ObjectId.isValid(val);
                if (isInvalid) {
                    console.warn(`[SECURITY WARNING] Invalid MongoDB ObjectId format for parameter [${param}]: "${val}". IP: ${req.ip}`);
                    res.status(400).json({
                        success: false,
                        message: `Invalid identifier format: ${val}`
                    });
                    return;
                }
            }
        }
        next();
    };
};
