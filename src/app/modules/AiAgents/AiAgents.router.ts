import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type { AppEnv } from "../../config/env.js";
import { readJsonBody, sendJsonResponse } from "../../utils/http.js";
import { createAgentChatResponse } from "./AiAgents.service.js";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const agentChatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
});

export async function handleAgentChatRoute(
  req: IncomingMessage,
  res: ServerResponse,
  env: AppEnv,
): Promise<boolean> {
  if (req.method !== "POST") {
    return false;
  }

  try {
    const body = await readJsonBody(req);
    const parsedRequest = agentChatRequestSchema.parse(body);
    const response = await createAgentChatResponse(parsedRequest, env);

    sendJsonResponse(res, {
      req,
      statusCode: 200,
      payload: {
        ok: true,
        ...response,
      },
      env,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to process AI request.";

    sendJsonResponse(res, {
      req,
      statusCode: 400,
      payload: {
        ok: false,
        message,
      },
      env,
    });
  }

  return true;
}
