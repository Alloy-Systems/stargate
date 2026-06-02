import { Router } from "express";
import { Metrics } from "../components/metrics/metrics.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

healthRouter.get("/metrics", (_req, res) => {
  res.json(Metrics.getMetrics());
});