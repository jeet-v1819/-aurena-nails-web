/**
 * Contact messages sent from the public contact form (and stored for the admin
 * inbox — nothing is emailed away and forgotten).
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "./audit";
import type { ContactInput } from "@/validators/customer";

export type MessageFilters = {
  search?: string;
  status?: "all" | "read" | "unread";
  page?: number;
  pageSize?: number;
};

export async function createContactMessage(input: ContactInput, userId?: string | null) {
  return prisma.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      mobile: input.mobile,
      subject: input.subject,
      message: input.message,
      userId: userId ?? null,
    },
  });
}

export async function listMessages(filters: MessageFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 15;
  const search = filters.search?.trim();

  const where: Prisma.ContactMessageWhereInput = {
    ...(filters.status === "read" ? { isRead: true } : {}),
    ...(filters.status === "unread" ? { isRead: false } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { mobile: { contains: search } },
            { subject: { contains: search, mode: "insensitive" } },
            { message: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total, unread] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.count({ where: { isRead: false } }),
  ]);

  return { items, total, unread, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function setMessageRead(adminId: string, messageId: string, isRead: boolean) {
  const message = await prisma.contactMessage.update({
    where: { id: messageId },
    data: { isRead, readAt: isRead ? new Date() : null },
  });
  await recordAudit({ actorId: adminId, action: isRead ? "message.read" : "message.unread", entity: "ContactMessage", entityId: messageId });
  return message;
}

export async function deleteMessage(adminId: string, messageId: string) {
  await prisma.contactMessage.delete({ where: { id: messageId } });
  await recordAudit({ actorId: adminId, action: "message.delete", entity: "ContactMessage", entityId: messageId });
}

export async function countUnreadMessages() {
  return prisma.contactMessage.count({ where: { isRead: false } });
}
