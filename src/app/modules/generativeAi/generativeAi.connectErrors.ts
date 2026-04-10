/**
 * Converts a raw connection error into a structured, user-friendly error object.
 *
 * Detects the most common failure categories:
 * - SDK runtime mismatch (require is not defined)
 * - Azure authentication failures (401 / 403)
 * - Network connectivity issues (ENOTFOUND / ECONNREFUSED / timeout)
 *
 * Falls back to a generic error object for unknown failures.
 */
export function toReadableConnectError(error: unknown): {
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
