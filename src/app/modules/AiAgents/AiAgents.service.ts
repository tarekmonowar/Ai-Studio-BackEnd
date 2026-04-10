import type OpenAI from "openai";
import type { AppEnv } from "../../config/env.js";
import { getOpenAIClient } from "./AiAgents.client.js";
import { createDeterministicEmailToolCall } from "./AiAgents.emailHelpers.js";
import { SYSTEM_PROMPT } from "./AiAgents.prompts.js";
import { TOOL_DEFINITIONS, parseToolCall } from "./AiAgents.tools.js";
import type {
  AgentChatRequest,
  AgentChatResponse,
  AgentRole,
  AgentToolCall,
} from "./AiAgents.types.js";

// Maps our internal role type to the OpenAI API role format
function mapRole(role: AgentRole): "user" | "assistant" {
  return role === "assistant" ? "assistant" : "user";
}

// Extracts the plain text reply from the AI's assistant message object
function getAssistantText(
  message: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
): string {
  if (typeof message.content === "string") {
    return message.content.trim();
  }
  return "";
}

/**
 * Main entry point for the AI Agents chat feature.
 *
 * Flow:
 * 1. Try a fast deterministic email match (avoids an AI call for simple requests).
 * 2. Fall back to the AI model for intent classification and tool selection.
 */
export async function createAgentChatResponse(
  request: AgentChatRequest,
  env: AppEnv,
): Promise<AgentChatResponse> {
  const latestUserMessage =
    [...request.messages].reverse().find((message) => message.role === "user")
      ?.content ?? "";

  // Fast path: handle obvious email requests without calling the AI model
  const deterministicEmailResponse =
    createDeterministicEmailToolCall(latestUserMessage);
  if (deterministicEmailResponse) {
    return deterministicEmailResponse;
  }

  // AI path: send message history to the model and parse the response
  const { client, model } = getOpenAIClient(env);

  const history = request.messages.slice(-12).map((message) => ({
    role: mapRole(message.role),
    content: message.content,
  })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];

  const completion = await client.chat.completions.create({
    model,
    tool_choice: "auto",
    tools: TOOL_DEFINITIONS,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
    ],
  });

  const completionMessage = completion.choices[0]?.message;

  if (!completionMessage) {
    return {
      assistantMessage: "I could not produce a response. Please try again.",
      toolCalls: [],
    };
  }

  const toolCalls = (completionMessage.tool_calls ?? [])
    .map((toolCall) => parseToolCall(toolCall))
    .filter((value): value is AgentToolCall => value !== null);

  const assistantMessage = getAssistantText(completionMessage);

  return {
    assistantMessage:
      assistantMessage ||
      (toolCalls.length > 0
        ? "I can do that. Please confirm before I execute the action."
        : "Could you clarify what you want me to do?"),
    toolCalls,
  };
}
