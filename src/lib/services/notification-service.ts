import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/constants";
import { paginatedResponse, type PaginationParams } from "@/lib/pagination";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdByName: string | null;
  createdAt: string;
  isRead: boolean;
  audienceRoles: Role[];
}

export interface ScheduledNotificationItem extends Omit<NotificationItem, "audienceRoles"> {
  isScheduled: boolean;
  scheduledAt: string;
  hasEmail: boolean;
}

/**
 * A notification with no `audienceRoles` is visible to everyone; otherwise only
 * the listed roles may read it.
 */
export function audienceWhere(role: Role): Prisma.NotificationWhereInput {
  return {
    OR: [{ audienceRoles: { isEmpty: true } }, { audienceRoles: { has: role } }],
  };
}

export async function createAnnouncement(input: {
  title: string;
  message: string;
  createdById: string;
  audienceRoles: Role[];
}) {
  return prisma.notification.create({ data: input });
}

export async function isInAudience(
  notificationId: string,
  role: Role
): Promise<boolean> {
  const match = await prisma.notification.findFirst({
    where: { AND: [{ id: notificationId }, audienceWhere(role)] },
    select: { id: true },
  });
  return match !== null;
}

async function listScheduledAssignments(): Promise<ScheduledNotificationItem[]> {
  const assignments = await prisma.assignment.findMany({
    where: { published: false, scheduledPublishAt: { not: null }, isDeleted: false },
    orderBy: { scheduledPublishAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      scheduledPublishAt: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      scheduledEmails: { where: { status: "PENDING" }, select: { id: true } },
    },
  });

  return assignments.map((a) => ({
    id: `scheduled-assignment-${a.id}`,
    title: `📅 ${a.title}`,
    message: a.description || "Assignment scheduled for publishing",
    createdByName: a.createdBy.name,
    createdAt: a.createdAt.toISOString(),
    isRead: true,
    isScheduled: true,
    scheduledAt: a.scheduledPublishAt!.toISOString(),
    hasEmail: a.scheduledEmails.length > 0,
  }));
}

export async function listNotificationsForUser(
  user: { id: string; role: Role },
  params: PaginationParams
) {
  const where = audienceWhere(user.role);

  const [totalCount, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      take: params.pageSize,
      skip: params.skip,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        reads: { where: { userId: user.id }, select: { id: true } },
      },
    }),
  ]);

  const mapped: NotificationItem[] = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    createdByName: n.createdBy.name,
    createdAt: n.createdAt.toISOString(),
    isRead: n.reads.length > 0,
    audienceRoles: n.audienceRoles,
  }));

  return {
    ...paginatedResponse(mapped, totalCount, params),
    unreadCount: mapped.filter((n) => !n.isRead).length,
    scheduledItems: isStaff(user.role) ? await listScheduledAssignments() : [],
  };
}

export async function markAllReadForUser(user: { id: string; role: Role }) {
  const unread = await prisma.notification.findMany({
    where: { AND: [audienceWhere(user.role), { reads: { none: { userId: user.id } } }] },
    select: { id: true },
  });

  if (unread.length === 0) return;

  await prisma.notificationRead.createMany({
    data: unread.map((n) => ({ notificationId: n.id, userId: user.id })),
    skipDuplicates: true,
  });
}
