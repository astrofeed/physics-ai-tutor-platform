import { NextResponse } from "next/server";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { FeedbackEmailInputSchema } from "@/lib/feedback-email";
import { sendPresentationFeedback } from "@/lib/services/feedback-email-service";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const body = FeedbackEmailInputSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      { error: "A valid recipient email, subject (≤500 chars) and message (≤10,000 chars) are required" },
      { status: 400 }
    );
  }
  const result = await sendPresentationFeedback(params.id, auth.user, body.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ data: { sentAt: result.sentAt } });
}
