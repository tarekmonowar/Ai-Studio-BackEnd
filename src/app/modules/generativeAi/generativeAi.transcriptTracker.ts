/**
 * Role values used when writing conversation messages to MongoDB.
 * Separate from the VoiceLive SDK types to keep our DB schema independent.
 */
export type LogRole = "user" | "assistant";

/**
 * A single conversation message waiting to be written to MongoDB.
 * Buffered during the session and persisted in batches.
 */
export interface PendingLogMessage {
  role: LogRole;
  content: string;
  timestamp: Date;
  topic: string;
}

/**
 * The current interview routing state for a session.
 *
 * - "undecided"        — session just started, user hasn't chosen a track yet
 * - "interpersonal"    — user chose interpersonal / behavioral questions
 * - "technical-general" — user chose technical questions, following default order
 * - "technical-topic"  — user selected a specific technology (topic locked)
 */
export type InterviewTrackMode =
  | "undecided"
  | "interpersonal"
  | "technical-general"
  | "technical-topic";
