import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ValidationError, ComplianceError } from '../utils/errors';
import { appendAuditEntry } from '../utils/auditChain';
import { AuditAction, DocumentRequirementType } from '@prisma/client';

/**
 * NO-BYPASS Workflow Gate (Phase 1.1 — Legal Gatekeeper).
 *
 * Before allowing a status transition, this middleware verifies that ALL
 * mandatory ComplianceDocuments declared in `document_requirements` for the
 * (resource, fromStatus → toStatus) tuple have been uploaded for this
 * specific resource instance.
 *
 * If any document is missing, returns 400 with code `COMPLIANCE_ERROR`,
 * lists the missing types, and writes a forensic entry to the hash-chained
 * audit log.
 *
 * The middleware reads the *current* status of the resource directly from the
 * DB (not from the request body) so it cannot be spoofed.
 */

interface ResourceStatusFetcher {
  getCurrentStatus: (id: string) => Promise<string>;
}

const FETCHERS: Record<string, ResourceStatusFetcher> = {
  project: {
    getCurrentStatus: async (id) => {
      const p = await prisma.project.findUnique({ where: { id }, select: { status: true } });
      if (!p) throw new ValidationError('Project not found');
      return p.status;
    },
  },
  contract: {
    getCurrentStatus: async (id) => {
      const c = await prisma.contract.findUnique({ where: { id }, select: { status: true } });
      if (!c) throw new ValidationError('Contract not found');
      return c.status;
    },
  },
  avenant: {
    getCurrentStatus: async (id) => {
      const a = await prisma.avenant.findUnique({ where: { id }, select: { status: true } });
      if (!a) throw new ValidationError('Avenant not found');
      return a.status;
    },
  },
  ccc_meeting: {
    getCurrentStatus: async (id) => {
      const m = await prisma.cCCMeeting.findUnique({
        where: { id },
        select: { startedAt: true, endedAt: true, decision: true },
      });
      if (!m) throw new ValidationError('CCC meeting not found');
      if (m.endedAt) return 'CLOSED';
      if (m.startedAt) return 'IN_SESSION';
      return 'SCHEDULED';
    },
  },
};

/**
 * Express middleware factory. Reads `req.body.status` as the *target* status,
 * looks up the *current* status from DB, then enforces all mandatory documents
 * declared for that transition.
 */
export function requireDocument(resource: keyof typeof FETCHERS) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const resourceId = req.params.id;
      if (!resourceId) {
        return next(new Error(`requireDocument(${resource}): missing :id route param`));
      }
      const targetStatus: string | undefined = req.body?.status;
      if (!targetStatus) {
        // No status field in body → no transition; allow through (other middleware will validate)
        return next();
      }

      const fetcher = FETCHERS[resource];
      const currentStatus = await fetcher.getCurrentStatus(resourceId);

      const requirements = await prisma.documentRequirement.findMany({
        where: {
          resource,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          isMandatory: true,
        },
      });

      if (requirements.length === 0) {
        return next(); // Nothing required for this transition
      }

      const uploadedDocs = await prisma.complianceDocument.findMany({
        where: {
          resource,
          resourceId,
          requiredType: { in: requirements.map((r) => r.requiredType) },
        },
        select: { requiredType: true, sha256Hash: true },
      });

      const uploadedTypes = new Set(uploadedDocs.map((d) => d.requiredType));
      const missing = requirements.filter((r) => !uploadedTypes.has(r.requiredType));

      if (missing.length > 0) {
        // Forensic record — every blocked attempt is sealed in the audit chain
        await appendAuditEntry({
          actorId: req.user?.id,
          action: AuditAction.COMPLIANCE_BLOCK,
          resource,
          resourceId,
          description: `COMPLIANCE_ERROR: ${missing.length} mandatory document(s) missing for transition ${currentStatus} → ${targetStatus}`,
          justification: missing
            .map((m) => `${m.requiredType} (${m.legalReference ?? 'Directive E-025/M R4'})`)
            .join('; '),
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            currentStatus,
            targetStatus,
            missingDocuments: missing.map((m) => ({
              type: m.requiredType,
              descriptionFr: m.descriptionFr,
              legalReference: m.legalReference,
            })),
          },
        });

        return next(
          new ComplianceError(
            `Documents obligatoires manquants pour la transition ${currentStatus} → ${targetStatus}: ` +
              missing.map((m) => `${m.requiredType} (${m.descriptionFr})`).join(', '),
            missing.map((m) => ({
              type: m.requiredType,
              descriptionFr: m.descriptionFr,
              legalReference: m.legalReference ?? undefined,
            })),
          ),
        );
      }

      // All required docs present — attach hashes to req for downstream audit/sealing
      (req as any).complianceDocumentHashes = uploadedDocs.map((d) => d.sha256Hash);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Helper: list all currently uploaded compliance docs for a resource instance.
 * Used by services that need to embed document hashes in PDFs, audit logs, etc.
 */
export async function getComplianceDocuments(
  resource: string,
  resourceId: string,
  type?: DocumentRequirementType,
) {
  return prisma.complianceDocument.findMany({
    where: {
      resource,
      resourceId,
      ...(type ? { requiredType: type } : {}),
    },
    orderBy: { uploadedAt: 'desc' },
  });
}
