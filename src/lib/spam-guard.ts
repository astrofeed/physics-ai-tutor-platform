import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { accountSuspendedEmail, userAutoBannedStaffEmail } from "@/lib/email-templates";

/**
 * Check if a user should be auto-banned for spam.
 * Counts records in a table within a time window.
 * If threshold exceeded: bans user, sends email, logs audit.
 *
 * @returns true if user was banned (or already banned)
 */
export async function checkAndBanSpammer({
  userId,
  source,
  threshold = 30,
  windowMs = 60_000,
}: {
  userId: string;
  source: "activity" | "chat" | "appeal";
  threshold?: number;
  windowMs?: number;
}): Promise<boolean> {
  try {
    const since = new Date(Date.now() - windowMs);

    // Count recent records based on source
    let recentCount: number;
    if (source === "chat") {
      recentCount = await prisma.message.count({
        where: {
          conversation: { userId },
          role: "user",
          createdAt: { gte: since },
        },
      });
    } else if (source === "appeal") {
      recentCount = await prisma.appealMessage.count({
        where: {
          user: { id: userId },
          createdAt: { gte: since },
        },
      });
    } else {
      recentCount = await prisma.userActivity.count({
        where: { userId, createdAt: { gte: since } },
      });
    }

    if (recentCount < threshold) return false;

    // Check if already banned
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true, name: true, email: true },
    });
    if (!user || user.isBanned) return user?.isBanned ?? false;

    // Ban the user
    await prisma.user.update({
      where: { id: userId },
      data: { isBanned: true, bannedAt: new Date() },
    });

    const sourceLabel = source === "chat" ? "chat messages" : source === "appeal" ? "appeal messages" : "activity requests";
    const reason = `Auto-banned: ${recentCount} ${sourceLabel} in 1 minute (threshold: ${threshold})`;

    // Log ban in audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: "ban",
        details: { performedBy: "system", reason },
      },
    });

    // Send email to banned user
    const name = user.name || "User";
    const email = user.email;
    if (email) {
      const subject = "PhysTutor Account Suspended — Unusual Activity Detected";
      const html = accountSuspendedEmail({ userName: name, recentCount, sourceLabel });
      try {
        await sendEmail({ to: email, subject, html });
      } catch (emailError) {
        console.error(`[spam] Ban applied but suspension email to ${email} failed:`, emailError);
        return true;
      }

      await prisma.auditLog.create({
        data: {
          userId,
          action: "bulk_email_sent",
          details: {
            performedBy: "system",
            performedByName: "PhysTutor System",
            recipientIds: [userId],
            recipientCount: 1,
            subject,
            message: reason,
            sentCount: 1,
            failedCount: 0,
          },
        },
      });

      // Email TAs about the ban
      const tas = await prisma.user.findMany({
        where: { role: { in: ["TA", "PROFESSOR", "ADMIN"] }, isBanned: false, isDeleted: false },
        select: { email: true },
      });
      const taEmails = tas.map((t) => t.email).filter(Boolean) as string[];
      if (taEmails.length > 0) {
        await sendEmail({
          to: taEmails,
          subject: `[PhysTutor] User auto-banned: ${(name || "").replace(/[\r\n]/g, "")} (${(email || "").replace(/[\r\n]/g, "")})`,
          html: userAutoBannedStaffEmail({
            userName: name,
            userEmail: email,
            reason,
            adminUrl: process.env.NEXTAUTH_URL || "",
          }),
        }).catch((emailError) =>
          console.error("[spam] Failed to notify staff about auto-ban:", emailError)
        );
      }
    }

    console.warn(`[spam] Auto-banned user ${userId} (${email}): ${reason}`);
    return true;
  } catch (error) {
    console.error("[spam] Error checking/banning spammer:", error);
    return false;
  }
}
