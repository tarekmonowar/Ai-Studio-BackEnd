import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  buildInterviewQuestionContext,
  detectTechnicalTopicSelection,
  extractAskedQuestionIdsFromTranscript,
  getAvailableTopics,
} from "../../utils/interviewQuestionBank.js";

const server = new McpServer({
  name: "interview-question-bank",
  version: "1.0.0",
});

// ─── Resource: Available Interview Topics ────────────────────────────────────

server.registerResource(
  "topics",
  "interview://topics",
  {
    title: "Available Interview Topics",
    description:
      "Lists all interview topics with their question counts",
    mimeType: "application/json",
  },
  async () => ({
    contents: [
      {
        uri: "interview://topics",
        text: JSON.stringify(getAvailableTopics(), null, 2),
        mimeType: "application/json",
      },
    ],
  }),
);

// ─── Tool: Build Interview Context ───────────────────────────────────────────

server.registerTool(
  "buildInterviewContext",
  {
    title: "Build Interview Context",
    description:
      "Builds the full interview question context string for AI session instructions, factoring in which questions have already been asked",
    inputSchema: {
      askedQuestionIds: z
        .array(z.string())
        .describe("IDs of questions already asked in the session"),
      askedQuestionsFromHistory: z
        .array(z.string())
        .describe("Raw question texts from conversation history"),
    },
  },
  async ({ askedQuestionIds, askedQuestionsFromHistory }) => {
    const context = buildInterviewQuestionContext(
      new Set(askedQuestionIds),
      askedQuestionsFromHistory,
    );
    return { content: [{ type: "text" as const, text: context }] };
  },
);

// ─── Tool: Extract Asked Question IDs ────────────────────────────────────────

server.registerTool(
  "extractAskedQuestionIds",
  {
    title: "Extract Asked Question IDs",
    description:
      "Matches an assistant transcript against the question bank and returns the IDs of any recognized questions",
    inputSchema: {
      transcript: z
        .string()
        .describe("The assistant transcript text to scan for known questions"),
    },
  },
  async ({ transcript }) => {
    const ids = extractAskedQuestionIdsFromTranscript(transcript);
    return { content: [{ type: "text" as const, text: JSON.stringify(ids) }] };
  },
);

// ─── Tool: Detect Topic Selection ────────────────────────────────────────────

server.registerTool(
  "detectTopicSelection",
  {
    title: "Detect Topic Selection",
    description:
      "Detects whether the user's speech indicates a specific technical topic (e.g. React, Node.js, Docker)",
    inputSchema: {
      text: z
        .string()
        .describe("Normalized user transcript text to analyze"),
    },
  },
  async ({ text }) => {
    const topic = detectTechnicalTopicSelection(text);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(topic) }],
    };
  },
);

// ─── Start ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Interview Question Bank MCP Server started");
}

main().catch(console.error);
