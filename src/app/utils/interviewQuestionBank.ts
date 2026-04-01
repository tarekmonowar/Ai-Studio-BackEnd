import cssInterviewQuestions from "../questions/css.js";
import dockerInterviewQuestions from "../questions/docker.js";
import expressInterviewQuestions from "../questions/expressJs.js";
import htmlInterviewQuestions from "../questions/html.js";
import interpersonalQuestions from "../questions/interpersonal.js";
import javascriptInterviewQuestions from "../questions/javascript.js";
import mongoInterviewQuestions from "../questions/mongoDB.js";
import nextJsInterviewQuestions from "../questions/nextJs.js";
import nodeInterviewQuestions from "../questions/nodeJs.js";
import postgresInterviewQuestions from "../questions/postgreSQL.js";
import reactInterviewQuestions from "../questions/react.js";
import reduxInterviewQuestions from "../questions/redux.js";
import typescriptInterviewQuestions from "../questions/typescript.js";
import type {
  InterviewQuestion,
  InterviewTopicSelection,
  TechnicalInterviewTopic,
  TopicFlowRule,
  TopicQuestionSet,
  TopicSelectionPattern,
} from "../types/interview-question.types.js";

export type {
  InterviewTopicSelection,
  TechnicalInterviewTopic,
} from "../types/interview-question.types.js";

const TOPIC_QUESTION_SETS: readonly TopicQuestionSet[] = [
  { topic: "Interpersonal", questions: interpersonalQuestions },
  { topic: "HTML", questions: htmlInterviewQuestions },
  { topic: "CSS", questions: cssInterviewQuestions },
  { topic: "JavaScript", questions: javascriptInterviewQuestions },
  { topic: "TypeScript", questions: typescriptInterviewQuestions },
  { topic: "React", questions: reactInterviewQuestions },
  { topic: "Next.js", questions: nextJsInterviewQuestions },
  { topic: "Node.js", questions: nodeInterviewQuestions },
  { topic: "Express.js", questions: expressInterviewQuestions },
  { topic: "MongoDB", questions: mongoInterviewQuestions },
  { topic: "PostgreSQL", questions: postgresInterviewQuestions },
  { topic: "Redux", questions: reduxInterviewQuestions },
  { topic: "Docker", questions: dockerInterviewQuestions },
] as const;

const TECHNICAL_TOPIC_FLOW: readonly TopicFlowRule[] = [
  { topic: "HTML", min: 3, max: 4 },
  { topic: "CSS", min: 3, max: 4 },
  { topic: "JavaScript", min: 7, max: 8 },
  { topic: "TypeScript", min: 3, max: 4 },
  { topic: "React", min: 6, max: 7 },
  { topic: "Next.js", min: 5, max: 6 },
  { topic: "Node.js", min: 4, max: 8 },
  { topic: "Express.js", min: 4, max: 8 },
  { topic: "MongoDB", min: 4, max: 8 },
  { topic: "PostgreSQL", min: 4, max: 8 },
  { topic: "Docker", min: 4, max: 8 },
] as const;

const TOPIC_SELECTION_PATTERNS: readonly TopicSelectionPattern[] = [
  { topic: "HTML", pattern: /\bhtml\b/i },
  { topic: "CSS", pattern: /\bcss\b/i },
  {
    topic: "JavaScript",
    pattern: /\bjavascript\b|\bjava\s*script\b|\bjs\b/i,
  },
  {
    topic: "TypeScript",
    pattern: /\btypescript\b|\btype\s*script\b|\bts\b/i,
  },
  { topic: "React", pattern: /\breact\b/i },
  { topic: "Next.js", pattern: /\bnext(\.?\s*js)?\b|\bnextjs\b/i },
  { topic: "Node.js", pattern: /\bnode(\.?\s*js)?\b|\bnodejs\b/i },
  {
    topic: "Express.js",
    pattern: /\bexpress(\.?\s*js)?\b|\bexpressjs\b/i,
  },
  { topic: "MongoDB", pattern: /\bmongodb\b|\bmongo\b/i },
  { topic: "PostgreSQL", pattern: /\bpostgresql\b|\bpostgres\b|\bpostgre\b/i },
  { topic: "Docker", pattern: /\bdocker\b/i },
  { topic: "Redux", pattern: /\bredux\b/i },
] as const;

const INTERPERSONAL_OPENING_QUESTION = "Tell me about yourself?";
const INTERPERSONAL_BLOCK_RANGE = "4-5";
const SPECIFIC_TOPIC_RANGE = "10-15";
const MAX_ASKED_HISTORY_CONTEXT = 40;

function slugifyTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function resolveQuestionIdPrefixForTopic(topic: string): string {
  return slugifyTopic(topic);
}

export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectTechnicalTopicSelection(
  text: string,
): InterviewTopicSelection | null {
  for (const matcher of TOPIC_SELECTION_PATTERNS) {
    if (matcher.pattern.test(text)) {
      return matcher.topic;
    }
  }

  return null;
}

