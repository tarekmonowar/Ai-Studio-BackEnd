import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppEnv } from "../config/env.js";

function parseAllowedOrigins(corsOrigin: string): string[] {
  return corsOrigin
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function appendVaryHeader(res: ServerResponse, value: string): void {
  const current = res.getHeader("Vary");

  if (typeof current !== "string" || current.length === 0) {
    res.setHeader("Vary", value);
    return;
  }

  const items = current
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!items.includes(value.toLowerCase())) {
    res.setHeader("Vary", `${current}, ${value}`);
  }
}

function resolveAllowedOrigin(
  req: IncomingMessage,
  env: AppEnv,
): string | null {
  const allowedOrigins = parseAllowedOrigins(env.CORS_ORIGIN);
  const requestOrigin = req.headers.origin;

  if (allowedOrigins.includes("*")) {
    return "*";
  }

  if (typeof requestOrigin !== "string" || requestOrigin.length === 0) {
    return allowedOrigins[0] ?? null;
  }

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}

export function applyCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  env: AppEnv,
): boolean {
  const allowedOrigin = resolveAllowedOrigin(req, env);
  if (!allowedOrigin) {
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  appendVaryHeader(res, "Origin");
  return true;
}

export function applyPreflightHeaders(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const requestedHeaders = req.headers["access-control-request-headers"];

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    typeof requestedHeaders === "string" && requestedHeaders.trim().length > 0
      ? requestedHeaders
      : "Content-Type, Authorization",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}
