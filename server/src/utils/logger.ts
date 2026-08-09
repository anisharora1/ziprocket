/**
 * Structured Logger utility
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ||
    (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
}

export const logger = {
    debug(message: string, ...meta: any[]) {
        if (shouldLog("debug")) {
            console.debug(formatMessage("debug", message), ...meta);
        }
    },
    info(message: string, ...meta: any[]) {
        if (shouldLog("info")) {
            console.info(formatMessage("info", message), ...meta);
        }
    },
    warn(message: string, ...meta: any[]) {
        if (shouldLog("warn")) {
            console.warn(formatMessage("warn", message), ...meta);
        }
    },
    error(message: string, ...meta: any[]) {
        if (shouldLog("error")) {
            console.error(formatMessage("error", message), ...meta);
        }
    }
};
