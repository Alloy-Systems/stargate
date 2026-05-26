import type { Request, Response, NextFunction } from "express";
import { logger } from "../components/logs/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    logger.info("request", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs,
    });
  });
  next();
}
