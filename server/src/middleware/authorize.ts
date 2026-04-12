import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { AuditAction } from '@prisma/client';

export interface AuthorizeOptions {
  /** If true, also check user's department matches resource's department */
  departmentScoped?: boolean;
  /** The param name containing the resource's department ID (for department scope check) */
  departmentField?: string;
}

/**
 * Authorization middleware factory.
 * Checks if the authenticated user has the required permission.
 * Supports scoped permissions: if user has `resource:action:own_department`,
 * the middleware will also accept that when checking for `resource:action`.
 */
export function authorize(requiredPermission: string, options?: AuthorizeOptions) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const userPermissions = req.user.permissions;

    // Check exact match first
    if (userPermissions.includes(requiredPermission)) {
      return next();
    }

    // Check scoped variants (e.g., project:read:own_department matches project:read)
    const scopedVariants = userPermissions.filter((p) =>
      p.startsWith(requiredPermission + ':')
    );

    if (scopedVariants.length > 0) {
      // User has a scoped version of this permission
      // For department-scoped permissions, verify department match if option set
      if (options?.departmentScoped) {
        const hasDeptScoped = scopedVariants.some((p) => p.endsWith(':own_department'));
        if (hasDeptScoped) {
          // Department check will be done at the service level
          return next();
        }
      }
      // For assigned-project scoped, check will be done at service level
      return next();
    }

    // Log the permission denial
    logger.warn('Permission denied', {
      userId: req.user.id,
      requiredPermission,
      path: req.path,
      method: req.method,
    });

    // Record audit log for denied access
    try {
      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          action: AuditAction.PERMISSION_DENIED,
          resource: requiredPermission.split(':')[0],
          description: `Permission denied: ${requiredPermission}`,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: { path: req.path, method: req.method },
        },
      });
    } catch {
      // Don't fail the request if audit logging fails
    }

    return next(new ForbiddenError());
  };
}
