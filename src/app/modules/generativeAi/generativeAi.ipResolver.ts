import { isIP } from "node:net";
import type { IncomingMessage } from "node:http";

/**
 * Normalizes a single IP address candidate string into a clean IP.
 *
 * Handles:
 * - Quoted strings
 * - IPv4-mapped IPv6 prefix (::ffff:)
 * - Bracketed IPv6 with optional port ([::1]:3000)
 * - IPv4 with port (1.2.3.4:3000)
 *
 * Returns null if the result is not a valid IP address.
 */
export function normalizeIpCandidate(candidate: string): string | null {
  const trimmed = candidate.trim().replace(/^"|"$/g, "");
  if (!trimmed || trimmed.toLowerCase() === "unknown") {
    return null;
  }

  const withoutV4MappedPrefix = trimmed.startsWith("::ffff:")
    ? trimmed.slice("::ffff:".length)
    : trimmed;

  // Handle bracketed IPv6 like [::1] or [::1]:3000
  const bracketedIpv6 = withoutV4MappedPrefix.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6?.[1]) {
    const host = bracketedIpv6[1];
    return isIP(host) ? host : null;
  }

  if (isIP(withoutV4MappedPrefix)) {
    return withoutV4MappedPrefix;
  }

  // Handle IPv4:port like 1.2.3.4:3000
  const ipv4WithPort = withoutV4MappedPrefix.match(
    /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/,
  );
  if (ipv4WithPort?.[1] && isIP(ipv4WithPort[1])) {
    return ipv4WithPort[1];
  }

  return null;
}

/**
 * Resolves the real client IP from an incoming HTTP/WebSocket request.
 *
 * Checks headers in this priority order:
 * 1. X-Forwarded-For (first IP in the chain)
 * 2. X-Real-IP
 * 3. X-Client-IP
 * 4. Socket remote address
 *
 * Falls back gracefully at each step if the header is missing or invalid.
 */
export function resolveUserIp(request: IncomingMessage): string {
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
