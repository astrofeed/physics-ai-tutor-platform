import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/services/password-reset-service";
import { clientIp, consumeAuthAttempt } from "@/lib/services/auth-attempt-limit";

const ForgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});

const GENERIC_RESPONSE = {
  message: "If an account exists for that email, a reset link has been sent.",
};

export async function POST(req: Request) {
  try {
    const limit = await consumeAuthAttempt("forgot_password", clientIp(req));
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = ForgotPasswordSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    await requestPasswordReset(parsed.data.email.toLowerCase());

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("[forgot-password] Failed:", error);
    // Still return the generic response so failures can't be used to probe accounts
    return NextResponse.json(GENERIC_RESPONSE);
  }
}
