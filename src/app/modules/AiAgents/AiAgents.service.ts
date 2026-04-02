import OpenAI, { AzureOpenAI } from "openai";
import { z } from "zod";
import type { AppEnv } from "../../config/env.js";
import type {
  AgentChatRequest,
  AgentChatResponse,
  AgentRole,
  AgentToolCall,
  AgentToolName,
} from "./AiAgents.types.js";

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

const SYSTEM_PROMPT = `You are the AI Agents page assistant for a portfolio app.
You can choose function tools when the user explicitly asks an actionable task.

Available tools:
1) maps_to(page_name: string)
- Use when user asks to navigate/move/open a page.
- Valid destinations: \"generative ai\" (/) and \"analytical-ai\" (/analytical-ai) and \"ai-agents\" (/ai-agents).

2) send_email(recipient: string, body: string)
- Use when user asks to send an email.
- You must extract a valid recipient email.
- If the user does not provide a full body but intent is clear (for example "send a welcome email"), generate a concise professional body automatically.
- Ask a follow-up question only when recipient is missing or the user intent is ambiguous.

3) update_site_style(property: string, value: string)
- Use when user asks to change visual style on the AI Agents page.
- Supported property values:
  * "theme" — values: "dark", "light"
  * "primary_color" — accent/button color, e.g. "#ef4444", "blue", "red"
  * "font_size" — values: "small", "large", "1.2"
  * "background_color" — changes the MAIN PAGE background color (the outer page area behind everything)
  * "chatbot_background_color" — changes only the CHAT INTERFACE panel background
- CRITICAL DISTINCTION for background changes:
  * "change background color to red" / "change bg to blue" / "set background X" → use property="background_color" (page bg)
  * "change YOUR background" / "change chatbot background" / "change chat bg" / "your bg" → use property="chatbot_background_color" (chat panel bg)
  * If ambiguous, ask: "Do you want me to change the main page background or the chat interface background?"

Behavior rules:
- Return concise helpful text.
- If user intent is unclear or you are not confident, ALWAYS ask the user for clarification before executing. Do NOT guess.
- When unsure whether user wants page background or chatbot background, ask them to clarify.
- Prefer a tool call when intent is clearly actionable and unambiguous.
- Never invent unavailable tools.`;

const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
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

interface ResolvedAiClient {
  client: OpenAI | AzureOpenAI;
  model: string;
}

function normalizeAzureEndpoint(endpoint: string): URL | null {
  const trimmed = endpoint.trim();

  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

function getOpenAIClient(env: AppEnv): ResolvedAiClient {
  const parsedEndpoint = normalizeAzureEndpoint(env.AZURE_OPENAI_ENDPOINT);

  if (!parsedEndpoint) {
    throw new Error("AZURE_OPENAI_ENDPOINT is invalid.");
  }

  const pathname = parsedEndpoint.pathname.toLowerCase().replace(/\/$/, "");
  const isV1Endpoint = pathname.endsWith("/openai/v1");

  if (isV1Endpoint) {
    const baseURL = parsedEndpoint.toString().replace(/\/$/, "");
    return {
      client: new OpenAI({
        apiKey: env.AZURE_OPENAI_API_KEY,
        baseURL,
      }),
      model: env.AZURE_OPENAI_MODEL,
    };
  }

  parsedEndpoint.pathname = "";
  parsedEndpoint.search = "";
  parsedEndpoint.hash = "";
  const endpointRoot = parsedEndpoint.toString().replace(/\/$/, "");
  const deployment = env.AZURE_OPENAI_DEPLOYMENT ?? env.AZURE_OPENAI_MODEL;

  return {
    client: new AzureOpenAI({
      endpoint: endpointRoot,
      apiKey: env.AZURE_OPENAI_API_KEY,
      apiVersion: env.AZURE_OPENAI_API_VERSION,
      deployment,
    }),
    model: deployment,
  };
}

function mapRole(role: AgentRole): "user" | "assistant" {
  return role === "assistant" ? "assistant" : "user";
}

function parseToolCall(
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
    return {
      id: callId,
      name: toolName,
      arguments: result.data,
    };
  }

  if (toolName === "send_email") {
    const result = sendEmailArgsSchema.safeParse(parsedArguments);
    if (!result.success) return null;
    return {
      id: callId,
      name: toolName,
      arguments: result.data,
    };
  }

  if (toolName === "update_site_style") {
    const result = updateStyleArgsSchema.safeParse(parsedArguments);
    if (!result.success) return null;
    return {
      id: callId,
      name: toolName,
      arguments: result.data,
    };
  }

  return null;
}

function getAssistantText(
  message: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
): string {
  if (typeof message.content === "string") {
    return message.content.trim();
  }

  return "";
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function extractRecipient(input: string): string | null {
  const match = input.match(EMAIL_PATTERN);
  return match?.[0] ?? null;
}

function extractExplicitBody(input: string): string | null {
  const quotedMatch = input.match(/"([^"]+)"|'([^']+)'/);
  if (quotedMatch) {
    const candidate = (quotedMatch[1] ?? quotedMatch[2] ?? "").trim();
    if (candidate.length > 0) {
      return candidate;
    }
  }

  const markerMatch = input.match(
    /\b(?:saying|say|message(?:\s+is|\s+as)?|body(?:\s+is|\s+as)?|with\s+message|with\s+body|text)\b\s*[:\-]?\s*(.+)$/i,
  );
  if (markerMatch?.[1]) {
    const candidate = markerMatch[1].trim();
    if (candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

function buildDefaultEmailBody(input: string): string {
  if (/\bwel+come\b/i.test(input)) {
    return [
      "Hello,",
      "",
      "Welcome! I am glad to connect with you.",
      "If you need any help getting started, feel free to let me know.",
      "",
      "Best regards,",
      "Tarek Monowar",
    ].join("\n");
  }

  return [
    "Hello,",
    "",
    "I hope you are doing well.",
    "I wanted to reach out and share this quick message.",
    "",
    "Best regards,",
    "Tarek Monowar",
  ].join("\n");
}

function createDeterministicEmailToolCall(
  latestUserMessage: string,
): AgentChatResponse | null {
  const normalized = latestUserMessage.trim().toLowerCase();
  const hasSendIntent = /\b(send|email|mail)\b/.test(normalized);

  if (!hasSendIntent) {
    return null;
  }

  const recipient = extractRecipient(latestUserMessage);
  if (!recipient) {
    return null;
  }

  const body =
    extractExplicitBody(latestUserMessage) ??
    buildDefaultEmailBody(latestUserMessage);

  return {
    assistantMessage:
      "I prepared the email details. Please confirm before I send it.",
    toolCalls: [
      {
        id: crypto.randomUUID(),
        name: "send_email",
        arguments: {
          recipient,
          body,
        },
      },
    ],
  };
}

export async function createAgentChatResponse(
  request: AgentChatRequest,
  env: AppEnv,
): Promise<AgentChatResponse> {
  const latestUserMessage =
    [...request.messages].reverse().find((message) => message.role === "user")
      ?.content ?? "";

  const deterministicEmailResponse =
    createDeterministicEmailToolCall(latestUserMessage);
  if (deterministicEmailResponse) {
    return deterministicEmailResponse;
  }

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
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
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
