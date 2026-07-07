import { readFileSync } from "node:fs";
import { logger } from "../logs/logger.js";
import type { Task } from "../../types/task.js";
import type { InternalSystemRequestConfig } from "../../types/internal-system-request-config.js";
import { Metrics } from "../metrics/metrics.js";


export type TaskResult = {
  ok: boolean;
  status: number | null;
  responseBody: string;
  error?: string;
};

// Loaded once at module import. Value is reused for every task — the file is
// never re-read at runtime. Restart the process to pick up changes.
const internalSystemRequestConfig = loadInternalSystemRequestConfig();

function loadInternalSystemRequestConfig(): InternalSystemRequestConfig | null {
  const path = process.env.INTERNAL_SYSTEM_REQUEST_CONFIG;
  if (!path) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as InternalSystemRequestConfig;
    logger.info("internal_system_config_loaded", {
      path,
      headerNames: parsed.headers ? Object.keys(parsed.headers) : [],
    });
    return parsed;
  } catch (err) {
    logger.error("internal_system_config_load_failed", {
      path,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
}

export class TaskProcessor {
  async process(task: Task): Promise<TaskResult> {
    const baseUrl = process.env.INTERNAL_SYSTEM_URL;
    const authHeaderName = process.env.INTERNAL_AUTHORIZATION_HEADER_NAME ?? 'Authorization';
    const authHeaderValue = process.env.INTERNAL_AUTHORIZATION_HEADER_VALUE;

    if (!baseUrl) {
      Metrics.tickTasksFailed()
      logger.error("task_processor_misconfigured", {
        hasUrl: Boolean(baseUrl),
        hasAuth: Boolean(authHeaderName) && Boolean(authHeaderValue),
      });
      const result: TaskResult = {
        ok: false,
        status: null,
        responseBody: "",
        error:
          "INTERNAL_SYSTEM_URL or INTERNAL_AUTHORIZATION_HEADER not configured",
      };
      await this.report(task, result);
      return result;
    }

    const url = `${baseUrl}${task.uri}`;
    const headers: Record<string, string> = {};
    if (internalSystemRequestConfig?.headers) {
      Object.assign(headers, internalSystemRequestConfig.headers);
    }
    if (authHeaderName && authHeaderValue) {
      headers[authHeaderName] = authHeaderValue;
    }
    const init: RequestInit = {
      method: task.method,
      headers,
    };

    if (task.body !== null && task.body !== undefined && !isBodyless(task.method)) {
      init.body = JSON.stringify(task.body);
      if (!hasHeader(headers, "Content-Type")) {
        headers["Content-Type"] = "application/json";
      }
    }

    const startedAt = Date.now();
    logger.info("task_started", {
      id: task.stargate_task_id,
      method: task.method,
      uri: task.uri,
      target: url,
      hasBody: init.body !== undefined,
    });

    let result: TaskResult;
    try {
      const res = await fetch(url, init);
      const responseBody = await res.text();
      logger.info("task_processed", {
        id: task.stargate_task_id,
        method: task.method,
        uri: task.uri,
        status: res.status,
        ok: res.ok,
        durationMs: Date.now() - startedAt,
      });
      Metrics.tickTasksCompleted()
      result = {
        ok: res.ok,
        status: res.status,
        responseBody,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Metrics.tickTasksFailed()
      logger.error("task_process_error", {
        id: task.stargate_task_id,
        method: task.method,
        uri: task.uri,
        message,
        durationMs: Date.now() - startedAt,
      });
      result = {
        ok: false,
        status: null,
        responseBody: "",
        error: message,
      };
    }

    await this.report(task, result);
    return result;
  }

  private async report(task: Task, result: TaskResult): Promise<void> {
    const stargateUrl = process.env.ALLOY_API_URL;
    const apiKey = process.env.ALLOY_API_KEY;

    if (!stargateUrl || !apiKey) {
      Metrics.tickTasksReportFailed()
      logger.error("task_report_misconfigured", {
        id: task.stargate_task_id,
        hasUrl: Boolean(stargateUrl),
        hasKey: Boolean(apiKey),
      });
      return;
    }

    const url = `${stargateUrl}/api/private/stargate/${encodeURIComponent(task.stargate_task_id)}`;
    const body = JSON.stringify({
      ok: result.ok,
      status: result.status,
      body: tryParseJson(result.responseBody),
      error: result.error,
    });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body,
      });
      Metrics.tickTasksReportCompleted()
      logger.info("task_reported", {
        id: task.stargate_task_id,
        status: res.status,
        ok: res.ok,
      });
    } catch (err) {
      Metrics.tickTasksReportFailed()
      logger.error("task_report_error", {
        id: task.stargate_task_id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function isBodyless(method: string): boolean {
  const m = method.toUpperCase();
  return m === "GET" || m === "HEAD";
}

function tryParseJson(text: string): unknown {
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
