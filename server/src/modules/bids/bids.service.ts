import {
  Prisma, AuditAction, BidStatus, BidEnvelopeType, ProjectStatus,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { logAuditEvent } from '../../middleware/auditLog';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../../utils/errors';
import { sha256 } from '../../utils/hash';
import { VALID_BID_TRANSITIONS } from './bids.validation';
import type {
  RegisterBidInput, UploadEnvelopeInput, OpenEnvelopeInput,
  ChangeBidStatusInput, ListBidsQuery,
} from './bids.validation';

// ============================================================
// Role-vault access matrix (same as DTAO)
// ============================================================
const TECHNICAL_ROLES = ['INITIATOR', 'STRUCTURE_MANAGER'];
const COMMERCIAL_ROLES = ['PROC_OFFICER', 'FINANCE_CONTROLLER', 'DG_APPROVER'];
const FULL_ACCESS_ROLES = ['SYS_ADMIN', 'AUDITOR', 'LEGAL_ADVISOR'];
const CCC_ROLES = ['CCC_PRESIDENT', 'CCC_MEMBER', 'CCC_RAPPORTEUR'];

export function getAllowedVaults(userRoles: string[]): BidEnvelopeType[] {
  if (userRoles.some((r) => FULL_ACCESS_ROLES.includes(r))) {
    return [BidEnvelopeType.TECHNICAL, BidEnvelopeType.COMMERCIAL];
  }
  if (userRoles.some((r) => CCC_ROLES.includes(r))) {
    return [BidEnvelopeType.TECHNICAL, BidEnvelopeType.COMMERCIAL];
  }
  const vaults: BidEnvelopeType[] = [];
  if (userRoles.some((r) => TECHNICAL_ROLES.includes(r))) vaults.push(BidEnvelopeType.TECHNICAL);
  if (userRoles.some((r) => COMMERCIAL_ROLES.includes(r))) vaults.push(BidEnvelopeType.COMMERCIAL);
  return vaults;
}

export function assertVaultAccess(userRoles: string[], vault: BidEnvelopeType) {
  if (!getAllowedVaults(userRoles).includes(vault)) {
    throw new ForbiddenError(
      vault === BidEnvelopeType.TECHNICAL
        ? 'Accès au coffre technique refusé pour votre rôle'
        : 'Accès au coffre commercial refusé pour votre rôle'
    );
  }
}

// ============================================================
// Auto-generate bid reference: BID-{projectRef}-{seq}
// ============================================================
async function generateBidReference(projectRef: string): Promise<string> {
  const prefix = `BID-${projectRef}-`;
  const last = await prisma.bid.findFirst({
    where: { referenceNumber: { startsWith: prefix } },
    orderBy: { referenceNumber: 'desc' },
    select: { referenceNumber: true },
  });
  let seq = 1;
  if (last) {
    const parts = last.referenceNumber.split('-');
    const n = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// ============================================================
// REGISTER BID (reception by courier / procurement desk)
// ============================================================
export async function registerBid(
  input: RegisterBidInput,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: {
      id: true, referenceNumber: true, status: true, bidDeadline: true,
      titleFr: true, minimumBidCount: true,
    },
  });
  if (!project) throw new NotFoundError('Project', input.projectId);

  // Project must be PUBLISHED or already in BID_RECEPTION
  if (
    project.status !== ProjectStatus.PUBLISHED &&
    project.status !== ProjectStatus.BID_RECEPTION
  ) {
    throw new ValidationError(
      `Le projet doit être PUBLISHED ou BID_RECEPTION pour accepter des soumissions (actuel: ${project.status})`
    );
  }

  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();

  // Enforce deadline
  if (project.bidDeadline && receivedAt > project.bidDeadline) {
    throw new ValidationError(
      `La date limite de soumission est dépassée (${project.bidDeadline.toISOString()})`
    );
  }

  // Supplier must exist and not be blacklisted
  const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) throw new NotFoundError('Supplier', input.supplierId);
  if (supplier.isBlacklisted) {
    throw new ForbiddenError(
      `Fournisseur ${supplier.registrationNumber} en liste noire: ${supplier.blacklistReason || 'raison non spécifiée'}`
    );
  }

  // Duplicate check: one bid per supplier per project
  const dup = await prisma.bid.findUnique({
    where: { projectId_supplierId: { projectId: input.projectId, supplierId: input.supplierId } },
  });
  if (dup) {
    throw new ConflictError(
      `Ce fournisseur a déjà soumissionné au projet ${project.referenceNumber} (${dup.referenceNumber})`
    );
  }

  const referenceNumber = await generateBidReference(project.referenceNumber);

  const result = await prisma.$transaction(async (tx) => {
    const bid = await tx.bid.create({
      data: {
        projectId: input.projectId,
        supplierId: input.supplierId,
        referenceNumber,
        status: BidStatus.RECEIVED,
        receivedAt,
        receivedByName: input.receivedByName,
        technicalEnvelopeSealed: true,
        commercialEnvelopeSealed: true,
        hasBidBond: input.hasBidBond ?? false,
        bidBondAmount: input.bidBondAmount ? new Prisma.Decimal(input.bidBondAmount) : null,
        bidBondExpiryDate: input.bidBondExpiryDate ? new Date(input.bidBondExpiryDate) : null,
      },
      include: {
        supplier: { select: { id: true, registrationNumber: true, companyNameFr: true } },
        project: { select: { id: true, referenceNumber: true, titleFr: true } },
      },
    });

    // Cascade project: PUBLISHED → BID_RECEPTION on first bid
    if (project.status === ProjectStatus.PUBLISHED) {
      await tx.project.update({
        where: { id: project.id },
        data: { status: ProjectStatus.BID_RECEPTION },
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: project.id,
          fromStatus: ProjectStatus.PUBLISHED,
          toStatus: ProjectStatus.BID_RECEPTION,
          changedById: userId,
          reason: `Première soumission reçue: ${bid.referenceNumber}`,
        },
      });
    }

    return bid;
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.CREATE,
    resource: 'bid',
    resourceId: result.id,
    description: `Soumission enregistrée ${result.referenceNumber} de ${result.supplier.companyNameFr}`,
    newState: {
      referenceNumber,
      projectId: input.projectId,
      supplierId: input.supplierId,
      status: 'RECEIVED',
    },
    ipAddress,
    userAgent,
  });

  return result;
}

