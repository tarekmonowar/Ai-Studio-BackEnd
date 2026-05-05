import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { accessSync } from "node:fs";
import type { InterviewTopicSelection } from "../../types/interview-question.types.js";

export {
  normalizeQuestionText,
  resolveQuestionIdPrefixForTopic,
} from "../../utils/interviewQuestionBank.js";

export type { InterviewTopicSelection } from "../../types/interview-question.types.js";

// ─── Server Script Resolution ────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveServerScript(): { command: string; script: string } {
  const tsPath = resolve(__dirname, "mcp.server.ts");

  try {
    accessSync(tsPath);
    return { command: "tsx", script: tsPath };
  } catch {
    return { command: "node", script: resolve(__dirname, "mcp.server.js") };
  }
}

// ─── Singleton Client ────────────────────────────────────────────────────────

let clientPromise: Promise<Client> | null = null;

async function createClient(): Promise<Client> {
  const { command, script } = resolveServerScript();

  const client = new Client({
    name: "generative-ai-service",
    version: "1.0.0",
  });

  const transport = new StdioClientTransport({ command, args: [script] });
  await client.connect(transport);
  return client;
}

function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = createClient().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

function extractText(
  result: Awaited<ReturnType<Client["callTool"]>>,
): string {
  const content = result.content as Array<{ type: string; text: string }>;
  return content[0]?.text ?? "";
}

// ─── MCP Tool Wrappers ──────────────────────────────────────────────────────

export async function buildInterviewContext(
  askedQuestionIds: ReadonlySet<string>,
  askedQuestionsFromHistory: readonly string[],
): Promise<string> {
  const client = await getClient();

  const result = await client.callTool({
    name: "buildInterviewContext",
    arguments: {
      askedQuestionIds: [...askedQuestionIds],
      askedQuestionsFromHistory: [...askedQuestionsFromHistory],
    },
  });

  return extractText(result);
}

export async function extractAskedQuestionIds(
  transcript: string,
): Promise<string[]> {
  const client = await getClient();

  const result = await client.callTool({
    name: "extractAskedQuestionIds",
    arguments: { transcript },
  });

  return JSON.parse(extractText(result)) as string[];
}

export async function detectTopicSelection(
  text: string,
): Promise<InterviewTopicSelection | null> {
  const client = await getClient();

  const result = await client.callTool({
    name: "detectTopicSelection",
    arguments: { text },
  });

  return JSON.parse(extractText(result)) as InterviewTopicSelection | null;
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export async function disconnectMcpClient(): Promise<void> {
  if (!clientPromise) return;

  try {
    const client = await clientPromise;
    await client.close();
  } catch {
    // best effort during shutdown
  }

  clientPromise = null;
}
