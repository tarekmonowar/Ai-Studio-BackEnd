import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppEnv } from "../../config/env.js";
import { getStoredLogs } from "../../utils/logger.js";

function getPathname(req: IncomingMessage): string {
  return new URL(req.url ?? "/", "http://localhost").pathname;
}

export function handleGetLogsRoute(
  req: IncomingMessage,
  res: ServerResponse,
  env: AppEnv,
): boolean {
  if (req.method !== "GET") {
    return false;
  }

  if (getPathname(req) !== "/getLogs") {
    return false;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", env.CORS_ORIGIN);
  res.end(
    JSON.stringify({
      ok: true,
      files: getStoredLogs(),
    }),
  );

  return true;
}
