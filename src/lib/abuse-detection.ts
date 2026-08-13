import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { contentFlagStaffEmail, messageVolumeStaffEmail, rateLimitAbuseStaffEmail } from "@/lib/email-templates";
import { logger } from "@/lib/logger";

// Jailbreak / prompt injection patterns (case-insensitive)
const CONTENT_FLAG_PATTERNS = [
  /ignore\s+(your|all|previous|prior)\s+(instructions|rules|guidelines)/i,
  /pretend\s+(you\s+are|to\s+be|you're)/i,
  /you\s+are\s+now\s+(a|an|no\s+longer)/i,
  /disregard\s+(your|all|previous|prior)\s+(instructions|rules)/i,
  /bypass\s+(your|the|any)\s+(restrictions|filters|safety)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /act\s+as\s+if\s+you\s+have\s+no\s+(restrictions|rules|guidelines)/i,
  /override\s+(your|the|system)\s+(prompt|instructions)/i,
  /forget\s+(your|all|previous)\s+(instructions|rules|training)/i,
];

const NOTIFICATION_COOLDOWN_MS = 60 * 60 * 1000; // max 1 notification per user per type

const RATE_ABUSE_THRESHOLD = 3; // 3+ rate limit hits in 1 hour = escalation
const RATE_ABUSE_WINDOW_MS = 60 * 60 * 1000;

/** Messages per hour from one user that count as abnormal volume. */
const MESSAGE_VOLUME_THRESHOLD = parseInt(process.env.MESSAGE_VOLUME_ALERT_THRESHOLD || "60", 10);
const MESSAGE_VOLUME_WINDOW_MS = 60 * 60 * 1000;

/**
 * Dedups notifications through AuditLog instead of process memory, so a
 * serverless fleet does not send one alert per instance.
 */
async function shouldNotify(userId: string, type: string): Promise<boolean> {
  const since = new Date(Date.now() - NOTIFICATION_COOLDOWN_MS);
  const recent = await prisma.auditLog.count({
    where: {
      userId,
      action: "abuse_notified",
      createdAt: { gte: since },
      details: { path: ["type"], equals: type },
    },
  });
  if (recent > 0) return false;

  await prisma.auditLog.create({
    data: { userId, action: "abuse_notified", details: { type } },
  });
  return true;
}

/**
 * Staff recipients for abuse alerts: TA/ADMIN accounts plus any address in
 * `ABUSE_ALERT_EMAILS` (comma separated), so the platform owner is notified
 * even without a staff account.
 */
async function getStaffEmails(): Promise<string[]> {
  const staff = await prisma.user.findMany({
    where: {
      role: { in: ["TA", "ADMIN"] },
      isBanned: false,
      isDeleted: false,
    },
    select: { email: true },
  });
  const configured = (process.env.ABUSE_ALERT_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  return Array.from(new Set([...staff.map((s) => s.email), ...configured].filter(Boolean)));
}

/**
 * Check message content for jailbreak/prompt injection patterns.
 * Returns matched patterns (empty array = clean).
 */
export function checkContentFlags(message: string): string[] {
  const flags: string[] = [];
  for (const pattern of CONTENT_FLAG_PATTERNS) {
    if (pattern.test(message)) {
      flags.push(pattern.source);
    }
  }
  return flags;
}

/**
 * Log a content flag to AuditLog and notify staff (fire-and-forget).
 */
export async function handleContentFlag(
  userId: string,
  userName: string,
  message: string,
  flags: string[]
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action: "content_flag",
      details: {
        flags,
        messagePreview: message.slice(0, 200),
      },
    },
  });

  if (await shouldNotify(userId, "content_flag")) {
    const staffEmails = await getStaffEmails();
    if (staffEmails.length > 0) {
      sendEmail({
        to: staffEmails,
        subject: `[PhysTutor] Content flag: ${userName.replace(/[\r\n]/g, "")}`,
        html: contentFlagStaffEmail({
          userName,
          userId,
          flags,
          messagePreview: message.slice(0, 500),
          adminUrl: process.env.NEXTAUTH_URL || "",
        }),
      }).catch((err) => console.error("[email] Failed to send content flag notification:", err));
    }
  }
}

/**
 * Track rate limit hits and escalate if threshold exceeded.
 * Call this each time a user hits the rate limit.
 */
export async function trackRateLimitAbuse(userId: string, userName: string) {
  const since = new Date(Date.now() - RATE_ABUSE_WINDOW_MS);
  const hitCount = await prisma.auditLog.count({
    where: { userId, action: "rate_limit_hit", createdAt: { gte: since } },
  });

  if (hitCount < RATE_ABUSE_THRESHOLD) return;
  if (!(await shouldNotify(userId, "rate_abuse"))) return;

  await prisma.auditLog.create({
    data: {
      userId,
      action: "abuse_detected",
      details: {
        type: "rate_limit_abuse",
        hitCount,
        windowMinutes: 60,
      },
    },
  });

  const staffEmails = await getStaffEmails();
  if (staffEmails.length > 0) {
    sendEmail({
      to: staffEmails,
      subject: `[PhysTutor] Rate limit abuse: ${userName.replace(/[\r\n]/g, "")}`,
      html: rateLimitAbuseStaffEmail({
        userName,
        userId,
        hitCount,
        adminUrl: process.env.NEXTAUTH_URL || "",
      }),
    }).catch((err) => logger.error("Failed to send rate abuse notification", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}

/**
 * Alerts staff when one user's hourly message count crosses
 * `MESSAGE_VOLUME_ALERT_THRESHOLD`. Unlike the spam guard (30 messages in a
 * minute, auto-ban) this catches sustained heavy use without blocking anyone.
 */
export async function trackMessageVolume(userId: string, userName: string) {
  const since = new Date(Date.now() - MESSAGE_VOLUME_WINDOW_MS);
  const messageCount = await prisma.message.count({
    where: { conversation: { userId }, role: "user", createdAt: { gte: since } },
  });

  if (messageCount < MESSAGE_VOLUME_THRESHOLD) return;
  if (!(await shouldNotify(userId, "message_volume"))) return;

  await prisma.auditLog.create({
    data: {
      userId,
      action: "abuse_detected",
      details: { type: "message_volume", messageCount, windowMinutes: 60 },
    },
  });

  const staffEmails = await getStaffEmails();
  if (staffEmails.length === 0) return;

  sendEmail({
    to: staffEmails,
    subject: `[PhysTutor] Unusual message volume: ${userName.replace(/[\r\n]/g, "")}`,
    html: messageVolumeStaffEmail({
      userName,
      userId,
      messageCount,
      threshold: MESSAGE_VOLUME_THRESHOLD,
      adminUrl: process.env.NEXTAUTH_URL || "",
    }),
  }).catch((err) => logger.error("Failed to send message volume notification", {
    userId,
    error: err instanceof Error ? err.message : String(err),
  }));
}
