import { Prisma, AvenantStatus, AuditAction } from '@prisma/client';
import { prisma } from '../../config/database';
import { logAuditEvent } from '../../middleware/auditLog';
import {
  NotFoundError,
  ValidationError,
} from '../../utils/errors';
import { sha256 } from '../../utils/hash';
import { LEGAL_CUMULATIVE_THRESHOLD_PCT } from './contracts.validation';
import type {
  CreateAvenantInput,
  UpdateAvenantInput,
  TransitionAvenantStatusInput,
  ListAvenantsQuery,
} from './contracts.validation';

// ============================================================
// Status transition map
// ============================================================

const VALID_AVENANT_TRANSITIONS: Record<AvenantStatus, AvenantStatus[]> = {
  DRAFT: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['PENDING_CCC_APPROVAL', 'PENDING_LEGAL_VISA', 'DRAFT'],
  PENDING_CCC_APPROVAL: ['PENDING_LEGAL_VISA', 'REJECTED'],
  PENDING_LEGAL_VISA: ['PENDING_FINANCIAL_VISA'],
  PENDING_FINANCIAL_VISA: ['APPROVED', 'REJECTED'],
  APPROVED: ['SIGNED'],
  SIGNED: [],
  REJECTED: ['DRAFT'],
};

// Statuses that "count" toward cumulative delta (signed or approved avenants)
const COMMITTED_STATUSES: AvenantStatus[] = ['SIGNED', 'APPROVED'];

// ============================================================
// Cumulative delta calculation (core algorithm)
// ============================================================

/**
 * Computes cumulative avenant delta percentage for a contract.
 *
 * Formula:
 *   cumulative_delta_pct = (sum(signed_avenants.differenceAmount) + new_difference) / contract.totalAmount * 100
 *
 * Returns the absolute value — Directive E-025/M R4 treats both positive
 * (scope increase) and negative (reduction) cumulations equally.
 */
function computeCumulativeDelta(
  contractTotalAmount: Prisma.Decimal,
  existingAvenants: Array<{ differenceAmount: Prisma.Decimal; id: string }>,
  newDifferenceAmount: Prisma.Decimal,
  excludeAvenantId?: string
): { cumulativePct: Prisma.Decimal; cumulativeSum: Prisma.Decimal } {
  let cumulativeSum = new Prisma.Decimal(0);

  for (const a of existingAvenants) {
    // Exclude the avenant being updated (if recalculating)
    if (excludeAvenantId && a.id === excludeAvenantId) continue;
    cumulativeSum = cumulativeSum.add(a.differenceAmount);
  }

  cumulativeSum = cumulativeSum.add(newDifferenceAmount);

  // Use absolute value for threshold comparison
  const absCumulativeSum = cumulativeSum.abs();
  const cumulativePct = contractTotalAmount.isZero()
    ? new Prisma.Decimal(0)
    : absCumulativeSum.div(contractTotalAmount).mul(100);

  return { cumulativePct, cumulativeSum };
}

// ============================================================
// Create avenant
// ============================================================

