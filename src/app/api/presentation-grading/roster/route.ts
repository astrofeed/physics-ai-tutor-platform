import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { logger } from "@/lib/logger";
import {
  RosterImportError,
  getRosterSummary,
  importRosterFromSheet,
} from "@/lib/services/presentation-roster-service";

const ImportInputSchema = z.object({
  sheetUrl: z.string().min(1).max(2000),
});

export async function GET() {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  return NextResponse.json({ data: await getRosterSummary() });
}

export async function PUT(request: Request) {
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const parsed = ImportInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste the Google Sheets link" }, { status: 400 });
  }

  try {
    const summary = await importRosterFromSheet(parsed.data.sheetUrl, auth.user.id);
    return NextResponse.json({ data: summary });
  } catch (error) {
    if (error instanceof RosterImportError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error("Roster import failed", { error });
    return NextResponse.json({ error: "Failed to import the sign-up sheet" }, { status: 500 });
  }
}