const INTERVIEW_QUESTION_SETS = TOPIC_QUESTION_SETS.map((set) => {
  const topicSlug = slugifyTopic(set.topic);

  const entries = set.questions.map((question, index) => {
    const id = `${topicSlug}-${String(index + 1).padStart(3, "0")}`;

    return {
      id,
      topic: set.topic,
      text: question,
      normalizedText: normalizeQuestionText(question),
    } satisfies InterviewQuestion;
  });

  return {
    topic: set.topic,
    entries,
  };
});

const ALL_QUESTIONS = INTERVIEW_QUESTION_SETS.flatMap((set) => set.entries);

const QUESTION_SEARCH_INDEX = [...ALL_QUESTIONS].sort(
  (left, right) => right.normalizedText.length - left.normalizedText.length,
);

function countAskedByTopic(
  askedQuestionIds: ReadonlySet<string>,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const set of INTERVIEW_QUESTION_SETS) {
    let topicCount = 0;

    for (const entry of set.entries) {
      if (askedQuestionIds.has(entry.id)) {
        topicCount += 1;
      }
    }

    counts.set(set.topic, topicCount);
  }

  return counts;
}

function resolveNextTechnicalTopic(askedByTopic: Map<string, number>): string {
  for (const rule of TECHNICAL_TOPIC_FLOW) {
    if ((askedByTopic.get(rule.topic) ?? 0) < rule.min) {
      return rule.topic;
    }
  }

  return "minimum counts satisfied for all default technical topics";
}

export function extractAskedQuestionIdsFromTranscript(
  transcript: string,
): string[] {
  const normalizedTranscript = normalizeQuestionText(transcript);

  if (!normalizedTranscript) {
    return [];
  }

  const matches = new Set<string>();

  for (const question of QUESTION_SEARCH_INDEX) {
    if (normalizedTranscript.includes(question.normalizedText)) {
      matches.add(question.id);
    }
  }

  return [...matches];
}

export function buildInterviewQuestionContext(
  askedQuestionIds: ReadonlySet<string>,
  askedQuestionsFromHistory: readonly string[],
): string {
  const askedByTopic = countAskedByTopic(askedQuestionIds);
  const totalAskedById = [...askedByTopic.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  const historyQuestionSet = new Set(
    askedQuestionsFromHistory
      .map((question) => normalizeQuestionText(question))
      .filter(Boolean),
  );
  const recentAskedQuestions = askedQuestionsFromHistory.slice(
    -MAX_ASKED_HISTORY_CONTEXT,
  );
  const openingQuestionAsked = historyQuestionSet.has(
    normalizeQuestionText(INTERPERSONAL_OPENING_QUESTION),
  );

  const lines: string[] = [
    "## Interview Flow Control",
    `- Interpersonal block size: ${INTERPERSONAL_BLOCK_RANGE} unique questions`,
    `- Specific topic override size: ${SPECIFIC_TOPIC_RANGE} unique questions`,
    "- Always ask one question at a time after brief feedback",
    `- Required opening interpersonal question status: ${openingQuestionAsked ? "already asked" : "pending"}`,
    `- Next default technical topic to prioritize: ${resolveNextTechnicalTopic(askedByTopic)}`,
    "",
    "## Topic Progress",
  ];

  const interpersonalAsked = askedByTopic.get("Interpersonal") ?? 0;
  lines.push(`- Interpersonal: ${interpersonalAsked} asked`);

  for (const rule of TECHNICAL_TOPIC_FLOW) {
    const asked = askedByTopic.get(rule.topic) ?? 0;
    lines.push(
      `- ${rule.topic}: ${asked} asked, target ${rule.min}-${rule.max}`,
    );
  }

  lines.push(
    `- Redux: ${askedByTopic.get("Redux") ?? 0} asked (optional by user request)`,
  );
  lines.push("");

  lines.push("## Asked Question IDs");

  if (askedQuestionIds.size === 0) {
    lines.push("- none yet");
  } else {
    const sortedIds = [...askedQuestionIds].sort((left, right) =>
      left.localeCompare(right),
    );
    for (const id of sortedIds) {
      lines.push(`- ${id}`);
    }
  }

  lines.push("");
  lines.push("## Asked Questions (Conversation History)");
  lines.push(
    `- Total tracked in session history: ${askedQuestionsFromHistory.length}`,
  );

  if (recentAskedQuestions.length === 0) {
    lines.push("- none yet");
  } else {
    for (const question of recentAskedQuestions) {
      lines.push(`- ${question}`);
    }
  }

  lines.push("");
  lines.push("## Interview Tracking Summary");
  lines.push(`- Total asked questions with known IDs: ${totalAskedById}`);
  lines.push(
    `- Total asked questions in history tracker: ${askedQuestionsFromHistory.length}`,
  );

  lines.push("");
  lines.push("## Available Questions");

  for (const set of INTERVIEW_QUESTION_SETS) {
    lines.push(`### ${set.topic}`);

    const availableEntries = set.entries.filter(
      (entry) =>
        !askedQuestionIds.has(entry.id) &&
        !historyQuestionSet.has(entry.normalizedText),
    );

    if (availableEntries.length === 0) {
      lines.push("- none remaining");
      lines.push("");
      continue;
    }

    for (const entry of availableEntries) {
      lines.push(`- [${entry.id}] ${entry.text}`);
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}
