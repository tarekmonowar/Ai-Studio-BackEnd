import { isIP } from "node:net";

// Message shown to users who have exceeded their free tier usage time
export const FREE_TIER_LIMIT_MESSAGE =
  "Your free tier has ended. If you want to practice further, please contact Tarek Monowar.";

/**
 * Normalizes a raw IP string from request headers into a clean IP address.
 *
 * Handles:
 * - Quoted strings (e.g. "1.2.3.4" with quotes)
 * - IPv4-mapped IPv6 addresses (e.g. ::ffff:1.2.3.4)
 * - IPv4 addresses with ports (e.g. 1.2.3.4:12345)
 *
 * Returns "unknown" for empty or unresolvable input.
 */
export function normalizeRateLimitIp(rawIp: string): string {
  const trimmed = rawIp.trim().replace(/^"|"$/g, "");
  if (!trimmed) {
    return "unknown";
  }

  const withoutV4MappedPrefix = trimmed.startsWith("::ffff:")
    ? trimmed.slice("::ffff:".length)
    : trimmed;

  const ipv4WithPort = withoutV4MappedPrefix.match(
    /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/,
  );
  const candidate = ipv4WithPort?.[1] ?? withoutV4MappedPrefix;

  if (isIP(candidate) === 4) {
    return candidate;
  }

  if (isIP(candidate) === 6) {
    return candidate.toLowerCase();
  }

  return candidate.toLowerCase();
}

/**
 * Builds a rate limit bucket key from a raw IP address.
 *
 * IPv4 addresses are grouped into /24 subnets (e.g. 1.2.3.x → 1.2.3.0/24)
 * so users sharing a local network share the same rate limit bucket.
 * IPv6 addresses are used as-is.
 */
export function buildRateLimitKey(rawIp: string): string {
  const normalizedIp = normalizeRateLimitIp(rawIp);

  if (isIP(normalizedIp) === 4) {
    const [a, b, c] = normalizedIp.split(".");
    return `${a}.${b}.${c}.0/24`;
  }

  return normalizedIp;
}
