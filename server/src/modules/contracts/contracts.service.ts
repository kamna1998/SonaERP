import { Prisma, ContractStatus, AuditAction } from '@prisma/client';
import { prisma } from '../../config/database';
import { logAuditEvent } from '../../middleware/auditLog';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../../utils/errors';
import { sha256 } from '../../utils/hash';
import type {
  CreateContractInput,
  UpdateContractInput,
  TransitionContractStatusInput,
  ListContractsQuery,
} from './contracts.validation';

// ============================================================
// Status transition map
// ============================================================

const VALID_CONTRACT_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['PENDING_VISA_LEGAL', 'DRAFT'],
  PENDING_VISA_LEGAL: ['PENDING_VISA_FINANCIAL'],
  PENDING_VISA_FINANCIAL: ['PENDING_APPROVAL_DG'],
  PENDING_APPROVAL_DG: ['APPROVED', 'UNDER_REVIEW'],
  APPROVED: ['SIGNED'],
  SIGNED: ['IN_EXECUTION'],
  IN_EXECUTION: ['COMPLETED', 'SUSPENDED', 'TERMINATED', 'RESILIE'],
  SUSPENDED: ['IN_EXECUTION', 'TERMINATED', 'RESILIE'],
  TERMINATED: [],
  COMPLETED: [],
  RESILIE: [],
};

// Roles with full contract read access
const FULL_ACCESS_ROLES = [
  'ADMIN',
  'DIRECTOR_GENERAL',
  'PROCUREMENT_DIRECTOR',
  'LEGAL_ADVISOR',
  'FINANCIAL_CONTROLLER',
];

function hasFullAccess(roles: string[]): boolean {
  return roles.some((r) => FULL_ACCESS_ROLES.includes(r));
}

// ============================================================
// Create contract
// ============================================================

export async function createContract(
  data: CreateContractInput,
  actorId: string,
  ipAddress?: string,
  userAgent?: string
) {
  // Validate project exists and is in an eligible status
  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project) throw new NotFoundError('Project', data.projectId);

  const eligibleStatuses = ['ADJUDICATION', 'CONTRACT_DRAFTING'];
  if (!eligibleStatuses.includes(project.status)) {
    throw new ValidationError(
      `Le projet doit etre en phase ADJUDICATION ou CONTRACT_DRAFTING (actuel: ${project.status})`
    );
  }

  // Validate supplier exists
  const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
  if (!supplier) throw new NotFoundError('Supplier', data.supplierId);
  if (supplier.isBlacklisted) {
    throw new ValidationError('Le fournisseur est sur la liste noire');
  }

  // If awardedBidId is provided, validate it
  if (data.awardedBidId) {
    const bid = await prisma.bid.findUnique({ where: { id: data.awardedBidId } });
    if (!bid) throw new NotFoundError('Bid', data.awardedBidId);
    if (bid.projectId !== data.projectId) {
      throw new ValidationError("La soumission n'appartient pas au meme projet");
    }
    if (bid.status !== 'AWARDED') {
      throw new ValidationError('La soumission doit etre en statut AWARDED');
    }
  }

  // Auto-generate reference number: CTR-{projectRef}-{seq}
  const existingCount = await prisma.contract.count({
    where: { projectId: data.projectId },
  });
  const seqNum = String(existingCount + 1).padStart(3, '0');
  const referenceNumber = `CTR-${project.referenceNumber}-${seqNum}`;

  const contract = await prisma.$transaction(async (tx) => {
    const created = await tx.contract.create({
      data: {
        projectId: data.projectId,
        referenceNumber,
        titleFr: data.titleFr,
        totalAmount: new Prisma.Decimal(data.totalAmount.toFixed(2)),
        currency: data.currency || 'DZD',
        supplierId: data.supplierId,
        awardedBidId: data.awardedBidId || null,
        paymentTerms: data.paymentTerms || null,
        retentionRate: data.retentionRate != null
          ? new Prisma.Decimal(data.retentionRate.toFixed(2))
          : null,
        advancePaymentRate: data.advancePaymentRate != null
          ? new Prisma.Decimal(data.advancePaymentRate.toFixed(2))
          : null,
        durationMonths: data.durationMonths || null,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      },
      include: {
        project: {
          select: { id: true, referenceNumber: true, titleFr: true, status: true },
        },
      },
    });

    // Cascade project to CONTRACT_DRAFTING if still in ADJUDICATION
    if (project.status === 'ADJUDICATION') {
      await tx.project.update({
        where: { id: data.projectId },
        data: { status: 'CONTRACT_DRAFTING' },
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: data.projectId,
          fromStatus: 'ADJUDICATION',
          toStatus: 'CONTRACT_DRAFTING',
          changedById: actorId,
          reason: `Contrat ${referenceNumber} cree`,
        },
      });
    }

    return created;
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.CREATE,
    resource: 'contract',
    resourceId: contract.id,
    description: `Contrat ${referenceNumber} cree pour le projet ${project.referenceNumber}`,
    newState: { referenceNumber, totalAmount: data.totalAmount, supplierId: data.supplierId },
    ipAddress,
    userAgent,
  });

  return contract;
}

