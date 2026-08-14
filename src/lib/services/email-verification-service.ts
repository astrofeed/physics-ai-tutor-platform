import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { emailVerificationEmail } from "@/lib/email-templates";

const TOKEN_TTL_HOURS = 24;

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
 * Issues a fresh verification token for an account and emails the link.
 * Tokens are stored hashed in `VerificationToken`, keyed by email.
 */
export async function sendVerificationEmail(user: {
  name: string | null;
  email: string;
}): Promise<void> {
  const rawToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60_000);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: user.email } }),
    prisma.verificationToken.create({
      data: { identifier: user.email, token: hashToken(rawToken), expires },
    }),
  ]);

  await sendEmail({
    to: user.email,
    subject: "Verify your PhysTutor email",
    html: emailVerificationEmail({
      userName: user.name || "there",
      verifyUrl: `${getBaseUrl()}/verify-email?token=${rawToken}`,
      expiresHours: TOKEN_TTL_HOURS,
    }),
  });
}

/**
 * Consumes a verification token and marks the account verified.
 * Returns false for unknown, expired, or already-consumed tokens.
 */
export async function verifyEmailToken(token: string): Promise<boolean> {
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(token) },
  });

  if (!record) return false;
  if (record.expires < new Date()) {
    await prisma.verificationToken.deleteMany({ where: { token: record.token } });
    return false;
  }

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { email: record.identifier },
      data: { emailVerified: new Date(), isVerified: true },
    }),
    prisma.verificationToken.deleteMany({ where: { identifier: record.identifier } }),
  ]);

  return true;
}

/** Resends the verification link, unless the address is already verified. */
export async function resendVerificationEmail(email: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { name: true, email: true, emailVerified: true, isDeleted: true },
  });

  if (!user || user.isDeleted || user.emailVerified) return;

  await sendVerificationEmail(user);
}