// ============================================================
// UPLOAD SEALED ENVELOPE
// Must happen immediately after registration (status = RECEIVED)
// Content is base64-encoded bytes; server computes SHA-256
// ============================================================
export async function uploadEnvelope(
  bidId: string,
  input: UploadEnvelopeInput,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    include: { envelopes: true },
  });
  if (!bid) throw new NotFoundError('Bid', bidId);

  // Only in RECEIVED state can envelopes be uploaded (no post-open tampering)
  if (bid.status !== BidStatus.RECEIVED) {
    throw new ValidationError(
      `Les enveloppes ne peuvent être téléversées qu'en statut RECEIVED (actuel: ${bid.status})`
    );
  }

  const already = bid.envelopes.find((e) => e.envelopeType === input.envelopeType);
  if (already) {
    throw new ConflictError(
      `Une enveloppe ${input.envelopeType} existe déjà pour cette soumission`
    );
  }

  const buffer = Buffer.from(input.content, 'base64');
  const hash = sha256(buffer);
  const filePath = `/storage/bids/${bid.id}/${input.envelopeType.toLowerCase()}-${hash.slice(0, 12)}`;

  const envelope = await prisma.bidEnvelope.create({
    data: {
      bidId: bid.id,
      envelopeType: input.envelopeType,
      filePath,
      fileName: input.fileName,
      fileSize: buffer.byteLength,
      sha256Hash: hash,
      isSealed: true,
    },
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.DOCUMENT_UPLOAD,
    resource: 'bid_envelope',
    resourceId: envelope.id,
    description: `Enveloppe ${input.envelopeType} téléversée pour ${bid.referenceNumber}`,
    newState: { envelopeType: input.envelopeType, sha256: hash, fileName: input.fileName },
    ipAddress,
    userAgent,
  });

  return envelope;
}

