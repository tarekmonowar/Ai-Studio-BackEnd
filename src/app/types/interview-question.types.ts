export interface TopicQuestionSet {
  topic: string;
  questions: readonly string[];
}

export type TechnicalInterviewTopic =
  | "HTML"
  | "CSS"
  | "JavaScript"
  | "TypeScript"
  | "React"
  | "Next.js"
  | "Node.js"
  | "Express.js"
  | "MongoDB"
  | "PostgreSQL"
  | "Docker";

export interface TopicFlowRule {
  topic: TechnicalInterviewTopic;
  min: number;
  max: number;
}

export type InterviewTopicSelection = TechnicalInterviewTopic | "Redux";

export interface TopicSelectionPattern {
  topic: InterviewTopicSelection;
  pattern: RegExp;
}

export interface InterviewQuestion {
  id: string;
  topic: string;
  text: string;
  normalizedText: string;
}
