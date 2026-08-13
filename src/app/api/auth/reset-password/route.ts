import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/services/password-reset-service";

const ResetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200)
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export async function POST(req: Request) {
  try {
    const parsed = ResetPasswordSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const ok = await resetPassword(parsed.data.token, parsed.data.password);
    if (!ok) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("[reset-password] Failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