// ============================================================
// OPEN ENVELOPE (requires specific permission + phase rules)
// ============================================================
export async function openEnvelope(
  bidId: string,
  input: OpenEnvelopeInput,
  userId: string,
  userRoles: string[],
  ipAddress?: string,
  userAgent?: string
) {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    include: {
      envelopes: true,
      project: { select: { id: true, status: true, referenceNumber: true } },
    },
  });
  if (!bid) throw new NotFoundError('Bid', bidId);

  if (bid.status === BidStatus.WITHDRAWN) {
    throw new ValidationError('Impossible d\'ouvrir une enveloppe d\'une soumission retirée');
  }

  assertVaultAccess(userRoles, input.envelopeType);

  const envelope = bid.envelopes.find((e) => e.envelopeType === input.envelopeType);
  if (!envelope) {
    throw new NotFoundError(`Envelope ${input.envelopeType}`, bidId);
  }
  if (!envelope.isSealed || envelope.openedAt) {
    throw new ValidationError(`Enveloppe ${input.envelopeType} déjà ouverte`);
  }

  // Technical must be opened before Commercial (firewall rule)
  if (input.envelopeType === BidEnvelopeType.COMMERCIAL) {
    const tech = bid.envelopes.find((e) => e.envelopeType === BidEnvelopeType.TECHNICAL);
    if (!tech || tech.isSealed || !tech.openedAt) {
      throw new ForbiddenError(
        'L\'enveloppe technique doit être ouverte et évaluée avant l\'enveloppe commerciale'
      );
    }
    // Bid must be technically compliant to open commercial
    if (bid.status !== BidStatus.TECHNICALLY_COMPLIANT) {
      throw new ForbiddenError(
        `L'ouverture commerciale requiert un statut TECHNICALLY_COMPLIANT (actuel: ${bid.status})`
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const env = await tx.bidEnvelope.update({
      where: { id: envelope.id },
      data: {
        isSealed: false,
        openedAt: new Date(),
        openedInMeetingId: input.meetingId ?? null,
      },
    });

    // Bid + project state cascade
    if (input.envelopeType === BidEnvelopeType.TECHNICAL) {
      // First technical opening → bid RECEIVED → OPENED
      if (bid.status === BidStatus.RECEIVED) {
        await tx.bid.update({
          where: { id: bid.id },
          data: { status: BidStatus.OPENED, technicalEnvelopeSealed: false },
        });
      } else {
        await tx.bid.update({
          where: { id: bid.id },
          data: { technicalEnvelopeSealed: false },
        });
      }

      // Cascade project: BID_RECEPTION → BID_OPENING on first technical opening
      if (bid.project.status === ProjectStatus.BID_RECEPTION) {
        await tx.project.update({
          where: { id: bid.project.id },
          data: { status: ProjectStatus.BID_OPENING },
        });
        await tx.projectStatusHistory.create({
          data: {
            projectId: bid.project.id,
            fromStatus: ProjectStatus.BID_RECEPTION,
            toStatus: ProjectStatus.BID_OPENING,
            changedById: userId,
            reason: `Première ouverture technique: ${bid.referenceNumber}`,
          },
        });
      }
    } else {
      // Commercial opening
      await tx.bid.update({
        where: { id: bid.id },
        data: {
          commercialEnvelopeSealed: false,
          status: BidStatus.COMMERCIALLY_EVALUATED,
        },
      });
    }

    return env;
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.BID_OPEN,
    resource: 'bid_envelope',
    resourceId: envelope.id,
    description: `Enveloppe ${input.envelopeType} de ${bid.referenceNumber} ouverte`,
    newState: { envelopeType: input.envelopeType, openedAt: new Date() },
    metadata: { meetingId: input.meetingId, witnessNote: input.witnessNote },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ============================================================
// CHANGE BID STATUS (state machine)
// ============================================================
export async function changeBidStatus(
  bidId: string,
  input: ChangeBidStatusInput,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    select: { id: true, status: true, referenceNumber: true, projectId: true },
  });
  if (!bid) throw new NotFoundError('Bid', bidId);

  const target = input.status as BidStatus;
  const allowed = VALID_BID_TRANSITIONS[bid.status];
  if (!allowed || !allowed.includes(target)) {
    throw new ValidationError(
      `Transition invalide: "${bid.status}" → "${target}". Autorisées: ${(allowed || []).join(', ') || 'aucune'}`
    );
  }

  const updated = await prisma.bid.update({
    where: { id: bidId },
    data: { status: target },
    include: {
      supplier: { select: { companyNameFr: true, registrationNumber: true } },
      project: { select: { referenceNumber: true, titleFr: true } },
    },
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.STATUS_CHANGE,
    resource: 'bid',
    resourceId: bidId,
    description: `Statut ${bid.referenceNumber}: ${bid.status} → ${target}`,
    previousState: { status: bid.status },
    newState: { status: target },
    metadata: { reason: input.reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ============================================================
// LIST BIDS (vault-filtered: envelopes only visible if role allowed)
// ============================================================
export async function listBids(query: ListBidsQuery, userRoles: string[]) {
  const { page, limit, projectId, supplierId, status, search, sortBy, sortOrder } = query;

  const where: Prisma.BidWhereInput = {};
  if (projectId) where.projectId = projectId;
  if (supplierId) where.supplierId = supplierId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { referenceNumber: { contains: search, mode: 'insensitive' } },
      { supplier: { companyNameFr: { contains: search, mode: 'insensitive' } } },
      { project: { referenceNumber: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.bid.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        supplier: {
          select: { id: true, registrationNumber: true, companyNameFr: true, isBlacklisted: true },
        },
        project: {
          select: { id: true, referenceNumber: true, titleFr: true, procurementMode: true, status: true },
        },
        _count: { select: { envelopes: true, evaluations: true } },
      },
    }),
    prisma.bid.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    meta: {
      allowedVaults: getAllowedVaults(userRoles),
    },
  };
}

// ============================================================
// GET BID BY ID — returns only envelopes the user can read
// ============================================================
export async function getBidById(id: string, userRoles: string[]) {
  const bid = await prisma.bid.findUnique({
    where: { id },
    include: {
      supplier: true,
      project: {
        select: {
          id: true, referenceNumber: true, titleFr: true, status: true,
          procurementMode: true, bidDeadline: true, estimatedBudget: true,
        },
      },
      envelopes: true,
      evaluations: {
        include: {
          evaluator: { select: { id: true, firstNameFr: true, lastNameFr: true } },
        },
        orderBy: { evaluatedAt: 'desc' },
      },
    },
  });
  if (!bid) throw new NotFoundError('Bid', id);

  const allowedVaults = getAllowedVaults(userRoles);
  const filteredEnvelopes = bid.envelopes.filter((e) => allowedVaults.includes(e.envelopeType));
  const filteredEvaluations = bid.evaluations.filter((e) => allowedVaults.includes(e.envelopeType));

  return {
    ...bid,
    envelopes: filteredEnvelopes,
    evaluations: filteredEvaluations,
    meta: {
      allowedVaults,
      hiddenEnvelopes: bid.envelopes.length - filteredEnvelopes.length,
    },
  };
}

// ============================================================
// GET BIDS FOR A PROJECT (summary for project detail page)
// ============================================================
export async function getBidsByProject(projectId: string, userRoles: string[]) {
  const bids = await prisma.bid.findMany({
    where: { projectId },
    orderBy: { receivedAt: 'asc' },
    include: {
      supplier: { select: { id: true, registrationNumber: true, companyNameFr: true, isBlacklisted: true } },
      _count: { select: { envelopes: true } },
    },
  });

  return {
    data: bids,
    meta: { allowedVaults: getAllowedVaults(userRoles) },
  };
}
