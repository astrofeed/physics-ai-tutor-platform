import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { EMAIL_SENT_AUDIT_ACTIONS } from "@/lib/constants";

export async function GET(req: Request) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "15", 10)));
    const filter = searchParams.get("filter") || "all"; // all | sent | scheduled

    // Sent mail: staff bulk emails and per-student grading feedback
    const sentWhere = { action: { in: [...EMAIL_SENT_AUDIT_ACTIONS] } };

    // Fetch scheduled emails
    const scheduledWhere = filter === "sent"
      ? undefined
      : { status: { in: ["PENDING" as const, "SENT" as const, "CANCELLED" as const, "FAILED" as const] } };

    const [logs, sentCount, scheduledEmails, scheduledCount] = await Promise.all([
      filter === "scheduled"
        ? Promise.resolve([])
        : prisma.auditLog.findMany({
            where: sentWhere,
            skip: filter === "all" ? undefined : (page - 1) * pageSize,
            take: filter === "all" ? undefined : pageSize,
            orderBy: { createdAt: "desc" },
            include: { user: { select: { name: true, email: true } } },
          }),
      prisma.auditLog.count({ where: sentWhere }),
      !scheduledWhere
        ? Promise.resolve([])
        : prisma.scheduledEmail.findMany({
            where: scheduledWhere,
            skip: filter === "all" ? undefined : (page - 1) * pageSize,
            take: filter === "all" ? undefined : pageSize,
            orderBy: { scheduledAt: "desc" },
            include: { createdBy: { select: { name: true, email: true } } },
          }),
      prisma.scheduledEmail.count({
        where: scheduledWhere ?? { status: "PENDING" },
      }),
    ]);

    // Collect all recipientIds to resolve in bulk
    const allRecipientIds = new Set<string>();
    for (const l of logs) {
      const ids = (l.details as Record<string, unknown>)?.recipientIds;
      if (Array.isArray(ids)) ids.forEach((id: string) => allRecipientIds.add(id));
    }
    for (const s of scheduledEmails) {
      if (Array.isArray(s.recipientIds)) (s.recipientIds as string[]).forEach((id) => allRecipientIds.add(id));
    }

    // Resolve user names/emails
    const recipientUsers = allRecipientIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(allRecipientIds) } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(recipientUsers.map((u) => [u.id, { name: u.name, email: u.email }]));

    const resolveRecipients = (ids: unknown) => {
      if (!Array.isArray(ids)) return [];
      return (ids as string[]).map((id) => {
        const u = userMap.get(id);
        return u ? { name: u.name, email: u.email } : { name: null, email: id };
      });
    };

    // Map sent records
    const sentRecords = logs.map((l) => {
      const det = l.details as Record<string, unknown> | null;
      return {
        id: l.id,
        type: "sent" as const,
        userId: l.userId,
        userName: l.user.name,
        userEmail: l.user.email,
        action: l.action,
        details: det,
        recipients: resolveRecipients(det?.recipientIds),
        createdAt: l.createdAt.toISOString(),
        scheduledAt: null as string | null,
        targetAt: null as string | null,
        status: "SENT" as string,
      };
    });

    // Map scheduled records
    const scheduledRecords = scheduledEmails.map((s) => ({
      id: `sched-${s.id}`,
      type: "scheduled" as const,
      userId: s.createdById,
      userName: s.createdBy.name,
      userEmail: s.createdBy.email,
      action: "scheduled_email",
      details: {
        subject: s.subject,
        message: s.message,
        recipientCount: Array.isArray(s.recipientIds) ? (s.recipientIds as string[]).length : 0,
        assignmentId: (s as Record<string, unknown>).assignmentId ?? null,
        createNotification: s.createNotification,
      } as Record<string, unknown>,
      recipients: resolveRecipients(s.recipientIds),
      createdAt: s.createdAt.toISOString(),
      scheduledAt: s.scheduledAt.toISOString(),
      targetAt: s.scheduledAt.toISOString(),
      status: s.status,
    }));

    // Combine and sort
    let records;
    if (filter === "sent") {
      records = sentRecords;
    } else if (filter === "scheduled") {
      records = scheduledRecords;
    } else {
      records = [...sentRecords, ...scheduledRecords].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    // Paginate combined results for "all" filter
    const totalCount = filter === "all"
      ? sentRecords.length + scheduledRecords.length
      : filter === "sent" ? sentCount : scheduledCount;

    const paginatedRecords = filter === "all"
      ? records.slice((page - 1) * pageSize, page * pageSize)
      : records;

    return NextResponse.json({
      records: paginatedRecords,
      totalCount,
      sentCount,
      scheduledCount,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Email records error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
