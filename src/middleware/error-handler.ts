import type { Request, Response, NextFunction } from "express";
import { ValidationError } from "express-validation";
import { logger } from "../components/logs/logger.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ValidationError) {
    logger.warn("validation_error", {
      method: req.method,
      url: req.originalUrl,
      details: err.details,
    });
    res.status(400).json({ error: "ValidationError", details: err.details });
    return;
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  ) {
    const status = (err as { status: number }).status;
    if (status >= 400 && status < 500) {
      const message =
        "message" in err && typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Bad Request";
      logger.warn("client_error", {
        method: req.method,
        url: req.originalUrl,
        status,
        message,
      });
      res.status(status).json({ error: message });
      return;
    }
  }

  const error = err instanceof Error ? err : new Error(String(err));
  logger.error("internal_error", {
    method: req.method,
    url: req.originalUrl,
    message: error.message,
    stack: error.stack,
  });
  res.status(500).json({ error: "Internal Server Error" });
}
