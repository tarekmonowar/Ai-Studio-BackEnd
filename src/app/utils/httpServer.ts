import http from "node:http";
import type { AppEnv } from "../config/env.js";
import { handleHealthRoute } from "../modules/health/health.router.js";

export function createHttpServer(env: AppEnv) {
  return http.createServer((req, res) => {
    if (handleHealthRoute(req, res, env)) {
      return;
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, message: "Not Found" }));
  });
}
