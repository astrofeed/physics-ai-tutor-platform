import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser } from "@/lib/services/registration-service";
import { clientIp } from "@/lib/services/auth-attempt-limit";
import { logger } from "@/lib/logger";

const RegisterInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200)
    .regex(/[A-Z]/, "Password must contain uppercase, lowercase, and a number")
    .regex(/[a-z]/, "Password must contain uppercase, lowercase, and a number")
    .regex(/[0-9]/, "Password must contain uppercase, lowercase, and a number"),
  studentId: z.string().trim().min(1).max(50),
});

export async function POST(req: Request) {
  try {
    const parsed = RegisterInputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid registration details" },
        { status: 400 }
      );
    }

    const result = await registerUser(parsed.data, clientIp(req));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: "Check your email for a verification link to activate your account.",
    });
  } catch (error) {
    logger.error("Registration failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
