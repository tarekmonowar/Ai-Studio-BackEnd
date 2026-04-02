import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppEnv } from "../config/env.js";

interface SendJsonOptions {
  statusCode: number;
  payload: unknown;
  env: AppEnv;
}

export async function readJsonBody(
  req: IncomingMessage,
  maxBytes = 128_000,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  return new Promise<unknown>((resolve, reject) => {
    req.on("data", (chunk: Buffer) => {
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(JSON.parse(raw) as unknown);
      } catch {
        reject(new Error("Invalid JSON payload."));
      }
    });
  });
}

export function sendJsonResponse(
  res: ServerResponse,
  { statusCode, payload, env }: SendJsonOptions,
): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", env.CORS_ORIGIN);
  res.end(JSON.stringify(payload));
}
