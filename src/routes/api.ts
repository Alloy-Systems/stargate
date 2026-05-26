import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Readable } from "node:stream";
import { logger } from "../components/logs/logger.js";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

export const apiRouter = Router();

apiRouter.all(/.*/, async (req, res, next) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const baseUrl = process.env.ALLOY_API_URL;
  const apiKey = process.env.ALLOY_API_KEY;

  if (!baseUrl || !apiKey) {
    logger.error("gateway_misconfigured", {
      requestId,
      hasUrl: Boolean(baseUrl),
      hasKey: Boolean(apiKey),
    });
    res.status(502).json({ error: "Upstream not configured" });
    return;
  }

  const targetUrl = `${baseUrl}/api${req.url}`;

  logger.info("gateway_request", {
    requestId,
    method: req.method,
    path: req.originalUrl,
    target: targetUrl,
    contentType: req.headers["content-type"],
    contentLength: req.headers["content-length"],
    userAgent: req.headers["user-agent"],
  });

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (HOP_BY_HOP.has(name.toLowerCase())) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(name, v);
    } else {
      headers.set(name, value);
    }
  }
  headers.set("api-key", apiKey);

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = Readable.toWeb(req) as unknown as BodyInit;
    init.duplex = "half";
  }

  try {
    const upstream = await fetch(targetUrl, init);

    logger.info("gateway_response", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      target: targetUrl,
      upstreamStatus: upstream.status,
      upstreamContentType: upstream.headers.get("content-type"),
      upstreamContentLength: upstream.headers.get("content-length"),
      durationMs: Date.now() - startedAt,
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    if (upstream.body) {
      Readable.fromWeb(upstream.body as never).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    logger.error("gateway_error", {
      requestId,
      target: targetUrl,
      method: req.method,
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    });
    next(err);
  }
});

export default apiRouter;
