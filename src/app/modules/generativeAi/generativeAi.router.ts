import type { IncomingMessage } from "node:http";
import type { RawData, WebSocket, WebSocketServer } from "ws";
import { withWsAsyncHandler } from "../../middleware/wsAsyncHandler.js";
import type { AppEnv } from "../../config/env.js";
import type { ClientControlEvent, ServerEvent } from "./generativeAi.types.js";
import { VoiceLiveSessionService } from "./generativeAi.service.js";
import { toReadableConnectError } from "./generativeAi.connectErrors.js";
import { resolveUserIp } from "./generativeAi.ipResolver.js";

// ─── WebSocket Helpers ───────────────────────────────────────────────────────

/** Parses a raw WebSocket message as a JSON control event. Returns null on failure. */
function parseControlEvent(rawData: RawData): ClientControlEvent | null {
  try {
    return JSON.parse(rawData.toString()) as ClientControlEvent;
  } catch {
    return null;
  }
}

/** Sends a typed server event to the WebSocket client if the connection is still open. */
function sendEvent(socket: WebSocket, event: ServerEvent): void {
  if (socket.readyState !== socket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(event));
}

// ─── Route Registration ──────────────────────────────────────────────────────

/**
 * Registers the WebSocket route that handles all real-time voice sessions.
 *
 * Each WebSocket connection creates a new VoiceLiveSessionService instance
 * which manages the full lifecycle: connect → stream audio → disconnect.
 */
export function registerVoiceSocketRoute(
  wss: WebSocketServer,
  env: AppEnv,
): void {
  wss.on("connection", async (socket, request) => {
    const userIp = resolveUserIp(request);

    const service = new VoiceLiveSessionService(
      env,
      {
        onEvent: (event) => sendEvent(socket, event),
        onAudioChunk: (chunk) => {
          if (socket.readyState === socket.OPEN) {
            socket.send(chunk, { binary: true });
          }
        },
      },
      {
        userIp,
      },
    );

    // Handle incoming messages: binary = audio data, text = control events
    socket.on(
      "message",
      withWsAsyncHandler(socket, async (rawData, isBinary) => {
        if (isBinary) {
          const bytes =
            rawData instanceof Buffer
              ? rawData
              : Buffer.from(rawData as ArrayBuffer);
          await service.pushAudio(new Uint8Array(bytes));
          return;
        }

        const event = parseControlEvent(rawData);
        if (!event) {
          sendEvent(socket, {
            type: "error",
            message: "Malformed client JSON event",
            code: "BAD_CLIENT_PAYLOAD",
            hint: "Refresh the page and try again.",
          });
          return;
        }

        // session.start is the only event that triggers the VoiceLive connection
        if (event.type === "session.start") {
          try {
            await service.connect(
              event.instructionMode,
              event.speakerProfile,
              userIp,
            );
          } catch (error) {
            const readable = toReadableConnectError(error);
            sendEvent(socket, {
              type: "error",
              message: readable.message,
              code: readable.code,
              hint: readable.hint,
            });
            socket.close(1011, "Voice service unavailable");
            return;
          }
        }

        await service.handleControl(event);
      }),
    );

    // Disconnect the VoiceLive session cleanly when the socket closes or errors
    socket.on(
      "close",
      withWsAsyncHandler(socket, async () => {
        await service.disconnect();
      }),
    );

    socket.on(
      "error",
      withWsAsyncHandler(socket, async () => {
        await service.disconnect();
      }),
    );
  });
}
