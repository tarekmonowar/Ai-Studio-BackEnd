import type { AgentChatResponse } from "./AiAgents.types.js";

// Regex to match a standard email address anywhere in the input string
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

/**
 * Extracts the first valid email address found in the input string.
 * Returns null if no email address is found.
 */
export function extractRecipient(input: string): string | null {
  const match = input.match(EMAIL_PATTERN);
  return match?.[0] ?? null;
}

/**
 * Looks for an explicitly stated email body in the user message.
 * Checks for quoted text first, then keyword markers like "saying", "message", "body".
 * Returns null if no explicit body text is found.
 */
export function extractExplicitBody(input: string): string | null {
  // Check for quoted body: "Hello there" or 'Hello there'
  const quotedMatch = input.match(/"([^"]+)"|'([^']+)'/);
  if (quotedMatch) {
    const candidate = (quotedMatch[1] ?? quotedMatch[2] ?? "").trim();
    if (candidate.length > 0) {
      return candidate;
    }
  }

  // Check for keyword markers: "saying Hello", "message: Hello", "body is Hello"
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

/**
 * Generates a default professional email body when the user did not provide one.
 * Detects "welcome" intent and tailors the message accordingly.
 */
export function buildDefaultEmailBody(input: string): string {
  if (/\bwel+come\b/i.test(input)) {
    return [
      "Hello,",
      "",
      "Welcome! I am glad to connect with you.",
      "If you need any help getting started, feel free to let me know.",
    ].join("\n");
  }

  return [
    "Hello,",
    "",
    "I hope you are doing well.",
    "I wanted to reach out and share this quick message.",
  ].join("\n");
}

/**
 * Attempts to create an email tool call directly from the user's message
 * without calling the AI model — a fast path for clearly structured requests.
 *
 * Returns a ready AgentChatResponse if the message has email intent + a valid recipient.
 * Returns null if the message does not clearly match, so the AI model should handle it.
 */
export function createDeterministicEmailToolCall(
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
