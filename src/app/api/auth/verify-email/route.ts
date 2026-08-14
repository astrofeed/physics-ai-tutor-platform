import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resendVerificationEmail,
  verifyEmailToken,
} from "@/lib/services/email-verification-service";
import { clientIp, consumeAuthAttempt } from "@/lib/services/auth-attempt-limit";
import { logger } from "@/lib/logger";

const VerifySchema = z.object({ token: z.string().min(1).max(200) });
const ResendSchema = z.object({ email: z.string().trim().email().max(200) });

/** Consumes a verification token, or resends the link when given an email. */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const resend = ResendSchema.safeParse(body);
    if (resend.success) {
      const { allowed } = await consumeAuthAttempt("verify_resend", clientIp(req));
      if (!allowed) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
      await resendVerificationEmail(resend.data.email);
      // Always generic: never reveal whether the address has an account.
      return NextResponse.json({ message: "If that address needs verification, a new link is on its way." });
    }

    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const verified = await verifyEmailToken(parsed.data.token);
    if (!verified) {
      return NextResponse.json(
        { error: "This verification link is invalid or has expired. Request a new one." },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Email verified. You can now sign in." });
  } catch (error) {
    logger.error("Email verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
