import { mkdirSync } from "node:fs";
import { createLogger, format, transports } from "winston";
import type Transport from "winston-transport";

const isProduction = process.env.NODE_ENV === "production";

const devFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] ${level}: ${message}${metaString}`;
  })
);

const jsonFormat = format.combine(format.timestamp(), format.json());

const onlyLevel = (level: string) =>
  format((info) => (info.level === level ? info : false))();

const LEVELS = ["error", "warn", "info"] as const;

const loggerTransports: Transport[] = [
  new transports.Console({ format: isProduction ? jsonFormat : devFormat }),
];

const logsPath = process.env.LOGS_PATH;
if (logsPath) {
  mkdirSync(logsPath, { recursive: true });
  // Per-level files with size-based rotation. Each level gets its own file
  // with strict filtering (info.log contains info only, not info+warn+error).
  // tailable keeps the active file at <level>.log; older rotations go to
  // <level>1.log, <level>2.log, ... up to maxFiles. Disk cap per level:
  // maxsize * maxFiles = ~100 MB.
  for (const level of LEVELS) {
    loggerTransports.push(
      new transports.File({
        filename: `${logsPath}/${level}.log`,
        format: format.combine(onlyLevel(level), jsonFormat),
        maxsize: 10 * 1024 * 1024,
        maxFiles: 10,
        tailable: true,
      })
    );
  }
}

export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  transports: loggerTransports,
});
