import type { InstructionMode } from "../../config/env.js";

export type ClientControlEvent =
  | { type: "session.start"; instructionMode?: InstructionMode }
  | { type: "response.cancel" }
  | { type: "response.create" }
  | { type: "ping" };

export type ServerEvent =
  | { type: "session.connecting" }
  | { type: "session.ready"; sessionId: string }
  | { type: "session.closed" }
  | { type: "assistant.thinking" }
  | { type: "assistant.speaking" }
  | { type: "assistant.done" }
  | { type: "assistant.cancelled" }
  | { type: "transcript.user"; text: string }
  | { type: "transcript.assistant"; text: string }
  | { type: "vad.server.speech_started" }
  | { type: "vad.server.speech_stopped" }
  | { type: "pong" }
  | { type: "error"; message: string; code?: string; hint?: string };
