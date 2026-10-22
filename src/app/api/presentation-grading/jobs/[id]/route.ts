import { NextResponse } from "next/server";
import { UpdatePresentationJobSchema } from "@/lib/validators/presentation-job";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import {
  getPresentationJob,
  updatePresentationJob,
  deletePresentationJob,
} from "@/lib/services/presentation-grading-service";
import { refreshRosterIfStale } from "@/lib/services/presentation-roster-service";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  await refreshRosterIfStale(auth.user.id);
  const job = await getPresentationJob(params.id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ data: job });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const body = UpdatePresentationJobSchema.safeParse(await request.json());
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
