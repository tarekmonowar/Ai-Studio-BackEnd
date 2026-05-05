import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  type AppEnv,
  type InstructionMode,
  type SpeakerProfile,
} from "../../config/env.js";
import {
  buildInterviewContext,
  detectTopicSelection,
  extractAskedQuestionIds,
  normalizeQuestionText,
  resolveQuestionIdPrefixForTopic,
  type InterviewTopicSelection,
} from "./mcp.client.js";
import {
  ensureMongoConnection,
  ensureMongoConnectionReady,
} from "../../utils/mongoConnection.js";
import { resolveInstructionByMode } from "../../utils/voiceInstructions.js";
import { logger } from "../../utils/logger.js";
import { ConversationLogModel } from "./conversationLog.model.js";
import { UserSessionModel } from "./userSession.model.js";
import type { ClientControlEvent, ServerEvent } from "./generativeAi.types.js";
import {
  resolveVoiceByProfile,
  resolveVoiceConfig,
} from "./generativeAi.utils.js";
import {
  FREE_TIER_LIMIT_MESSAGE,
  buildRateLimitKey,
} from "./generativeAi.rateLimit.js";
import type {
  InterviewTrackMode,
  LogRole,
  PendingLogMessage,
} from "./generativeAi.transcriptTracker.js";

const cjsRequire = createRequire(import.meta.url);
const { VoiceLiveClient } = cjsRequire(
  "@azure/ai-voicelive",
) as typeof import("@azure/ai-voicelive");
const { AzureKeyCredential } = cjsRequire(
  "@azure/core-auth",
) as typeof import("@azure/core-auth");

type VoiceLiveSession = ReturnType<
  InstanceType<typeof VoiceLiveClient>["createSession"]
>;
type VoiceLiveSubscription = Awaited<ReturnType<VoiceLiveSession["subscribe"]>>;

interface VoiceLiveSessionHandlers {
  onEvent: (event: ServerEvent) => void;
  onAudioChunk: (chunk: Buffer) => void;
}

interface VoiceLiveSessionOptions {
  userIp?: string;
}

export class VoiceLiveSessionService {
  private readonly config: AppEnv;
  private readonly handlers: VoiceLiveSessionHandlers;

  private session: VoiceLiveSession | null = null;
  private subscription: VoiceLiveSubscription | null = null;

  private responseActive = false;
  private disconnected = false;
  private sessionId = "pending";
  private userIp: string;
  private rateLimitFirstSeenMs: number | null = null;
  private instructionMode: InstructionMode | undefined;
  private lastAppliedInstructions: string | null = null;
  private firstGreetingCompleted = false;
  private responseStartedAt = 0;
  private trackMode: InterviewTrackMode = "undecided";
  private lockedTopic: InterviewTopicSelection | null = null;
  private lockedTopicAskedAtStart = 0;

  private readonly askedQuestionIds = new Set<string>();
  private readonly askedQuestionsFromHistory: string[] = [];
  private readonly askedQuestionHistorySet = new Set<string>();

  public constructor(
    config: AppEnv,
    handlers: VoiceLiveSessionHandlers,
    options: VoiceLiveSessionOptions = {},
  ) {
    this.config = config;
    this.handlers = handlers;
    this.userIp = options.userIp ?? "unknown";
  }

