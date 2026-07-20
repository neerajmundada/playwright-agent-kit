import winston from "winston";
import path from "path";
import fs from "fs";

// Ensure logs directory exists
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for consistency
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (stack) {
      logMessage += `\n${stack}`;
    }
    if (Object.keys(meta).length > 0) {
      logMessage += ` | ${JSON.stringify(meta)}`;
    }
    return logMessage;
  }),
);

// Logger configuration for different environments
const getLogLevel = (): string => {
  const env = process.env.NODE_ENV || "development";
  const level = process.env.LOG_LEVEL || "info";
  return env === "production" ? "warn" : level;
};

export const logger = winston.createLogger({
  level: getLogLevel(),
  format: customFormat,
  defaultMeta: {
    service: "pw-tests",
    environment: process.env.NODE_ENV || "development",
  },
  transports: [
    // Console transport - always enabled
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), customFormat),
    }),

    // File transport - all logs
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport - errors only
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport - test execution
    new winston.transports.File({
      filename: path.join(logsDir, "test-execution.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
});

// Log unhandled exceptions
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logsDir, "exceptions.log"),
  }),
);

// Log unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at Promise", {
    promise,
    reason,
  });
});

export default logger;
