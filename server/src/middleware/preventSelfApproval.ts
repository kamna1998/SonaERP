import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { appendAuditEntry } from '../utils/auditChain';
import { AuditAction } from '@prisma/client';

/**
 * Separation-of-Powers gate (Phase 1.2 — Legal Gatekeeper).
 *
 * Enforces Directive E-025/M R4 §12: a Project Manager / Initiator MUST NOT
 * approve, sign, or visa their own procurement file. Different individuals
 * must perform initiation and approval.
 *
 * Scopes covered: project (status transitions), contract (visa chain),
 * avenant (approval), CCC decisions (presiding own meeting).
 */

interface ResourceLookup {
  resource: 'project' | 'contract' | 'avenant' | 'ccc_meeting';
  fetchCreatorIds: (resourceId: string) => Promise<string[]>;
}

const RESOURCE_RESOLVERS: Record<string, ResourceLookup> = {
  project: {
    resource: 'project',
    fetchCreatorIds: async (id) => {
      const p = await prisma.project.findUnique({
        where: { id },
        select: { createdById: true },
      });
      if (!p) throw new NotFoundError('Project not found');
      return [p.createdById];
    },
  },
  contract: {
    resource: 'contract',
    fetchCreatorIds: async (id) => {
      const c = await prisma.contract.findUnique({
        where: { id },
        select: {
          project: { select: { createdById: true } },
        },
      });
      if (!c) throw new NotFoundError('Contract not found');
      return c.project?.createdById ? [c.project.createdById] : [];
    },
  },
  avenant: {
    resource: 'avenant',
    fetchCreatorIds: async (id) => {
      const a = await prisma.avenant.findUnique({
        where: { id },
        select: {
          requestedById: true,
          contract: { select: { project: { select: { createdById: true } } } },
        },
      });
      if (!a) throw new NotFoundError('Avenant not found');
      const ids = new Set<string>();
      if (a.requestedById) ids.add(a.requestedById);
      if (a.contract?.project?.createdById) ids.add(a.contract.project.createdById);
      return Array.from(ids);
    },
  },
  ccc_meeting: {
    resource: 'ccc_meeting',
    fetchCreatorIds: async (id) => {
      const m = await prisma.cCCMeeting.findUnique({
        where: { id },
        select: { project: { select: { createdById: true } } },
      });
      if (!m) throw new NotFoundError('CCC meeting not found');
      return m.project?.createdById ? [m.project.createdById] : [];
    },
  },
};

/**
 * Express middleware factory: blocks the current user if they were the
 * creator/requester of the resource they are now trying to approve.
 *
 * Usage:
 *   router.post('/contracts/:id/status',
 *     authenticate,
 *     authorize(PERMISSIONS.CONTRACT_VISA_LEGAL),
 *     preventSelfApproval('contract'),
 *     controller.transitionStatus);
 *
 * The middleware also writes a COMPLIANCE_BLOCK entry into the hash-chained
 * audit log so attempted self-approvals are forensically recorded.
 */
export function preventSelfApproval(resource: keyof typeof RESOURCE_RESOLVERS) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new ForbiddenError('Authentication required'));
      }

      const resourceId = req.params.id;
      if (!resourceId) {
        return next(new Error(`preventSelfApproval(${resource}): missing :id route param`));
      }

      const resolver = RESOURCE_RESOLVERS[resource];
      const conflictedUserIds = await resolver.fetchCreatorIds(resourceId);

      if (conflictedUserIds.includes(req.user.id)) {
        // Forensic audit entry — sealed in the hash chain
        await appendAuditEntry({
          actorId: req.user.id,
          action: AuditAction.COMPLIANCE_BLOCK,
          resource,
          resourceId,
          description: `Self-approval blocked: actor was creator/requester of this ${resource}`,
          justification: 'Directive E-025/M R4 §12 — Separation of Powers',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            attemptedRoute: req.originalUrl,
            attemptedMethod: req.method,
            conflictedRole: 'creator_or_requester',
          },
        });

        return next(
          new ForbiddenError(
            'COMPLIANCE_ERROR: Vous ne pouvez pas approuver / viser un dossier ' +
              'que vous avez initié vous-même (Séparation des pouvoirs — Directive E-025/M R4).',
          ),
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