  public async connect(
    instructionMode?: InstructionMode,
    speakerProfile?: SpeakerProfile,
    userIp?: string,
  ): Promise<void> {
    if (userIp) {
      this.userIp = userIp;
    }

    const canProceed = await this.checkUsageLimit(this.userIp);
    if (!canProceed) {
      return;
    }

    if (this.session) {
      return;
    }

    this.handlers.onEvent({ type: "session.connecting" });

    // Start connection in background; never block live voice flow on DB.
    ensureMongoConnection();

    const client = new VoiceLiveClient(
      this.config.VOICELIVE_ENDPOINT,
      new AzureKeyCredential(this.config.VOICELIVE_API_KEY),
    );

    const session = client.createSession({
      model: this.config.VOICELIVE_MODEL,
    });
    this.session = session;
    this.instructionMode = instructionMode;

    this.subscription = session.subscribe({
      onSessionUpdated: async (_event, context) => {
        if (this.sessionId === "pending") {
          this.sessionId = context.sessionId;
        }

        const rateLimitRemainingSeconds = this.getRateLimitRemainingSeconds();
        this.handlers.onEvent({
          type: "session.ready",
          sessionId: context.sessionId,
          ...(rateLimitRemainingSeconds !== null
            ? { rateLimitRemainingSeconds }
            : {}),
        });
        this.emitPhaseUpdate();
      },
      onConversationItemInputAudioTranscriptionCompleted: async (event) => {
        if (event.transcript) {
          if (!this.firstGreetingCompleted) return;
          if (this.responseActive) return;

          this.handlers.onEvent({
            type: "transcript.user",
            text: event.transcript,
          });

          this.saveLogToMongo("user", event.transcript);

          const routeChanged = await this.updateRoutingFromUserTranscript(
            event.transcript,
          );
          if (routeChanged) {
            this.emitPhaseUpdate();
            await this.refreshInterviewInstructionsIfNeeded();
          }
        }
      },
      onResponseCreated: async () => {
        this.responseActive = true;
        this.responseStartedAt = Date.now();
        this.handlers.onEvent({ type: "assistant.thinking" });
      },
      onResponseAudioDelta: async (event) => {
        if (!event.delta) return;

        this.handlers.onEvent({ type: "assistant.speaking" });

        const chunk =
          typeof event.delta === "string"
            ? Buffer.from(event.delta, "base64")
            : Buffer.from(event.delta);

        this.handlers.onAudioChunk(chunk);
      },
      onResponseAudioTranscriptDone: async (event) => {
        if (!event.transcript) {
          return;
        }

        this.handlers.onEvent({
          type: "transcript.assistant",
          text: event.transcript,
        });

        this.saveLogToMongo("assistant", event.transcript);

        const tracked = await this.trackAskedQuestionsFromTranscript(
          event.transcript,
        );

        if (tracked) {
          this.emitPhaseUpdate();
          await this.refreshInterviewInstructionsIfNeeded();
        }
      },
      onResponseDone: async () => {
        this.responseActive = false;
        this.responseStartedAt = 0;

        if (!this.firstGreetingCompleted) {
          this.firstGreetingCompleted = true;
        }

        this.handlers.onEvent({ type: "assistant.done" });
      },
      onInputAudioBufferSpeechStarted: async () => {
        if (!this.firstGreetingCompleted) return;
        if (this.isLikelyEcho()) return;

        this.handlers.onEvent({ type: "vad.server.speech_started" });
        await this.cancelResponseIfActive();
      },
      onInputAudioBufferSpeechStopped: async () => {
        if (!this.firstGreetingCompleted) return;
        this.handlers.onEvent({ type: "vad.server.speech_stopped" });
      },
      onServerError: async (event) => {
        const message =
          event.error?.message ?? "Unknown VoiceLive server error";
        const normalized = message.toLowerCase();

        if (normalized.includes("cancellation failed: no active response")) {
          return;
        }

        if (
          normalized.includes("committing input audio buffer") &&
          normalized.includes("buffer too small")
        ) {
          return;
        }

        this.handlers.onEvent({
          type: "error",
          message,
          code: "VOICELIVE_SERVER_ERROR",
          hint: "Check backend logs and Azure VoiceLive service health.",
        });
      },
    });

    await session.connect();

    const selectedInstructions = await this.resolveSessionInstructions();
    const selectedVoice = resolveVoiceByProfile(speakerProfile);

    await session.updateSession({
      model: this.config.VOICELIVE_MODEL,
      modalities: ["text", "audio"],
      instructions: selectedInstructions,
      voice: resolveVoiceConfig(selectedVoice),
      inputAudioFormat: "pcm16",
      outputAudioFormat: "pcm16",
      turnDetection: {
        type: "server_vad",
        threshold: 0.5,
        prefixPaddingInMs: 400,
        silenceDurationInMs: 800,
        createResponse: true,
        interruptResponse: false,
        autoTruncate: true,
      },
      inputAudioEchoCancellation: { type: "server_echo_cancellation" },
      inputAudioNoiseReduction: { type: "azure_deep_noise_suppression" },
      inputAudioTranscription: { model: "azure-speech" },
    });

    this.lastAppliedInstructions = selectedInstructions;
  }

