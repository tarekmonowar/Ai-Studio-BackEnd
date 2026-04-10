import OpenAI from "openai";
import { z } from "zod";
import type { AgentToolCall, AgentToolName } from "./AiAgents.types.js";

// ─── Argument Schemas ────────────────────────────────────────────────────────
// Zod schemas validate the raw JSON arguments returned by the AI model
// before we use them, preventing malformed data from reaching our services.

const mapsToArgsSchema = z.object({
  page_name: z.string().min(1),
});

const sendEmailArgsSchema = z.object({
  recipient: z.string().email(),
  body: z.string().min(1),
});

const updateStyleArgsSchema = z.object({
  property: z.string().min(1),
  value: z.string().min(1),
});

// ─── Tool Definitions ────────────────────────────────────────────────────────
// These definitions are sent to the AI model to tell it what actions it can take.

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "maps_to",
      description: "Navigate user to a requested page route.",
      parameters: {
        type: "object",
        properties: {
          page_name: {
            type: "string",
            description:
              "Human-readable page name like generative ai or analytical-ai.",
          },
        },
        required: ["page_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email through backend Resend service.",
      parameters: {
        type: "object",
        properties: {
          recipient: {
            type: "string",
            description: "Email recipient address.",
          },
          body: {
            type: "string",
            description: "Email message body.",
          },
        },
        required: ["recipient", "body"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_site_style",
      description:
        "Update style in AI Agents page only (local user session customizer).",
      parameters: {
        type: "object",
        properties: {
          property: {
            type: "string",
            description:
              "Style property key. Valid values: theme, primary_color, font_size, background_color (page background), chatbot_background_color (chat panel background).",
          },
          value: {
            type: "string",
            description: "New value for the style property.",
          },
        },
        required: ["property", "value"],
        additionalProperties: false,
      },
    },
  },
];

// ─── Tool Call Parser ────────────────────────────────────────────────────────

/**
 * Parses a raw tool call returned by the AI model into our typed AgentToolCall.
 * Validates arguments using the correct Zod schema for each tool.
 * Returns null if the tool is unknown or the arguments are invalid.
 */
export function parseToolCall(
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
): AgentToolCall | null {
  if (toolCall.type !== "function") {
    return null;
  }

  const toolName = toolCall.function.name as AgentToolName;
  const callId = toolCall.id || crypto.randomUUID();

  let parsedArguments: unknown;
  try {
    parsedArguments = JSON.parse(toolCall.function.arguments);
  } catch {
    return null;
  }

  if (toolName === "maps_to") {
    const result = mapsToArgsSchema.safeParse(parsedArguments);
    if (!result.success) return null;
    return { id: callId, name: toolName, arguments: result.data };
  }

  if (toolName === "send_email") {
    const result = sendEmailArgsSchema.safeParse(parsedArguments);
    if (!result.success) return null;
    return { id: callId, name: toolName, arguments: result.data };
  }

  if (toolName === "update_site_style") {
    const result = updateStyleArgsSchema.safeParse(parsedArguments);
    if (!result.success) return null;
    return { id: callId, name: toolName, arguments: result.data };
  }

  return null;
}
