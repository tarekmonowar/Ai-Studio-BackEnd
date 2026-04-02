import http from "node:http";
import type { AppEnv } from "../config/env.js";
import { handleHttpRoutes } from "../routes/index.js";
import { applyCorsHeaders } from "./cors.js";
import { logger } from "./logger.js";

export function createHttpServer(env: AppEnv) {
  return http.createServer(async (req, res) => {
    try {
      if (await handleHttpRoutes(req, res, env)) {
        return;
      }

      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      applyCorsHeaders(req, res, env);
      res.end(JSON.stringify({ ok: false, message: "Not Found" }));
    } catch (error) {
      logger.error("Unhandled HTTP request error", error);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      applyCorsHeaders(req, res, env);
      res.end(JSON.stringify({ ok: false, message: "Internal Server Error" }));
    }
  });
}
