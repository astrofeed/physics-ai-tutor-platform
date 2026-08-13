import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendVerificationEmail } from "@/lib/services/email-verification-service";
import { consumeAuthAttempt } from "@/lib/services/auth-attempt-limit";

/** Generic message so registration cannot be used to enumerate accounts. */
const GENERIC_FAILURE = "Registration failed. Please check your details or contact support.";

export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
  studentId: string;
}

export type RegistrationResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Creates an unverified account and emails a verification link. The account
 * exists but cannot use the tutor until the link is opened, so a typo'd or
 * fake address never yields a usable account.
 */
export async function registerUser(
  input: RegistrationInput,
  clientIp: string
): Promise<RegistrationResult> {
  const { allowed } = await consumeAuthAttempt("register", clientIp);
  if (!allowed) {
    return {
      ok: false,
      status: 429,
      error: "Too many registration attempts from this network. Please try again later.",
    };
  }

  const email = input.email.trim().toLowerCase();
  const studentId = input.studentId.trim();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { studentId }] },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, status: 400, error: GENERIC_FAILURE };
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: { name: input.name.trim(), email, passwordHash, studentId },
    select: { id: true, name: true, email: true },
  });

  try {
    await sendVerificationEmail(user);
  } catch (error) {
    logger.error("Failed to send verification email", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { ok: true };
}
