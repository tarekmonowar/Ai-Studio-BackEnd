import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type { AppEnv } from "../../config/env.js";
import { applyCorsHeaders } from "../../utils/cors.js";
import { readJsonBody, sendJsonResponse } from "../../utils/http.js";
import { createMessengerChatResponse } from "./messenger.server.js";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const messengerChatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
});

/**
 * Handles POST /ai/messenger-chat
 * Streams plain-text AI responses back to the client as they are generated.
 */
export async function handleMessengerChatRoute(
  req: IncomingMessage,
  res: ServerResponse,
  env: AppEnv,
): Promise<boolean> {
  if (req.method !== "POST") {
    return false;
  }

  try {
    const body = await readJsonBody(req);
    const parsedRequest = messengerChatRequestSchema.parse(body);
    const stream = await createMessengerChatResponse(parsedRequest, env);

    // CORS headers MUST be set before any data is written,
    // otherwise the browser will block the response entirely.
    applyCorsHeaders(req, res, env);

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Stream plain-text chunks as they arrive from the AI model
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        res.write(event.delta);
      }
    }

    res.end();
    return true;
  } catch (error) {
    console.error("[messenger-chat] Error:", error);

    if (!res.headersSent) {
      sendJsonResponse(res, {
        req,
        statusCode: 400,
        payload: {
          ok: false,
          message: error instanceof Error ? error.message : "AI request failed",
        },
        env,
      });
    } else {
      res.end("\n[Server error]\n");
    }

    return true;
  }
}
