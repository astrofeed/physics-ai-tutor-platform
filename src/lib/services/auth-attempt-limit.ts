import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60 * 60 * 1000;

export type AuthAttemptKind = "register" | "verify_resend" | "forgot_password";

const LIMITS: Record<AuthAttemptKind, number> = {
  register: 5,
  verify_resend: 5,
  forgot_password: 5,
};

/** IPs are stored hashed so the table holds no raw client addresses. */
function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Records an unauthenticated auth attempt and reports whether the client has
 * exhausted its hourly allowance. DB-backed so the limit holds across
 * serverless instances.
 */
export async function consumeAuthAttempt(
  kind: AuthAttemptKind,
  ip: string
): Promise<{ allowed: boolean }> {
  const ipHash = hashIp(ip);
  const since = new Date(Date.now() - WINDOW_MS);

  const attempts = await prisma.authAttempt.count({
    where: { kind, ipHash, createdAt: { gte: since } },
  });
  if (attempts >= LIMITS[kind]) return { allowed: false };

  await prisma.authAttempt.create({ data: { kind, ipHash } });
  return { allowed: true };
}
