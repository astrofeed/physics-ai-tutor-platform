import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const assignmentId = req.nextUrl.searchParams.get("assignmentId");

    const where: Prisma.SubmissionWhereInput = {
      isDraft: false,
      isDeleted: false,
      assignment: { isDeleted: false },
      ...(assignmentId && { assignmentId }),
    };

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, studentId: true } },
        assignment: { select: { title: true, totalPoints: true } },
      },
      orderBy: [{ assignment: { title: "asc" } }, { user: { name: "asc" } }],
    });

    const rows: string[] = [];

    if (assignmentId) {
      rows.push("Student Name,Email,Student ID,Score,Total Points,Submitted At,Graded At");
      for (const s of submissions) {
        rows.push(
          [
            escapeCSV(s.user.name),
            escapeCSV(s.user.email),
            escapeCSV(s.user.studentId),
            s.totalScore != null ? String(s.totalScore) : "",
            String(s.assignment.totalPoints),
            s.submittedAt.toISOString(),
            s.gradedAt?.toISOString() ?? "",
          ].join(",")
        );
      }
    } else {
      rows.push("Student Name,Email,Student ID,Assignment,Score,Total Points,Submitted At,Graded At");
      for (const s of submissions) {
        rows.push(
          [
            escapeCSV(s.user.name),
            escapeCSV(s.user.email),
            escapeCSV(s.user.studentId),
            escapeCSV(s.assignment.title),
            s.totalScore != null ? String(s.totalScore) : "",
            String(s.assignment.totalPoints),
            s.submittedAt.toISOString(),
            s.gradedAt?.toISOString() ?? "",
          ].join(",")
        );
      }
    }

    const csv = rows.join("\n");

    let filename = "grades-all.csv";
    if (assignmentId && submissions.length > 0) {
      const title = submissions[0].assignment.title
        .replace(/[^a-zA-Z0-9_\- ]/g, "_")
        .trim()
        .substring(0, 80);
      filename = `${title}.csv`;
    }

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Grade export error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
