import { NextResponse } from "next/server";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { FeedbackEmailInputSchema } from "@/lib/feedback-email";
import { draftPresentationFeedback } from "@/lib/services/feedback-draft-service";
import { sendPresentationFeedback } from "@/lib/services/feedback-email-service";

/** Editable draft of the AI feedback, written as a letter and signed with the caller's name. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const result = await draftPresentationFeedback(params.id, auth.user.name ?? "Course staff");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}

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
