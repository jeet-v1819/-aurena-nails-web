/**
 * Audit trail.
 *
 * Moderation actions (hiding a review, deactivating a customer, changing an
 * appointment decision) are recorded so customer-authored content is never
 * changed without a trace.
 */
import "server-only";
import { prisma } from "@/lib/db/prisma";

export type AuditInput = {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

export async function recordAudit({ actorId, action, entity, entityId, changes, ipAddress }: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        changes: changes ? JSON.stringify(changes) : null,
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (error) {
    // Auditing must never break the user-facing operation.
    console.error("[audit] failed to record entry", error);
  }
}

export async function listAuditEntries(options: { entity?: string; entityId?: string; take?: number } = {}) {
  return prisma.auditLog.findMany({
    where: {
      ...(options.entity ? { entity: options.entity } : {}),
      ...(options.entityId ? { entityId: options.entityId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 50,
    include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}