export async function createAvenant(
  data: CreateAvenantInput,
  actorId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const contract = await prisma.contract.findUnique({
    where: { id: data.contractId },
    include: {
      avenants: {
        where: { status: { in: COMMITTED_STATUSES } },
        select: { id: true, differenceAmount: true },
      },
      project: {
        select: { id: true, referenceNumber: true },
      },
    },
  });

  if (!contract) throw new NotFoundError('Contract', data.contractId);

  // Contract must be active (SIGNED or IN_EXECUTION)
  const activeStatuses = ['SIGNED', 'IN_EXECUTION'];
  if (!activeStatuses.includes(contract.status)) {
    throw new ValidationError(
      `Le contrat doit etre en statut SIGNED ou IN_EXECUTION (actuel: ${contract.status})`
    );
  }

  // Compute difference amount (avenant delta)
  const amendedAmount = new Prisma.Decimal(data.amendedAmount.toFixed(2));
  const differenceAmount = amendedAmount.sub(contract.totalAmount);

  // Compute cumulative delta
  const { cumulativePct } = computeCumulativeDelta(
    contract.totalAmount,
    contract.avenants,
    differenceAmount
  );

  // Hard-block if cumulative delta exceeds legal threshold
  if (cumulativePct.greaterThan(LEGAL_CUMULATIVE_THRESHOLD_PCT)) {
    throw new ValidationError(
      `Le cumul des avenants (${cumulativePct.toFixed(2)}%) depasse le seuil legal de ${LEGAL_CUMULATIVE_THRESHOLD_PCT}%. ` +
      `L'avenant ne peut pas etre cree. Un nouveau marche est requis.`,
      {
        cumulativePct: [`${cumulativePct.toFixed(2)}% > ${LEGAL_CUMULATIVE_THRESHOLD_PCT}%`],
      }
    );
  }

  // Auto-generate avenant number
  const existingCount = await prisma.avenant.count({
    where: { contractId: data.contractId },
  });
  const avenantNumber = existingCount + 1;
  const referenceNumber = `AVN-${contract.referenceNumber}-${String(avenantNumber).padStart(2, '0')}`;

  // Determine if this avenant is near threshold (> threshold * 0.8)
  const warningThreshold = LEGAL_CUMULATIVE_THRESHOLD_PCT * 0.8;
  const exceedsThreshold = cumulativePct.greaterThan(warningThreshold);

  const avenant = await prisma.avenant.create({
    data: {
      contractId: data.contractId,
      avenantNumber,
      referenceNumber,
      type: data.type,
      titleFr: data.titleFr,
      justification: data.justification,
      originalAmount: contract.totalAmount,
      amendedAmount,
      differenceAmount,
      cumulativeAvenantPct: new Prisma.Decimal(cumulativePct.toFixed(2)),
      exceedsThreshold,
      thresholdPct: new Prisma.Decimal(LEGAL_CUMULATIVE_THRESHOLD_PCT),
      requiresNewTender: false,
      originalEndDate: contract.expiryDate,
      newEndDate: data.newEndDate ? new Date(data.newEndDate) : null,
      requestedById: actorId,
    },
    include: {
      contract: {
        select: { id: true, referenceNumber: true, titleFr: true },
      },
    },
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.CREATE,
    resource: 'avenant',
    resourceId: avenant.id,
    description: `Avenant ${referenceNumber} cree (delta: ${differenceAmount.toFixed(2)} DZD, cumul: ${cumulativePct.toFixed(2)}%)`,
    newState: {
      referenceNumber,
      type: data.type,
      differenceAmount: differenceAmount.toString(),
      cumulativePct: cumulativePct.toFixed(2),
    },
    ipAddress,
    userAgent,
  });

  // Log threshold warning if close
  if (exceedsThreshold) {
    await logAuditEvent({
      actorId,
      action: AuditAction.THRESHOLD_EXCEEDED,
      resource: 'avenant',
      resourceId: avenant.id,
      description: `Seuil cumule avenants a ${cumulativePct.toFixed(2)}% (seuil: ${LEGAL_CUMULATIVE_THRESHOLD_PCT}%)`,
      metadata: { cumulativePct: cumulativePct.toFixed(2), threshold: LEGAL_CUMULATIVE_THRESHOLD_PCT },
      ipAddress,
      userAgent,
    });
  }

  return avenant;
}

// ============================================================
// List avenants
// ============================================================

