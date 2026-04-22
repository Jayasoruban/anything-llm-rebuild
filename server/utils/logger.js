// ============================================================================
//  Logger — structured logging via winston
// ============================================================================
//  All server logs go through this. Gives consistent timestamps + levels.
//  In dev: pretty-printed colored output. In prod: JSON for log aggregators.
// ============================================================================

const winston = require("winston");

const isDev = process.env.NODE_ENV !== "production";

const logger = winston.createLogger({
  level: isDev ? "debug" : "info",
  format: isDev
    ? winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} ${level} ${message}`;
        })
      )
    : winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
