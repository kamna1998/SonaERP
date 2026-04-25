import { prisma } from '../../config/database';
import { AuditAction } from '@prisma/client';

export interface AuditQuery {
  page?: number;
  limit?: number;
  actorId?: string;
  action?: AuditAction;
  resource?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
}

export async function queryAuditLogs(query: AuditQuery) {
  const { page = 1, limit = 50, actorId, action, resource, resourceId, startDate, endDate } = query;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (actorId) where.actorId = actorId;
  if (action) where.action = action;
  if (resource) where.resource = resource;
  if (resourceId) where.resourceId = resourceId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { id: true, email: true, firstNameFr: true, lastNameFr: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getMyActivity(userId: string, page = 1, limit = 50) {
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { actorId: userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where: { actorId: userId } }),
  ]);

  return {
    data: logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getResourceAuditTrail(resource: string, resourceId: string) {
  return prisma.auditLog.findMany({
    where: { resource, resourceId },
    orderBy: { createdAt: 'desc' },
    include: {
      actor: {
        select: { id: true, email: true, firstNameFr: true, lastNameFr: true },
      },
    },
  });
}
