import { prisma } from "@/lib/prisma";

/** Namespace keeping these locks apart from any other advisory lock. */
const RATE_LIMIT_LOCK_NAMESPACE = 4272;

export type RateLimitedAction = "run_code" | "presentation_grading_job" | "report_grading_job";

export interface ActionRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Records one attempt of `action` for a user and reports whether it stays
 * within `limit` per `windowMs`. Attempts live in the database and the count is
 * taken under an advisory lock, so the limit holds across serverless instances
 * and concurrent requests instead of resetting with each process.
 */
export async function consumeActionRateLimit(params: {
  userId: string;
  action: RateLimitedAction;
  limit: number;
  windowMs: number;
}): Promise<ActionRateLimitResult> {
  const { userId, action, limit, windowMs } = params;
  const windowStart = new Date(Date.now() - windowMs);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RATE_LIMIT_LOCK_NAMESPACE}, hashtext(${`${action}:${userId}`}))`;

    const hits = await tx.rateLimitHit.findMany({
      where: { userId, action, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    if (hits.length >= limit) {
      const oldest = hits[0].createdAt.getTime();
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, oldest + windowMs - Date.now()),
      };
    }

    await tx.rateLimitHit.create({ data: { userId, action } });
    await tx.rateLimitHit.deleteMany({ where: { userId, action, createdAt: { lt: windowStart } } });

    return { allowed: true, remaining: limit - hits.length - 1, retryAfterMs: 0 };
  });
}
