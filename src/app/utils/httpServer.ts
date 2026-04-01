import http from "node:http";
import type { AppEnv } from "../config/env.js";
import { handleHttpRoutes } from "../routes/index.js";
import { logger } from "./logger.js";

export function createHttpServer(env: AppEnv) {
  return http.createServer((req, res) => {
    try {
      if (handleHttpRoutes(req, res, env)) {
        return;
      }
    } catch (error) {
      logger.error("Unhandled HTTP request error", error);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", env.CORS_ORIGIN);
      res.end(JSON.stringify({ ok: false, message: "Internal Server Error" }));
      return;
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", env.CORS_ORIGIN);
    res.end(JSON.stringify({ ok: false, message: "Not Found" }));
  });
}
