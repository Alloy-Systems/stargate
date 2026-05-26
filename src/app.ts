import express, { type Application } from "express";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { apiRouter } from "./routes/api.js";

export function createApp(): Application {
  const app = express();

  app.use(requestLogger);

  // Proxy must run before express.json() so the raw request body is forwarded
  // unchanged (supports any content-type, not just JSON).
  app.use("/api", apiRouter);

  app.use(express.json());

  app.use(healthRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  app.use(errorHandler);

  return app;
}
