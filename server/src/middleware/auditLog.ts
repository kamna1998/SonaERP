import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuditAction } from '@prisma/client';
import { logger } from '../utils/logger';

const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PATCH: AuditAction.UPDATE,
  PUT: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
  GET: AuditAction.READ,
};

/**
 * Automatic audit logging middleware.
 * Logs all mutating API calls (POST, PATCH, PUT, DELETE).
 * GET requests are not logged automatically to avoid noise.
 */
export function auditLog(resource: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only audit mutating operations
    if (req.method === 'GET') return next();

    const action = METHOD_TO_ACTION[req.method] || AuditAction.UPDATE;
    const startTime = Date.now();

    res.on('finish', () => {
      // Only log successful operations (2xx status)
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      const resourceId = req.params.id || req.params.userId || undefined;

      prisma.auditLog
        .create({
          data: {
            actorId: req.user?.id || null,
            action,
            resource,
            resourceId,
            description: `${req.method} ${req.originalUrl}`,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            metadata: {
              statusCode: res.statusCode,
              durationMs: Date.now() - startTime,
            },
          },
        })
        .catch((err) => {
          logger.error('Failed to write audit log', { error: err.message });
        });
    });

    next();
  };
}

/**
 * Explicit audit logging service for use in business logic.
 */
export async function logAuditEvent(params: {
  actorId?: string | null;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  description?: string;
  previousState?: any;
  newState?: any;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId || null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        description: params.description,
        previousState: params.previousState,
        newState: params.newState,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: params.metadata,
      },
    });
  } catch (err: any) {
    logger.error('Failed to write explicit audit log', { error: err.message });
  }
}
