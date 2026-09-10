import { NextResponse } from "next/server";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { HumanScoresInputSchema } from "@/lib/human-grading";
import { savePresentationHumanScores } from "@/lib/services/human-grading-service";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const body = HumanScoresInputSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const result = await savePresentationHumanScores(params.id, auth.user.id, body.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ data: { ok: true } });
}