export async function listAvenants(query: ListAvenantsQuery) {
  const where: Prisma.AvenantWhereInput = {};

  if (query.contractId) where.contractId = query.contractId;
  if (query.type) where.type = query.type as any;
  if (query.status) where.status = query.status as AvenantStatus;

  const [avenants, total] = await Promise.all([
    prisma.avenant.findMany({
      where,
      include: {
        contract: {
          select: { id: true, referenceNumber: true, titleFr: true, totalAmount: true },
        },
      },
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.avenant.count({ where }),
  ]);

  return {
    data: avenants,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

// ============================================================
// Get avenant by ID
// ============================================================

export async function getAvenantById(id: string) {
  const avenant = await prisma.avenant.findUnique({
    where: { id },
    include: {
      contract: {
        select: {
          id: true,
          referenceNumber: true,
          titleFr: true,
          totalAmount: true,
          status: true,
          supplierId: true,
          projectId: true,
          project: {
            select: { id: true, referenceNumber: true, titleFr: true },
          },
        },
      },
    },
  });

  if (!avenant) throw new NotFoundError('Avenant', id);
  return avenant;
}

// ============================================================
// Update avenant (DRAFT only)
// ============================================================

export async function updateAvenant(
  id: string,
  data: UpdateAvenantInput,
  actorId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const avenant = await prisma.avenant.findUnique({
    where: { id },
    include: {
      contract: {
        include: {
          avenants: {
            where: { status: { in: COMMITTED_STATUSES } },
            select: { id: true, differenceAmount: true },
          },
        },
      },
    },
  });

  if (!avenant) throw new NotFoundError('Avenant', id);
  if (avenant.status !== 'DRAFT') {
    throw new ValidationError("L'avenant ne peut etre modifie qu'en statut DRAFT");
  }

  const updateData: Prisma.AvenantUpdateInput = {};
  if (data.titleFr) updateData.titleFr = data.titleFr;
  if (data.justification) updateData.justification = data.justification;
  if (data.newEndDate) updateData.newEndDate = new Date(data.newEndDate);

  // Recalculate delta if amendedAmount changed
  if (data.amendedAmount != null) {
    const amendedAmount = new Prisma.Decimal(data.amendedAmount.toFixed(2));
    const differenceAmount = amendedAmount.sub(avenant.contract.totalAmount);
    const { cumulativePct } = computeCumulativeDelta(
      avenant.contract.totalAmount,
      avenant.contract.avenants,
      differenceAmount,
      avenant.id // exclude self from existing sum
    );

    if (cumulativePct.greaterThan(LEGAL_CUMULATIVE_THRESHOLD_PCT)) {
      throw new ValidationError(
        `Le cumul des avenants (${cumulativePct.toFixed(2)}%) depasse le seuil legal de ${LEGAL_CUMULATIVE_THRESHOLD_PCT}%.`
      );
    }

    updateData.amendedAmount = amendedAmount;
    updateData.differenceAmount = differenceAmount;
    updateData.cumulativeAvenantPct = new Prisma.Decimal(cumulativePct.toFixed(2));
    updateData.exceedsThreshold = cumulativePct.greaterThan(LEGAL_CUMULATIVE_THRESHOLD_PCT * 0.8);
  }

  const updated = await prisma.avenant.update({
    where: { id },
    data: updateData,
    include: {
      contract: {
        select: { id: true, referenceNumber: true, titleFr: true },
      },
    },
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.UPDATE,
    resource: 'avenant',
    resourceId: id,
    description: `Avenant ${avenant.referenceNumber} modifie`,
    previousState: { titleFr: avenant.titleFr, amendedAmount: avenant.amendedAmount.toString() },
    newState: data,
    ipAddress,
    userAgent,
  });

  return updated;
}

// ============================================================
// Transition avenant status
// ============================================================

export async function transitionAvenantStatus(
  id: string,
  data: TransitionAvenantStatusInput,
  actorId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const avenant = await prisma.avenant.findUnique({
    where: { id },
    include: {
      contract: { select: { id: true, referenceNumber: true, totalAmount: true } },
    },
  });

  if (!avenant) throw new NotFoundError('Avenant', id);

  const allowed = VALID_AVENANT_TRANSITIONS[avenant.status] || [];
  if (!allowed.includes(data.status as AvenantStatus)) {
    throw new ValidationError(
      `Transition de ${avenant.status} vers ${data.status} non autorisee`
    );
  }

  const updateData: Prisma.AvenantUpdateInput = {
    status: data.status as AvenantStatus,
  };

  // Record visa/approval timestamps
  if (data.status === 'PENDING_FINANCIAL_VISA' && avenant.status === 'PENDING_LEGAL_VISA') {
    updateData.legalVisaAt = new Date();
  }
  if (data.status === 'APPROVED' && avenant.status === 'PENDING_FINANCIAL_VISA') {
    updateData.financialVisaAt = new Date();
    updateData.approvedById = actorId;
    updateData.approvedAt = new Date();
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.avenant.update({
      where: { id },
      data: updateData,
      include: {
        contract: { select: { id: true, referenceNumber: true, totalAmount: true } },
      },
    });

    // On SIGNED: update contract totalAmount
    if (data.status === 'SIGNED') {
      await tx.contract.update({
        where: { id: avenant.contractId },
        data: {
          totalAmount: avenant.amendedAmount,
          expiryDate: avenant.newEndDate || undefined,
        },
      });
    }

    return result;
  });

  await logAuditEvent({
    actorId,
    action: data.status === 'APPROVED' ? AuditAction.AVENANT_APPROVE : AuditAction.STATUS_CHANGE,
    resource: 'avenant',
    resourceId: id,
    description: `Avenant ${avenant.referenceNumber}: ${avenant.status} -> ${data.status}`,
    previousState: { status: avenant.status },
    newState: { status: data.status, reason: data.reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ============================================================
// Seal avenant document
// ============================================================

export async function sealAvenant(
  id: string,
  fileContent: string,
  actorId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const avenant = await prisma.avenant.findUnique({
    where: { id },
    include: { contract: { select: { referenceNumber: true } } },
  });
  if (!avenant) throw new NotFoundError('Avenant', id);

  const hash = sha256(fileContent, 'utf8');
  const filePath = `avenants/${avenant.referenceNumber}/avenant-${Date.now()}.pdf`;

  const updated = await prisma.avenant.update({
    where: { id },
    data: { filePath, sha256Hash: hash },
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.DOCUMENT_UPLOAD,
    resource: 'avenant',
    resourceId: id,
    description: `Document avenant ${avenant.referenceNumber} scelle (SHA-256)`,
    newState: { sha256Hash: hash, filePath },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ============================================================
// Get cumulative delta info for a contract (for the gauge)
// ============================================================

export async function getCumulativeDelta(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      avenants: {
        where: { status: { in: COMMITTED_STATUSES } },
        select: { id: true, differenceAmount: true, avenantNumber: true, referenceNumber: true },
        orderBy: { avenantNumber: 'asc' },
      },
    },
  });

  if (!contract) throw new NotFoundError('Contract', contractId);

  let cumulativeSum = new Prisma.Decimal(0);
  const breakdown: Array<{
    avenantNumber: number;
    referenceNumber: string;
    delta: string;
    runningTotal: string;
    runningPct: string;
  }> = [];

  for (const a of contract.avenants) {
    cumulativeSum = cumulativeSum.add(a.differenceAmount);
    const pct = contract.totalAmount.isZero()
      ? new Prisma.Decimal(0)
      : cumulativeSum.abs().div(contract.totalAmount).mul(100);

    breakdown.push({
      avenantNumber: a.avenantNumber,
      referenceNumber: a.referenceNumber,
      delta: a.differenceAmount.toString(),
      runningTotal: cumulativeSum.toString(),
      runningPct: pct.toFixed(2),
    });
  }

  const currentPct = contract.totalAmount.isZero()
    ? '0.00'
    : cumulativeSum.abs().div(contract.totalAmount).mul(100).toFixed(2);

  return {
    contractId,
    contractReferenceNumber: contract.referenceNumber,
    originalAmount: contract.totalAmount.toString(),
    cumulativeDelta: cumulativeSum.toString(),
    cumulativePct: currentPct,
    thresholdPct: LEGAL_CUMULATIVE_THRESHOLD_PCT,
    remainingHeadroom: new Prisma.Decimal(LEGAL_CUMULATIVE_THRESHOLD_PCT)
      .sub(new Prisma.Decimal(currentPct))
      .toFixed(2),
    breakdown,
  };
}
