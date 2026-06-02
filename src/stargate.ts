import { logger } from "./components/logs/logger.js";
import type { Task } from "./types/task.js";
import { TaskProcessor } from "./components/tasks/TaskProcessor.js";
import { Metrics } from "./components/metrics/metrics.js";

type StargateResponse = {
  success: boolean;
  data: Task[];
};

const BACKOFF_SCHEDULE_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

export type StargateDaemon = {
  stop: () => Promise<void>;
};

export function startStargatePolling(): StargateDaemon {
  const baseUrl = process.env.ALLOY_API_URL;
  const apiKey = process.env.ALLOY_API_KEY;
  const system = process.env.INTERNAL_SYSTEM;

  if (!baseUrl || !apiKey || !system) {
    Metrics.setStargatePollingStatusSuccess(false);
    logger.warn("stargate_disabled", {
      hasUrl: Boolean(baseUrl),
      hasKey: Boolean(apiKey),
      hasSystem: Boolean(system),
    });
    return { stop: async () => {} };
  }

  const url = `${baseUrl}/api/private/stargate/?system=${encodeURIComponent(system)}`;
  const controller = new AbortController();
  const processor = new TaskProcessor();
  let stopped = false;
  let failures = 0;

  const loop = (async () => {
    logger.info("stargate_started", { url });
    Metrics.setStargatePollingStatusSuccess(true);
    while (!stopped) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { "api-key": apiKey },
          signal: controller.signal,
        });

        if (!res.ok) {
          Metrics.tickStargatePollsFailed()
          const text = await res.text().catch(() => "");
          throw new Error(
            `stargate returned HTTP ${res.status}: ${text.slice(0, 200)}`
          );
        }
        Metrics.tickStargatePollsCompleted()
        const payload = (await res.json()) as StargateResponse;
        const tasks = Array.isArray(payload?.data) ? payload.data : [];
        if (tasks.length > 0) {
          logger.info("stargate_batch_received", { count: tasks.length });
          Metrics.increaseTasksReceived(tasks.length)
          tasks.map((task) => processor.process(task));
        }
        failures = 0;
      } catch (err) {
        if (stopped || isAbortError(err)) break;
        Metrics.tickStargatePollsFailed()
        const delayMs =
          BACKOFF_SCHEDULE_MS[Math.min(failures, BACKOFF_SCHEDULE_MS.length - 1)] ??
          BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1]!;
        logger.warn("stargate_poll_error", {
          error: serializeError(err),
          failures,
          retryInMs: delayMs,
        });
        failures += 1;
        await abortableSleep(delayMs, controller.signal);
      }
    }
    logger.info("stargate_stopped");
  })();

  return {
    stop: async () => {
      stopped = true;
      controller.abort();
      await loop;
    },
  };
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function serializeError(err: unknown): unknown {
  if (err === null || err === undefined) return undefined;
  if (err instanceof AggregateError) {
    return {
      name: err.name,
      message: err.message,
      errors: err.errors.map(serializeError),
    };
  }
  if (err instanceof Error) {
    const withExtras = err as Error & { code?: unknown; cause?: unknown };
    return {
      name: err.name,
      message: err.message,
      code: withExtras.code,
      cause: serializeError(withExtras.cause),
    };
  }
  return String(err);
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      resolve();
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
