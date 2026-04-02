import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppEnv } from "./app/config/env.js";
import { handleHttpRoutes } from "./app/routes/index.js";
import { logger } from "./app/utils/logger.js";

function setCorsHeader(res: ServerResponse, env: AppEnv): void {
  res.setHeader("Access-Control-Allow-Origin", env.CORS_ORIGIN);
}

function handleOptionsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: AppEnv,
): boolean {
  if (req.method !== "OPTIONS") {
    return false;
  }

  setCorsHeader(res, env);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.statusCode = 204;
  res.end();

  return true;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: AppEnv,
): Promise<void> {
  try {
    if (handleOptionsRequest(req, res, env)) {
      return;
    }

    if (await handleHttpRoutes(req, res, env)) {
      return;
    }

    setCorsHeader(res, env);
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, message: "Not Found" }));
  } catch (error) {
    logger.error("Unhandled HTTP request error", error);
    setCorsHeader(res, env);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: false,
        message: "Internal Server Error",
      }),
    );
  }
}

export function createApp(env: AppEnv) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    void handleRequest(req, res, env);
  };
}
