import type { IncomingMessage } from "node:http";
import { isIP } from "node:net";
import type { RawData, WebSocket, WebSocketServer } from "ws";
import { withWsAsyncHandler } from "../../middleware/wsAsyncHandler.js";
import type { AppEnv } from "../../config/env.js";
import type { ClientControlEvent, ServerEvent } from "./generativeAi.types.js";
import { VoiceLiveSessionService } from "./generativeAi.service.js";

function toReadableConnectError(error: unknown): {
  message: string;
  code: string;
  hint: string;
} {
  const rawMessage =
    error instanceof Error ? error.message : "Voice service failed to connect";
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("require is not defined")) {
    return {
      message: "Backend SDK runtime mismatch while initializing VoiceLive.",
      code: "BACKEND_SDK_RUNTIME",
      hint: "Restart backend after reinstalling dependencies in backend folder.",
    };
  }

  if (
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    return {
      message: "Azure authentication failed.",
      code: "AZURE_AUTH_FAILED",
      hint: "Check VOICELIVE_API_KEY and VOICELIVE_ENDPOINT in backend .env.",
    };
  }

  if (
    normalized.includes("enotfound") ||
    normalized.includes("econnrefused") ||
    normalized.includes("timed out") ||
    normalized.includes("network")
  ) {
    return {
      message: "Backend could not reach Azure VoiceLive service.",
      code: "AZURE_NETWORK_ERROR",
      hint: "Verify internet connectivity and the VoiceLive endpoint URL.",
    };
  }

  return {
    message: rawMessage,
    code: "VOICE_CONNECT_FAILED",
    hint: "Check backend logs for the full error and restart the server.",
  };
}

function parseControlEvent(rawData: RawData): ClientControlEvent | null {
  try {
    return JSON.parse(rawData.toString()) as ClientControlEvent;
  } catch {
    return null;
  }
}

function sendEvent(socket: WebSocket, event: ServerEvent): void {
  if (socket.readyState !== socket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(event));
}

function normalizeIpCandidate(candidate: string): string | null {
  const trimmed = candidate.trim().replace(/^"|"$/g, "");
  if (!trimmed || trimmed.toLowerCase() === "unknown") {
    return null;
  }

  const withoutV4MappedPrefix = trimmed.startsWith("::ffff:")
    ? trimmed.slice("::ffff:".length)
    : trimmed;

  const bracketedIpv6 = withoutV4MappedPrefix.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6?.[1]) {
    const host = bracketedIpv6[1];
    return isIP(host) ? host : null;
  }

  if (isIP(withoutV4MappedPrefix)) {
    return withoutV4MappedPrefix;
  }

  const ipv4WithPort = withoutV4MappedPrefix.match(
    /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/,
  );
  if (ipv4WithPort?.[1] && isIP(ipv4WithPort[1])) {
    return ipv4WithPort[1];
  }

  return null;
}

function resolveUserIp(request: IncomingMessage): string {
  const forwarded = request.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0]?.trim();
    const normalized = first ? normalizeIpCandidate(first) : null;
    if (normalized) {
      return normalized;
    }
  }

  const realIp = request.headers["x-real-ip"];
  if (typeof realIp === "string") {
    const normalized = normalizeIpCandidate(realIp);
    if (normalized) {
      return normalized;
    }
  }

  const clientIp = request.headers["x-client-ip"];
  if (typeof clientIp === "string") {
    const normalized = normalizeIpCandidate(clientIp);
    if (normalized) {
      return normalized;
    }
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0]?.split(",")[0]?.trim();
    const normalized = first ? normalizeIpCandidate(first) : null;
    if (normalized) {
      return normalized;
    }
  }

  const normalizedSocketIp = normalizeIpCandidate(
    request.socket.remoteAddress ?? "",
  );
  if (normalizedSocketIp) {
    return normalizedSocketIp;
  }

  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.socket.remoteAddress ?? "unknown";
}

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
