import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppEnv } from "../../config/env.js";

export function handleHealthRoute(
  req: IncomingMessage,
  res: ServerResponse,
  env: AppEnv,
): boolean {
  if (req.url !== "/health") {
    return false;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", env.CORS_ORIGIN);
  res.end(JSON.stringify({ ok: true, service: "voice-gateway" }));

  return true;
}
