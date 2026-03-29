import { createRequire } from "node:module";
import type { AppEnv } from "../../config/env.js";
import type { ClientControlEvent, ServerEvent } from "./voice.types.js";
import { resolveVoiceConfig } from "./voice.utils.js";

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

export class VoiceLiveSessionService {
  private readonly config: AppEnv;
  private readonly handlers: VoiceLiveSessionHandlers;

  private session: VoiceLiveSession | null = null;
  private subscription: VoiceLiveSubscription | null = null;

  private responseActive = false;
  private disconnected = false;

  public constructor(config: AppEnv, handlers: VoiceLiveSessionHandlers) {
    this.config = config;
    this.handlers = handlers;
  }

  public async connect(): Promise<void> {
    this.handlers.onEvent({ type: "session.connecting" });

    const client = new VoiceLiveClient(
      this.config.VOICELIVE_ENDPOINT,
      new AzureKeyCredential(this.config.VOICELIVE_API_KEY),
    );

    const session = client.createSession({
      model: this.config.VOICELIVE_MODEL,
    });
    this.session = session;

    this.subscription = session.subscribe({
      onSessionUpdated: async (_event, context) => {
        this.handlers.onEvent({
          type: "session.ready",
          sessionId: context.sessionId,
        });
      },
      onConversationItemInputAudioTranscriptionCompleted: async (event) => {
        if (event.transcript) {
          this.handlers.onEvent({
            type: "transcript.user",
            text: event.transcript,
          });
        }
      },
      onResponseCreated: async () => {
        this.responseActive = true;
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
        if (event.transcript) {
          this.handlers.onEvent({
            type: "transcript.assistant",
            text: event.transcript,
          });
        }
      },
      onResponseDone: async () => {
        this.responseActive = false;
        this.handlers.onEvent({ type: "assistant.done" });
      },
      onInputAudioBufferSpeechStarted: async () => {
        this.handlers.onEvent({ type: "vad.server.speech_started" });
        await this.cancelResponseIfActive();
      },
      onInputAudioBufferSpeechStopped: async () => {
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

    await session.updateSession({
      model: this.config.VOICELIVE_MODEL,
      modalities: ["text", "audio"],
      instructions: this.config.VOICELIVE_INSTRUCTIONS,
      voice: resolveVoiceConfig(this.config.VOICELIVE_VOICE),
      inputAudioFormat: "pcm16",
      outputAudioFormat: "pcm16",
      turnDetection: {
        type: "server_vad",
        threshold: 0.45,
        prefixPaddingInMs: 300,
        silenceDurationInMs: 700,
        createResponse: true,
        interruptResponse: true,
        autoTruncate: true,
      },
      inputAudioEchoCancellation: { type: "server_echo_cancellation" },
      inputAudioNoiseReduction: { type: "azure_deep_noise_suppression" },
      inputAudioTranscription: { model: "azure-speech" },
    });
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
}