  private async checkUsageLimit(userIp?: string): Promise<boolean> {
    if (!this.config.RATE_LIMIT_ENABLED || !userIp) {
      this.rateLimitFirstSeenMs = null;
      return true;
    }

    try {
      await ensureMongoConnectionReady();

      const now = new Date();
      const rateLimitKey = buildRateLimitKey(userIp);
      const userSession = await UserSessionModel.findOneAndUpdate(
        { userIp: rateLimitKey },
        {
          $setOnInsert: {
            userIp: rateLimitKey,
            firstSeen: now,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
        },
      )
        .lean()
        .exec();

      const firstSeenMs = new Date(userSession.firstSeen).getTime();
      this.rateLimitFirstSeenMs = firstSeenMs;
      const elapsedMs = Date.now() - firstSeenMs;

      if (elapsedMs > this.config.RATE_LIMIT_MINUTES * 60_000) {
        this.handlers.onEvent({
          type: "error",
          message: FREE_TIER_LIMIT_MESSAGE,
        });
        return false;
      }

      return true;
    } catch (error) {
      this.rateLimitFirstSeenMs = null;
      this.handlers.onEvent({
        type: "error",
        message:
          "Could not validate usage limit right now. Please try again shortly.",
        code: "USAGE_LIMIT_CHECK_FAILED",
        hint: "Check MongoDB connectivity and MONGODB_URI configuration.",
      });
      logger.error("Usage limit check failed", error);
      return false;
    }
  }

  private getRateLimitRemainingSeconds(): number | null {
    if (!this.config.RATE_LIMIT_ENABLED || this.rateLimitFirstSeenMs === null) {
      return null;
    }

    const elapsedMs = Date.now() - this.rateLimitFirstSeenMs;
    const totalMs = this.config.RATE_LIMIT_MINUTES * 60_000;
    const remainingMs = Math.max(0, totalMs - elapsedMs);

    return Math.ceil(remainingMs / 1000);
  }

  public async pushAudio(bytes: Uint8Array): Promise<void> {
    if (!this.session) return;
    await this.session.sendAudio(bytes);
  }

  public async handleControl(event: ClientControlEvent): Promise<void> {
    if (!this.session) return;

    switch (event.type) {
      case "session.start": {
        return;
      }
      case "response.cancel": {
        await this.cancelResponseIfActive();
        return;
      }
      case "response.create": {
        if (this.responseActive) {
          return;
        }

        await this.refreshInterviewInstructionsIfNeeded();
        await this.commitInputAudioBuffer();
        await this.session.sendEvent({ type: "response.create" });
        return;
      }
      case "ping": {
        this.handlers.onEvent({ type: "pong" });
        return;
      }
      default: {
        this.handlers.onEvent({
          type: "error",
          message: "Unknown client event",
          code: "BAD_CLIENT_EVENT",
          hint: "Refresh the page and try again.",
        });
      }
    }
  }

  private emitPhaseUpdate(): void {
    this.handlers.onEvent({
      type: "phase.update",
      phase: this.resolveCurrentTopicForLog(),
    });
  }

  private async resolveSessionInstructions(): Promise<string> {
    const baseInstructions =
      this.instructionMode === undefined
        ? this.config.VOICELIVE_INSTRUCTIONS
        : resolveInstructionByMode(this.instructionMode);

    if (this.instructionMode === "english-learning") {
      return baseInstructions;
    }

    const interviewQuestionContext = await buildInterviewContext(
      this.askedQuestionIds,
      this.askedQuestionsFromHistory,
    );

    const activeDirective = this.buildActiveRuntimeDirective();

    return `${baseInstructions}\n\n${interviewQuestionContext}\n\n${activeDirective}`;
  }

  private buildActiveRuntimeDirective(): string {
    const lines: string[] = [
      "## Active Runtime Directive (Highest Priority)",
      "- After each user answer, first give a short feedback verdict: correct, partially correct, or incorrect.",
      "- If the answer is partially correct or incorrect, provide a short corrected core answer in one to two sentences, then ask the next question.",
      "- Do not ask the interpersonal-or-technical choice question unless a block is actually complete or user asks to switch.",
    ];

    if (this.trackMode === "technical-topic" && this.lockedTopic) {
      const askedInBlock =
        this.getAskedCountByTopic(this.lockedTopic) -
        this.lockedTopicAskedAtStart;
      lines.push(`- User-selected topic lock is active: ${this.lockedTopic}.`);
      lines.push(
        `- Questions asked in current ${this.lockedTopic} block: ${Math.max(0, askedInBlock)}.`,
      );

      if (askedInBlock < 10) {
        lines.push(
          `- Continue asking unique ${this.lockedTopic} questions now; do not ask to choose interpersonal or technical now.`,
        );
      } else if (askedInBlock <= 15) {
        lines.push(
          `- Keep ${this.lockedTopic} focus unless user asks to switch; you may ask if user wants another technology only after finishing this block.`,
        );
      } else {
        lines.push(
          `- ${this.lockedTopic} block exceeded fifteen questions; ask which technology should be next.`,
        );
      }

      return lines.join("\n");
    }

    if (this.trackMode === "interpersonal") {
      lines.push(
        "- Interpersonal track is active; continue interpersonal until block completion or explicit user switch.",
      );
      return lines.join("\n");
    }

    if (this.trackMode === "technical-general") {
      lines.push(
        "- General technical track is active; continue default technical sequence and avoid returning to mode-selection prompt mid-topic.",
      );
      return lines.join("\n");
    }

    lines.push(
      "- Waiting for user to pick mode; ask interpersonal-or-technical only at session start or after a completed block.",
    );
    return lines.join("\n");
  }

  private async updateRoutingFromUserTranscript(
    transcript: string,
  ): Promise<boolean> {
    if (this.instructionMode !== "interview-prep") {
      return false;
    }

    const normalized = normalizeQuestionText(transcript);
    if (!normalized) {
      return false;
    }

    const words = normalized.split(" ").filter(Boolean);
    const hasControlVerb =
      /\b(ask|start|switch|move|focus|continue|go|choose|pick|lets|let s|now|next|only)\b/.test(
        normalized,
      );
    const likelySelectionUtterance = hasControlVerb || words.length <= 3;

    const selectedTopic = await detectTopicSelection(normalized);
    if (selectedTopic && likelySelectionUtterance) {
      const modeChanged = this.trackMode !== "technical-topic";
      const topicChanged = this.lockedTopic !== selectedTopic;

      this.trackMode = "technical-topic";

      if (topicChanged) {
        this.lockedTopic = selectedTopic;
        this.lockedTopicAskedAtStart = this.getAskedCountByTopic(selectedTopic);
      }

      return modeChanged || topicChanged;
    }

    const wantsInterpersonal =
      /\b(interpersonal|behavioral|behavioural|hr)\b/.test(normalized) &&
      likelySelectionUtterance;
    if (wantsInterpersonal) {
      const changed =
        this.trackMode !== "interpersonal" || this.lockedTopic !== null;
      this.trackMode = "interpersonal";
      this.lockedTopic = null;
      this.lockedTopicAskedAtStart = 0;
      return changed;
    }

    const wantsTechnical =
      /\btechnical\b/.test(normalized) && likelySelectionUtterance;
    if (wantsTechnical) {
      const changed =
        this.trackMode !== "technical-general" || this.lockedTopic !== null;
      this.trackMode = "technical-general";
      this.lockedTopic = null;
      this.lockedTopicAskedAtStart = 0;
      return changed;
    }

    return false;
  }

  private getAskedCountByTopic(topic: InterviewTopicSelection): number {
    const prefix = `${resolveQuestionIdPrefixForTopic(topic)}-`;
    let total = 0;

    for (const id of this.askedQuestionIds) {
      if (id.startsWith(prefix)) {
        total += 1;
      }
    }

    return total;
  }

  private async trackAskedQuestionsFromTranscript(
    transcript: string,
  ): Promise<boolean> {
    let hasChanges = false;

    const askedIds = await extractAskedQuestionIds(transcript);
    for (const id of askedIds) {
      if (!this.askedQuestionIds.has(id)) {
        this.askedQuestionIds.add(id);
        hasChanges = true;
      }
    }

    const candidateQuestions = transcript.match(/[^?]+\?/g) ?? [];
    for (const candidate of candidateQuestions) {
      const trimmedQuestion = candidate.replace(/\s+/g, " ").trim();
      if (!trimmedQuestion) {
        continue;
      }

      const normalizedQuestion = normalizeQuestionText(trimmedQuestion);
      if (
        !normalizedQuestion ||
        this.askedQuestionHistorySet.has(normalizedQuestion)
      ) {
        continue;
      }

      this.askedQuestionHistorySet.add(normalizedQuestion);
      this.askedQuestionsFromHistory.push(trimmedQuestion);
      hasChanges = true;

      if (this.askedQuestionsFromHistory.length > 120) {
        const oldest = this.askedQuestionsFromHistory.shift();
        if (oldest) {
          this.askedQuestionHistorySet.delete(normalizeQuestionText(oldest));
        }
      }
    }

    return hasChanges;
  }

  private async refreshInterviewInstructionsIfNeeded(): Promise<void> {
    if (!this.session || this.instructionMode === "english-learning") {
      return;
    }

    const nextInstructions = await this.resolveSessionInstructions();
    if (this.lastAppliedInstructions === nextInstructions) {
      return;
    }

    try {
      await this.session.updateSession({
        instructions: nextInstructions,
      });
      this.lastAppliedInstructions = nextInstructions;
    } catch {
      this.handlers.onEvent({
        type: "error",
        message: "Could not refresh interview context for next response.",
        code: "INSTRUCTION_UPDATE_FAILED",
        hint: "You can keep speaking. If repeats continue, restart the session.",
      });
    }
  }

  private async commitInputAudioBuffer(): Promise<void> {
    if (!this.session) return;

    try {
      await this.session.sendEvent({ type: "input_audio_buffer.commit" });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";

      // Best effort commit: ignore when there is no pending audio.
      if (
        message.includes("no input audio") ||
        message.includes("empty") ||
        message.includes("nothing to commit") ||
        message.includes("buffer too small") ||
        message.includes("too small")
      ) {
        return;
      }

      this.handlers.onEvent({
        type: "error",
        message: "Could not finalize audio turn before generating response.",
        code: "AUDIO_COMMIT_FAILED",
        hint: "Try speaking again and pause clearly for a moment.",
      });
    }
  }

  public async disconnect(): Promise<void> {
    if (this.disconnected) {
      return;
    }

    this.disconnected = true;

    if (this.subscription) {
      await this.subscription.close();
      this.subscription = null;
    }

    if (this.session) {
      try {
        await this.session.disconnect();
      } catch {
        // best effort during close
      }

      try {
        await this.session.dispose();
      } catch {
        // best effort during close
      }

      this.session = null;
    }

    this.handlers.onEvent({ type: "session.closed" });
  }

  private static readonly ECHO_GUARD_MS = 2000;

  private isLikelyEcho(): boolean {
    if (!this.responseActive || this.responseStartedAt === 0) return false;
    return Date.now() - this.responseStartedAt < VoiceLiveSessionService.ECHO_GUARD_MS;
  }

  private async cancelResponseIfActive(): Promise<void> {
    if (!this.responseActive || !this.session) {
      return;
    }

    this.responseActive = false;

    try {
      await this.session.sendEvent({ type: "response.cancel" });
      this.handlers.onEvent({ type: "assistant.cancelled" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "response.cancel failed";
      if (!message.toLowerCase().includes("no active response")) {
        this.handlers.onEvent({
          type: "error",
          message,
          code: "RESPONSE_CANCEL_FAILED",
          hint: "You can continue speaking. The session is still active.",
        });
      }
    }
  }

  private saveLogToMongo(role: string, content: string): void {
    const normalized = content.trim();
    if (!normalized) {
      return;
    }

    const activeSessionId = this.ensureLogSessionId();

    const roleValue: LogRole = role === "assistant" ? "assistant" : "user";
    const nextMessage: PendingLogMessage = {
      role: roleValue,
      content: normalized,
      timestamp: new Date(),
      topic: this.resolveCurrentTopicForLog(),
    };

    this.persistLogMessages(activeSessionId, [nextMessage]);
  }

  private ensureLogSessionId(): string {
    if (this.sessionId === "pending") {
      this.sessionId = `ws-${randomUUID()}`;
    }

    return this.sessionId;
  }

  private persistLogMessages(
    sessionId: string,
    messages: PendingLogMessage[],
  ): void {
    if (messages.length === 0) {
      return;
    }

    ensureMongoConnection();
    const currentTopic =
      messages[messages.length - 1]?.topic ?? this.resolveCurrentTopicForLog();

    ConversationLogModel.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          topic: currentTopic,
        },
        $setOnInsert: {
          sessionId,
          userIp: this.userIp,
        },
        $push: {
          messages: {
            $each: messages.map((message) => ({
              role: message.role,
              content: message.content,
              timestamp: message.timestamp,
            })),
          },
        },
      },
      { upsert: true },
    )
      .exec()
      .catch((error) => {
        logger.error("Conversation log write failed", error);
      });
  }

  private resolveCurrentTopicForLog(): string {
    if (this.instructionMode === "english-learning") {
      return "english-learning";
    }

    if (this.trackMode === "technical-topic" && this.lockedTopic) {
      return this.lockedTopic;
    }

    if (this.trackMode === "technical-general") {
      return "technical-general";
    }

    if (this.trackMode === "interpersonal") {
      return "interpersonal";
    }

    if (this.instructionMode === "interview-prep") {
      return "interview-prep";
    }

    return "default";
  }
}