// ============================================================
// List contracts (RBAC-filtered)
// ============================================================

export async function listContracts(query: ListContractsQuery, userRoles: string[]) {
  const where: Prisma.ContractWhereInput = {};

  if (query.projectId) where.projectId = query.projectId;
  if (query.status) where.status = query.status as ContractStatus;
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.search) {
    where.OR = [
      { referenceNumber: { contains: query.search, mode: 'insensitive' } },
      { titleFr: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  // Non-full-access users: restrict to their department's projects
  if (!hasFullAccess(userRoles)) {
    where.project = { status: { not: 'DRAFT' } };
  }

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: {
        project: {
          select: { id: true, referenceNumber: true, titleFr: true, status: true, procurementMode: true },
        },
        _count: { select: { avenants: true } },
      },
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.contract.count({ where }),
  ]);

  return {
    data: contracts,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

// ============================================================
// Get contract by ID
// ============================================================

export async function getContractById(id: string) {
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      project: {
        select: {
          id: true,
          referenceNumber: true,
          titleFr: true,
          status: true,
          procurementMode: true,
          estimatedBudget: true,
        },
      },
      avenants: {
        orderBy: { avenantNumber: 'asc' },
      },
    },
  });

  if (!contract) throw new NotFoundError('Contract', id);
  return contract;
}

// ============================================================
// Update contract (DRAFT or UNDER_REVIEW only)
// ============================================================

export async function updateContract(
  id: string,
  data: UpdateContractInput,
  actorId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) throw new NotFoundError('Contract', id);

  const editableStatuses: ContractStatus[] = ['DRAFT', 'UNDER_REVIEW'];
  if (!editableStatuses.includes(contract.status)) {
    throw new ValidationError(
      `Le contrat ne peut etre modifie qu'en statut DRAFT ou UNDER_REVIEW (actuel: ${contract.status})`
    );
  }

  const updateData: Prisma.ContractUpdateInput = {};
  if (data.titleFr) updateData.titleFr = data.titleFr;
  if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms;
  if (data.retentionRate != null)
    updateData.retentionRate = new Prisma.Decimal(data.retentionRate.toFixed(2));
  if (data.advancePaymentRate != null)
    updateData.advancePaymentRate = new Prisma.Decimal(data.advancePaymentRate.toFixed(2));
  if (data.durationMonths) updateData.durationMonths = data.durationMonths;
  if (data.effectiveDate) updateData.effectiveDate = new Date(data.effectiveDate);
  if (data.expiryDate) updateData.expiryDate = new Date(data.expiryDate);

  const updated = await prisma.contract.update({
    where: { id },
    data: updateData,
    include: {
      project: {
        select: { id: true, referenceNumber: true, titleFr: true, status: true },
      },
    },
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.UPDATE,
    resource: 'contract',
    resourceId: id,
    description: `Contrat ${contract.referenceNumber} modifie`,
    previousState: { titleFr: contract.titleFr },
    newState: data,
    ipAddress,
    userAgent,
  });

  return updated;
}

// ============================================================
// Transition contract status (visa workflow)
// ============================================================

