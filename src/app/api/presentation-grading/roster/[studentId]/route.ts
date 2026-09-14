import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { lookupRosterEntry } from "@/lib/services/presentation-roster-service";

const StudentIdSchema = z.string().regex(/^\d{5,15}$/);

export async function GET(
  _request: Request,
  { params }: { params: { studentId: string } }
) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const parsed = StudentIdSchema.safeParse(params.studentId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Student ID must be 5–15 digits" }, { status: 400 });
  }

  const entry = await lookupRosterEntry(parsed.data);
  if (!entry) {
    return NextResponse.json({ error: "Student not found in the sign-up sheet" }, { status: 404 });
  }
  return NextResponse.json({ data: entry });
}
