import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppEnv } from "./app/config/env.js";
import { handleHttpRoutes } from "./app/routes/index.js";
import { applyCorsHeaders, applyPreflightHeaders } from "./app/utils/cors.js";
import { logger } from "./app/utils/logger.js";

function setCorsHeader(
  req: IncomingMessage,
  res: ServerResponse,
  env: AppEnv,
): void {
  applyCorsHeaders(req, res, env);
}

function handleOptionsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: AppEnv,
): boolean {
  if (req.method !== "OPTIONS") {
    return false;
  }

  setCorsHeader(req, res, env);
  applyPreflightHeaders(req, res);
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

    setCorsHeader(req, res, env);
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, message: "Not Found" }));
  } catch (error) {
    logger.error("Unhandled HTTP request error", error);
    setCorsHeader(req, res, env);
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
