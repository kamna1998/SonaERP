import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';
import { appendAuditEntry } from '../utils/auditChain';
import { AuditAction } from '@prisma/client';

/**
 * Identity Isolation Gate (Phase 4.1 — User & Security Refactor).
 *
 * Sonatrach internal control rule: a System Administrator (SYS_ADMIN) MAY
 * grant roles, manage users, configure the platform — but MAY NOT take
 * operational procurement actions (create projects, evaluate bids, sign
 * contracts, etc.). This prevents the privileged-user-as-actor anti-pattern
 * where the same identity controls both who participates AND the participation.
 *
 * Enforcement uses two signals:
 *   1. The `User.canParticipateInProcurement` flag (DB-level switch)
 *   2. The hard-coded SYS_ADMIN role exclusion
 *
 * Mount on every procurement-mutation route (projects, bids, contracts, CCC).
 * Read endpoints are NOT gated — admins can audit, just not act.
 */
export function preventAdminProcurement() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ForbiddenError('Authentication required'));

    const isAdmin = req.user.roles.includes('SYS_ADMIN');
    const cannotParticipate = req.user.canParticipateInProcurement === false;

    if (isAdmin || cannotParticipate) {
      await appendAuditEntry({
        actorId: req.user.id,
        action: AuditAction.COMPLIANCE_BLOCK,
        resource: 'procurement',
        description: 'Admin/non-participant attempted procurement action',
        justification:
          'Identity Isolation: SYS_ADMIN and flagged users cannot participate in procurement workflows (Sonatrach Internal Control §4.1).',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          attemptedRoute: req.originalUrl,
          attemptedMethod: req.method,
          isAdmin,
          cannotParticipate,
        },
      });

      return next(
        new ForbiddenError(
          'COMPLIANCE_ERROR: Les administrateurs système ne peuvent pas participer ' +
            'aux opérations de passation des marchés (Séparation Identité/Action).',
        ),
      );
    }

    next();
  };
}