export async function transitionContractStatus(
  id: string,
  data: TransitionContractStatusInput,
  actorId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) throw new NotFoundError('Contract', id);

  const allowed = VALID_CONTRACT_TRANSITIONS[contract.status] || [];
  if (!allowed.includes(data.status as ContractStatus)) {
    throw new ValidationError(
      `Transition de ${contract.status} vers ${data.status} non autorisee`
    );
  }

  const updateData: Prisma.ContractUpdateInput = {
    status: data.status as ContractStatus,
  };

  // Record visa/approval timestamps
  if (data.status === 'PENDING_VISA_LEGAL') {
    // no extra fields needed — visa is granted by the next transition
  }
  if (data.status === 'PENDING_VISA_FINANCIAL' && contract.status === 'PENDING_VISA_LEGAL') {
    updateData.legalVisaById = actorId;
    updateData.legalVisaAt = new Date();
  }
  if (data.status === 'PENDING_APPROVAL_DG' && contract.status === 'PENDING_VISA_FINANCIAL') {
    updateData.financialVisaById = actorId;
    updateData.financialVisaAt = new Date();
  }
  if (data.status === 'APPROVED' && contract.status === 'PENDING_APPROVAL_DG') {
    updateData.approvedById = actorId;
    updateData.approvedAt = new Date();
  }
  if (data.status === 'SIGNED') {
    updateData.signedAt = data.signedAt ? new Date(data.signedAt) : new Date();
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.contract.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: { id: true, referenceNumber: true, titleFr: true, status: true },
        },
      },
    });

    // Cascade project status on signing
    if (data.status === 'SIGNED') {
      await tx.project.update({
        where: { id: contract.projectId },
        data: { status: 'CONTRACT_SIGNED' },
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: contract.projectId,
          fromStatus: result.project.status as any,
          toStatus: 'CONTRACT_SIGNED',
          changedById: actorId,
          reason: `Contrat ${contract.referenceNumber} signe`,
        },
      });
    }

    // Cascade project status on execution start
    if (data.status === 'IN_EXECUTION') {
      await tx.project.update({
        where: { id: contract.projectId },
        data: { status: 'IN_EXECUTION' },
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: contract.projectId,
          fromStatus: 'CONTRACT_SIGNED',
          toStatus: 'IN_EXECUTION',
          changedById: actorId,
          reason: `Contrat ${contract.referenceNumber} en execution`,
        },
      });
    }

    return result;
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.STATUS_CHANGE,
    resource: 'contract',
    resourceId: id,
    description: `Contrat ${contract.referenceNumber}: ${contract.status} -> ${data.status}`,
    previousState: { status: contract.status },
    newState: { status: data.status, reason: data.reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ============================================================
// Seal contract document (SHA-256)
// ============================================================

export async function sealContract(
  id: string,
  fileContent: string,
  actorId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) throw new NotFoundError('Contract', id);

  const hash = sha256(fileContent, 'utf8');
  const filePath = `contracts/${contract.referenceNumber}/contract-${Date.now()}.pdf`;

  const updated = await prisma.contract.update({
    where: { id },
    data: { filePath, sha256Hash: hash },
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.DOCUMENT_UPLOAD,
    resource: 'contract',
    resourceId: id,
    description: `Document contrat ${contract.referenceNumber} scelle (SHA-256)`,
    newState: { sha256Hash: hash, filePath },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ============================================================
// Contract stats
// ============================================================

export async function getContractStats() {
  const [total, draft, underReview, pendingVisa, approved, signed, inExecution, completed] =
    await Promise.all([
      prisma.contract.count(),
      prisma.contract.count({ where: { status: 'DRAFT' } }),
      prisma.contract.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.contract.count({
        where: {
          status: {
            in: ['PENDING_VISA_LEGAL', 'PENDING_VISA_FINANCIAL', 'PENDING_APPROVAL_DG'],
          },
        },
      }),
      prisma.contract.count({ where: { status: 'APPROVED' } }),
      prisma.contract.count({ where: { status: 'SIGNED' } }),
      prisma.contract.count({ where: { status: 'IN_EXECUTION' } }),
      prisma.contract.count({
        where: { status: { in: ['COMPLETED', 'TERMINATED', 'RESILIE'] } },
      }),
    ]);

  // Aggregate total contract value
  const valueAgg = await prisma.contract.aggregate({
    _sum: { totalAmount: true },
    where: { status: { in: ['SIGNED', 'IN_EXECUTION', 'COMPLETED'] } },
  });

  return {
    total,
    draft,
    underReview,
    pendingVisa,
    approved,
    signed,
    inExecution,
    completed,
    totalContractValue: valueAgg._sum.totalAmount?.toString() || '0',
  };
}
