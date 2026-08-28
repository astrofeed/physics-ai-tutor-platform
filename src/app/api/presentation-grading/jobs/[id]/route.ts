import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { PRESENTATION_STUDENT_IDS_MAX_CHARS } from "@/lib/presentation-grading";
import {
  getPresentationJob,
  updatePresentationJob,
  deletePresentationJob,
} from "@/lib/services/presentation-grading-service";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const job = await getPresentationJob(params.id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ data: job });
}

const UpdateJobSchema = z.object({
  topic: z.string().min(1).max(200).optional(),
  presenters: z.string().max(200).nullable().optional(),
  studentIds: z.string().max(PRESENTATION_STUDENT_IDS_MAX_CHARS).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const body = UpdateJobSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const updated = await updatePresentationJob(params.id, body.data);
  if (!updated) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const deleted = await deletePresentationJob(params.id);
  if (!deleted) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ data: { ok: true } });
}
