// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Clean up expired rate limit entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((entry, key) => {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  });
}, 60_000);

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "3600000", 10); // default 1 hour
const MAX_REQUESTS_NORMAL = parseInt(process.env.RATE_LIMIT_MAX_NORMAL || "30", 10);
const MAX_REQUESTS_RESTRICTED = parseInt(process.env.RATE_LIMIT_MAX_RESTRICTED || "10", 10);

/**
 * Rate limit by an arbitrary key (e.g. IP address) with a custom window.
 * Used for unauthenticated endpoints like forgot-password.
 */
export function checkIpRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  entry.count++;
  return { allowed: entry.count <= maxRequests };
}

export function checkRateLimit(userId: string, isRestricted: boolean): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const limit = isRestricted ? MAX_REQUESTS_RESTRICTED : MAX_REQUESTS_NORMAL;

  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1, resetAt: now + WINDOW_MS };
  }

  entry.count++;

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

