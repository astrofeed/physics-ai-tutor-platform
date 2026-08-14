import { prisma } from "@/lib/prisma";

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "3600000", 10); // default 1 hour
const MAX_REQUESTS_NORMAL = parseInt(process.env.RATE_LIMIT_MAX_NORMAL || "30", 10);
const MAX_REQUESTS_RESTRICTED = parseInt(process.env.RATE_LIMIT_MAX_RESTRICTED || "10", 10);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Counts the user's own chat messages in the current window. The count comes
 * from the database rather than process memory, so the limit holds no matter
 * which serverless instance serves the request.
 */
export async function checkRateLimit(
  userId: string,
  isRestricted: boolean
): Promise<RateLimitResult> {
  const limit = isRestricted ? MAX_REQUESTS_RESTRICTED : MAX_REQUESTS_NORMAL;
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const oldestInWindow = await prisma.message.findFirst({
    where: { conversation: { userId }, role: "user", createdAt: { gte: windowStart } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const used = oldestInWindow
    ? await prisma.message.count({
        where: { conversation: { userId }, role: "user", createdAt: { gte: windowStart } },
      })
    : 0;

  const resetAt = (oldestInWindow?.createdAt.getTime() ?? Date.now()) + WINDOW_MS;

  if (used >= limit) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return { allowed: true, remaining: limit - used - 1, resetAt };
}
