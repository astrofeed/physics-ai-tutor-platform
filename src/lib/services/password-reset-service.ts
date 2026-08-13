import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email-templates";

const TOKEN_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

/**
 * Creates a one-time password reset token for the account with the given
 * email (if it exists and uses credentials login) and emails the reset link.
 * Silently succeeds for unknown emails to prevent account enumeration.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, email: true, passwordHash: true, isDeleted: true },
  });

  if (!user || user.isDeleted || !user.passwordHash) return;

  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt },
    }),
  ]);

  const resetUrl = `${getBaseUrl()}/reset-password?token=${rawToken}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your PhysTutor password",
    html: passwordResetEmail({
      userName: user.name || "there",
      resetUrl,
      expiresMinutes: TOKEN_TTL_MINUTES,
    }),
  });
}

/**
 * Validates a reset token and sets the user's new password. Consumes the
 * token so it cannot be reused. Returns false if the token is invalid,
 * expired, or already used.
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, isDeleted: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date() || record.user.isDeleted) {
    return false;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
  ]);

  return true;
}
