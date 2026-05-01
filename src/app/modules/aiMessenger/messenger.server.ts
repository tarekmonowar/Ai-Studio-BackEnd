import type { AppEnv } from "../../config/env.js";
import { getOpenAIClient } from "../AiAgents/AiAgents.client.js";
import type { AgentChatRequest } from "../AiAgents/AiAgents.types.js";
import { websiteContext } from "./messenger.prompt.js";

/**
 * Creates a streaming chat response for the AI Messenger widget.
 * Uses the website context as the system prompt so the AI can answer
 * questions about the site.
 */
export async function createMessengerChatResponse(
  request: AgentChatRequest,
  env: AppEnv,
) {
  const { client, model } = getOpenAIClient(env);

  const stream = await client.responses.stream({
    model,
    input: [
      {
        role: "system",
        content: websiteContext,
      },
      ...request.messages.map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      })),
    ],
  });

  return stream;
}
