import "dotenv/config";
import { createApp } from "./app.js";
import { logger } from "./components/logs/logger.js";
import { startStargatePolling } from "./stargate.js";

const port = Number(process.env.PORT ?? 4300);

const app = createApp();
const server = app.listen(port, () => {
  logger.info("server_listening", { port });
});

const stargate = startStargatePolling();

function shutdown(signal: string): void {
  logger.info("shutdown_started", { signal });
  Promise.resolve(stargate.stop()).finally(() => {
    server.close((err) => {
      if (err) {
        logger.error("shutdown_error", { message: err.message });
        process.exit(1);
      }
      logger.info("shutdown_complete");
      process.exit(0);
    });
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Per project decision: log uncaught errors but keep the process alive.
// Node's default would be to crash on uncaughtException (and, since Node 15,
// on unhandledRejection too). Acceptable for a dev starter; in production
// reconsider — the process may be in an undefined state after these fire.
process.on("uncaughtException", (err) => {
  logger.error("uncaught_exception", {
    message: err.message,
    stack: err.stack,
  });
});

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error("unhandled_rejection", {
    message: error.message,
    stack: error.stack,
  });
});
