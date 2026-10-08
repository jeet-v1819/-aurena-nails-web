/**
 * In-app notification centre.
 */
import "server-only";
import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string | null;
};

/** Creates a notification. Accepts a transaction client so it can join one. */
export async function createNotification(
  input: CreateNotificationInput,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  try {
    return await client.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type ?? "SYSTEM",
        link: input.link ?? null,
      },
    });
  } catch (error) {
    console.error("[notifications] failed to create", error);
    return null;
  }
}

export async function listNotifications(userId: string, options: { page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = options.pageSize ?? 20;

  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { items, total, unread, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function unreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });
  return result.count > 0;
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return result.count;
}

export async function deleteNotification(userId: string, notificationId: string) {
  const result = await prisma.notification.deleteMany({ where: { id: notificationId, userId } });
  return result.count > 0;
}
