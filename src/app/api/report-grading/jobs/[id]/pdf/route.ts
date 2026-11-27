import { NextResponse } from "next/server";
import type { RouteContext } from "@/types/route";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { STAFF_ROLES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { isUploadedBlobUrl } from "@/lib/chat-attachments";
import { REPORT_FILE_MAX_BYTES } from "@/lib/report-grading";
import { logger } from "@/lib/logger";

function safeFilename(name: string | null): string {
  const cleaned = (name ?? "report.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

/**
 * Streams a retained report PDF to authenticated staff so the grading page
 * can render it side by side without exposing raw Blob URLs.
 */
export async function GET(
  _request: Request,
  { params: routeParams }: RouteContext
) {
  const params = await routeParams;
  const auth = await requireApiRole([...STAFF_ROLES]);
  if (isErrorResponse(auth)) return auth;

  const job = await prisma.reportGradingJob.findUnique({
    where: { id: params.id },
    select: { reportBlobUrl: true, reportFilename: true },
  });
  if (!job || !job.reportBlobUrl) {
    return NextResponse.json({ error: "Report PDF not available" }, { status: 404 });
  }
  if (!isUploadedBlobUrl(job.reportBlobUrl)) {
    logger.warn("Report grading PDF route rejected non-Blob URL", { jobId: params.id });
    return NextResponse.json({ error: "Invalid report file reference" }, { status: 400 });
  }

  try {
    const upstream = await fetch(job.reportBlobUrl);
    if (!upstream.ok) {
      logger.warn("Report PDF fetch from Blob failed", {
        jobId: params.id,
        status: upstream.status,
      });
      return NextResponse.json({ error: "Report PDF could not be loaded" }, { status: 502 });
    }
    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > REPORT_FILE_MAX_BYTES) {
      return NextResponse.json({ error: "Report PDF exceeds size limit" }, { status: 413 });
    }
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeFilename(job.reportFilename)}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logger.error("Report PDF proxy failed", {
      jobId: params.id,
      error: (error as Error).message,
    });
    return NextResponse.json({ error: "Failed to load report PDF" }, { status: 502 });
  }
}
