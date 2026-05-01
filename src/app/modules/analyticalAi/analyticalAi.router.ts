import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type { AppEnv } from "../../config/env.js";
import { applyCorsHeaders } from "../../utils/cors.js";
import { readJsonBody, sendJsonResponse } from "../../utils/http.js";
import { storeEmbedding, queryEmbedding } from "./analyticalAi.service.js";

// ─── Request Schemas ─────────────────────────────────────────────────────────

const storeRequestSchema = z.object({
  text: z.string().min(1, "Text content is required"),
});

const queryRequestSchema = z.object({
  query: z.string().min(1, "Search query is required"),
});

// ─── Route Handlers ──────────────────────────────────────────────────────────

/**
 * POST /ai/vector/store
 * Embeds text and stores it in Supabase vector database.
 */
export async function handleVectorStoreRoute(
  req: IncomingMessage,
  res: ServerResponse,
  env: AppEnv,
): Promise<boolean> {
  if (req.method !== "POST") {
    return false;
  }

  try {
    applyCorsHeaders(req, res, env);

    const body = await readJsonBody(req);
    const { text } = storeRequestSchema.parse(body);
    const result = await storeEmbedding(text, env);

    sendJsonResponse(res, {
      req,
      statusCode: 200,
      payload: { ok: true, ...result },
      env,
    });
  } catch (error) {
    console.error("[vector/store] Error:", error);

    sendJsonResponse(res, {
      req,
      statusCode: 400,
      payload: {
        ok: false,
        message: error instanceof Error ? error.message : "Store failed",
      },
      env,
    });
  }

  return true;
}

/**
 * POST /ai/vector/query
 * Embeds a query and searches Supabase for semantically similar documents.
 */
export async function handleVectorQueryRoute(
  req: IncomingMessage,
  res: ServerResponse,
  env: AppEnv,
): Promise<boolean> {
  if (req.method !== "POST") {
    return false;
  }

  try {
    applyCorsHeaders(req, res, env);

    const body = await readJsonBody(req);
    const { query } = queryRequestSchema.parse(body);
    const result = await queryEmbedding(query, env);

    sendJsonResponse(res, {
      req,
      statusCode: 200,
      payload: { ok: true, ...result },
      env,
    });
  } catch (error) {
    console.error("[vector/query] Error:", error);

    sendJsonResponse(res, {
      req,
      statusCode: 400,
      payload: {
        ok: false,
        message: error instanceof Error ? error.message : "Query failed",
      },
      env,
    });
  }

  return true;
}
