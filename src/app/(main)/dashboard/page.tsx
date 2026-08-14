import { getEffectiveSession } from "@/lib/impersonate";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDate, stripMarkdown } from "@/lib/utils";
import { isStaff } from "@/lib/constants";
import { APPEAL_ON_LIVE_ASSIGNMENT } from "@/lib/services/assignment-service";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getEffectiveSession();
  if (!session?.user) redirect("/login");

  const user = session.user as { id: string; name?: string | null; role?: string };
  const userId = user.id;
  const role = (user.role as string) || "STUDENT";

  const [conversationCount, questionCount, assignmentCount, submissionCount] = await Promise.all([
    prisma.conversation.count({ where: { userId, isDeleted: false } }),
    prisma.message.count({
      where: { role: "user", conversation: { userId, isDeleted: false } },
    }),
    prisma.assignment.count({ where: { published: true, isDeleted: false } }),
    prisma.submission.count({ where: { userId, assignment: { isDeleted: false } } }),
  ]);

  const recentConversations = await prisma.conversation.findMany({
    where: { userId, isDeleted: false },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: {
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const upcomingAssignments = await prisma.assignment.findMany({
    where: {
      published: true,
      isDeleted: false,
      dueDate: { gte: new Date() },
    },
    orderBy: { dueDate: "asc" },
    take: 5,
  });

  let adminStats = null;
  if (role === "ADMIN") {
    const [totalUsers, totalConversations, totalSubmissions] = await Promise.all([
      prisma.user.count({ where: { isDeleted: false } }),
      prisma.conversation.count(),
      prisma.submission.count(),
    ]);
    adminStats = { totalUsers, totalConversations, totalSubmissions };
  }

  let taStats = null;
  let openAppeals: { id: string; studentName: string; assignmentTitle: string; assignmentId: string; status: string; createdAt: string }[] = [];
  if (isStaff(role)) {
    const [pendingGrading, createdAssignments, openAppealCount, recentAppeals] = await Promise.all([
      prisma.submission.count({
        where: { gradedAt: null, isDraft: false, assignment: { isDeleted: false } },
      }),
      prisma.assignment.count({
        where: { createdById: userId, isDeleted: false },
      }),
      prisma.gradeAppeal.count({
        where: { status: "OPEN", ...APPEAL_ON_LIVE_ASSIGNMENT },
      }),
      prisma.gradeAppeal.findMany({
        where: { status: "OPEN", ...APPEAL_ON_LIVE_ASSIGNMENT },
        include: {
          student: { select: { name: true } },
          submissionAnswer: {
            select: {
              submission: {
                select: {
                  assignment: { select: { id: true, title: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);
    taStats = { pendingGrading, createdAssignments, openAppealCount };
    openAppeals = recentAppeals.map((a) => ({
      id: a.id,
      studentName: a.student.name || "Unknown",
      assignmentTitle: a.submissionAnswer.submission.assignment.title,
      assignmentId: a.submissionAnswer.submission.assignment.id,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  return (
    <DashboardClient
      userName={user.name || "User"}
      userRole={role}
      date={formatDate(new Date())}
      stats={{
        conversationCount,
        questionCount,
        assignmentCount,
        submissionCount,
      }}
      adminStats={adminStats}
      taStats={taStats}
      recentConversations={recentConversations.map((c: { id: string; title: string; updatedAt: Date; messages: { content: string }[] }) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
        lastMessage: stripMarkdown(c.messages[0]?.content || "").slice(0, 80) || "No messages yet",
      }))}
      upcomingAssignments={upcomingAssignments.map((a) => ({
        id: a.id,
        title: a.title,
        dueDate: a.dueDate?.toISOString() || null,
        type: a.type,
      }))}
      openAppeals={openAppeals}
    />
  );
}
