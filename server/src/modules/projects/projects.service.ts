import { Prisma, AuditAction, ProjectStatus, ProcurementMode } from '@prisma/client';
import { prisma } from '../../config/database';
import { logAuditEvent } from '../../middleware/auditLog';
import {
  getValidProcurementModes,
  isAboveNationalThreshold,
  PROCUREMENT_THRESHOLDS,
} from '../../utils/thresholds';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors';
import { VALID_STATUS_TRANSITIONS } from './projects.validation';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ChangeStatusInput,
  ListProjectsQuery,
} from './projects.validation';

// ============================================================
// Roles that can see all projects across departments
// ============================================================
const GLOBAL_READ_ROLES = [
  'SYS_ADMIN', 'PROC_OFFICER', 'LEGAL_ADVISOR', 'FINANCE_CONTROLLER',
  'DG_APPROVER', 'AUDITOR',
];
const DEPARTMENT_SCOPED_ROLES = ['INITIATOR', 'STRUCTURE_MANAGER'];
const PROJECT_SCOPED_ROLES = ['CCC_PRESIDENT', 'CCC_MEMBER', 'CCC_RAPPORTEUR'];

// ============================================================
// Auto-generate reference number: PRJ-{year}-{0001}
// ============================================================
async function generateReferenceNumber(fiscalYear: number): Promise<string> {
  const lastProject = await prisma.project.findFirst({
    where: { fiscalYear },
    orderBy: { referenceNumber: 'desc' },
    select: { referenceNumber: true },
  });

  let seq = 1;
  if (lastProject) {
    const parts = lastProject.referenceNumber.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `PRJ-${fiscalYear}-${String(seq).padStart(4, '0')}`;
}

// ============================================================
// Build RBAC-aware WHERE clause
// ============================================================
function buildRbacFilter(
  userRoles: string[],
  departmentId: string,
  userId: string
): Prisma.ProjectWhereInput {
  // Global readers see everything
  if (userRoles.some((r) => GLOBAL_READ_ROLES.includes(r))) {
    return {};
  }

  const conditions: Prisma.ProjectWhereInput[] = [];

  // Department-scoped roles see their department's projects
  if (userRoles.some((r) => DEPARTMENT_SCOPED_ROLES.includes(r))) {
    conditions.push({ departmentId });
  }

  // Project-scoped roles (CCC) see projects they are assigned to
  if (userRoles.some((r) => PROJECT_SCOPED_ROLES.includes(r))) {
    conditions.push({
      userRoles: {
        some: { userId, isActive: true },
      },
    });
  }

  // Creator always sees own projects
  conditions.push({ createdById: userId });

  return conditions.length === 1 ? conditions[0] : { OR: conditions };
}

// ============================================================
// CREATE PROJECT
// ============================================================
export async function createProject(
  input: CreateProjectInput,
  userId: string,
  departmentId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const budget = parseFloat(input.estimatedBudget);

  // Validate procurement mode against budget thresholds
  const validModes = getValidProcurementModes(budget);
  if (!validModes.includes(input.procurementMode as ProcurementMode)) {
    const threshold = PROCUREMENT_THRESHOLDS[input.procurementMode];
    let hint = '';
    if (threshold?.maxAmount) {
      hint = ` (maximum ${new Intl.NumberFormat('fr-DZ').format(threshold.maxAmount)} DZD)`;
    }
    if (threshold?.minAmount) {
      hint = ` (minimum ${new Intl.NumberFormat('fr-DZ').format(threshold.minAmount)} DZD)`;
    }
    throw new ValidationError(
      `Le mode "${input.procurementMode}" n'est pas compatible avec le budget estimé de ${new Intl.NumberFormat('fr-DZ').format(budget)} DZD${hint}`
    );
  }

  const referenceNumber = await generateReferenceNumber(input.fiscalYear);
  const aboveNational = isAboveNationalThreshold(budget);
  const thresholdRules = PROCUREMENT_THRESHOLDS[input.procurementMode];
  const requiresCCC = thresholdRules?.requiresCCC ?? false;

  // Determine minimum bid count
  let minimumBidCount = 1;
  if (input.procurementMode === 'APPEL_OFFRES_OUVERT' || input.procurementMode === 'APPEL_OFFRES_RESTREINT') {
    minimumBidCount = 3;
  } else if (input.procurementMode === 'CONSULTATION_DIRECTE') {
    minimumBidCount = thresholdRules?.minSuppliers ?? 3;
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        referenceNumber,
        titleFr: input.titleFr,
        titleAr: input.titleAr,
        titleEn: input.titleEn,
        descriptionFr: input.descriptionFr,
        descriptionAr: input.descriptionAr,
        objectFr: input.objectFr,
        status: ProjectStatus.DRAFT,
        procurementMode: input.procurementMode as ProcurementMode,
        estimatedBudget: new Prisma.Decimal(input.estimatedBudget),
        budgetLineRef: input.budgetLineRef,
        departmentId,
        createdById: userId,
        fiscalYear: input.fiscalYear,
        isAboveNationalThreshold: aboveNational,
        requiresCCCApproval: requiresCCC,
        minimumBidCount,
        publicationDate: input.publicationDate ? new Date(input.publicationDate) : null,
        bidDeadline: input.bidDeadline ? new Date(input.bidDeadline) : null,
        tags: input.tags,
      },
      include: {
        department: { select: { code: true, nameFr: true } },
        createdBy: { select: { id: true, firstNameFr: true, lastNameFr: true, email: true } },
      },
    });

    // Record initial status in history
    await tx.projectStatusHistory.create({
      data: {
        projectId: created.id,
        fromStatus: ProjectStatus.DRAFT,
        toStatus: ProjectStatus.DRAFT,
        changedById: userId,
        reason: 'Création du projet — Stratégie Contractuelle initiée',
      },
    });

    return created;
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.CREATE,
    resource: 'project',
    resourceId: project.id,
    description: `Projet créé: ${referenceNumber} — ${input.titleFr}`,
    newState: { referenceNumber, status: 'DRAFT', procurementMode: input.procurementMode, budget },
    ipAddress,
    userAgent,
  });

  return project;
}

// ============================================================
// LIST PROJECTS (RBAC-filtered)
// ============================================================
export async function listProjects(
  query: ListProjectsQuery,
  userRoles: string[],
  departmentId: string,
  userId: string
) {
  const { page, limit, search, status, procurementMode, departmentId: filterDeptId, fiscalYear, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  // Build base filter from RBAC
  const rbacFilter = buildRbacFilter(userRoles, departmentId, userId);

  // Build additional filters
  const where: Prisma.ProjectWhereInput = {
    ...rbacFilter,
  };

  if (search) {
    where.AND = [
      {
        OR: [
          { titleFr: { contains: search, mode: 'insensitive' } },
          { referenceNumber: { contains: search, mode: 'insensitive' } },
          { objectFr: { contains: search, mode: 'insensitive' } },
          { titleAr: { contains: search, mode: 'insensitive' } },
        ],
      },
    ];
  }
  if (status) where.status = status as ProjectStatus;
  if (procurementMode) where.procurementMode = procurementMode as ProcurementMode;
  if (filterDeptId) where.departmentId = filterDeptId;
  if (fiscalYear) where.fiscalYear = fiscalYear;

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        department: { select: { code: true, nameFr: true } },
        createdBy: { select: { id: true, firstNameFr: true, lastNameFr: true } },
        _count: { select: { bids: true, contracts: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return {
    data: projects,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ============================================================
// GET PROJECT BY ID
// ============================================================
export async function getProjectById(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, code: true, nameFr: true, nameAr: true, nameEn: true } },
      createdBy: { select: { id: true, firstNameFr: true, lastNameFr: true, email: true } },
      statusHistory: {
        orderBy: { changedAt: 'desc' },
        take: 50,
      },
      _count: { select: { bids: true, contracts: true, cccMeetings: true } },
    },
  });

  if (!project) throw new NotFoundError('Project', id);
  return project;
}

// ============================================================
// UPDATE PROJECT (DRAFT only)
// ============================================================
export async function updateProject(
  id: string,
  input: UpdateProjectInput,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new NotFoundError('Project', id);

  if (project.status !== ProjectStatus.DRAFT) {
    throw new ForbiddenError(
      'Le projet ne peut être modifié que dans le statut BROUILLON (DRAFT)'
    );
  }

  // If budget or mode changed, revalidate thresholds
  const newBudget = input.estimatedBudget ? parseFloat(input.estimatedBudget) : Number(project.estimatedBudget);
  const newMode = (input.procurementMode as ProcurementMode) || project.procurementMode;

  if (input.estimatedBudget || input.procurementMode) {
    const validModes = getValidProcurementModes(newBudget);
    if (!validModes.includes(newMode)) {
      throw new ValidationError(
        `Le mode "${newMode}" n'est pas compatible avec le budget de ${new Intl.NumberFormat('fr-DZ').format(newBudget)} DZD`
      );
    }
  }

  const updateData: any = { ...input };
  if (input.estimatedBudget) {
    updateData.estimatedBudget = new Prisma.Decimal(input.estimatedBudget);
    updateData.isAboveNationalThreshold = isAboveNationalThreshold(newBudget);
    const rules = PROCUREMENT_THRESHOLDS[newMode];
    updateData.requiresCCCApproval = rules?.requiresCCC ?? false;
  }
  if (input.publicationDate !== undefined) {
    updateData.publicationDate = input.publicationDate ? new Date(input.publicationDate) : null;
  }
  if (input.bidDeadline !== undefined) {
    updateData.bidDeadline = input.bidDeadline ? new Date(input.bidDeadline) : null;
  }

  const updated = await prisma.project.update({
    where: { id },
    data: updateData,
    include: {
      department: { select: { code: true, nameFr: true } },
      createdBy: { select: { id: true, firstNameFr: true, lastNameFr: true } },
    },
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.UPDATE,
    resource: 'project',
    resourceId: id,
    description: `Projet modifié: ${project.referenceNumber}`,
    previousState: { titleFr: project.titleFr, estimatedBudget: String(project.estimatedBudget), procurementMode: project.procurementMode },
    newState: { titleFr: updated.titleFr, estimatedBudget: String(updated.estimatedBudget), procurementMode: updated.procurementMode },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ============================================================
// CHANGE PROJECT STATUS (State Machine)
// ============================================================
export async function changeProjectStatus(
  id: string,
  input: ChangeStatusInput,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new NotFoundError('Project', id);

  const currentStatus = project.status;
  const targetStatus = input.status as ProjectStatus;

  // Validate transition
  const allowedNext = VALID_STATUS_TRANSITIONS[currentStatus];
  if (!allowedNext || !allowedNext.includes(targetStatus)) {
    throw new ValidationError(
      `Transition invalide: "${currentStatus}" → "${targetStatus}". Transitions autorisées: ${(allowedNext || []).join(', ') || 'aucune'}`
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedProject = await tx.project.update({
      where: { id },
      data: { status: targetStatus },
      include: {
        department: { select: { code: true, nameFr: true } },
        createdBy: { select: { id: true, firstNameFr: true, lastNameFr: true } },
      },
    });

    await tx.projectStatusHistory.create({
      data: {
        projectId: id,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        changedById: userId,
        reason: input.reason || null,
      },
    });

    return updatedProject;
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.STATUS_CHANGE,
    resource: 'project',
    resourceId: id,
    description: `Statut du projet ${project.referenceNumber}: ${currentStatus} → ${targetStatus}`,
    previousState: { status: currentStatus },
    newState: { status: targetStatus },
    metadata: { reason: input.reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ============================================================
// PROJECT STATS (for Dashboard)
// ============================================================
export async function getProjectStats(
  userRoles: string[],
  departmentId: string,
  userId: string
) {
  const rbacFilter = buildRbacFilter(userRoles, departmentId, userId);

  const [total, byStatus] = await Promise.all([
    prisma.project.count({ where: rbacFilter }),
    prisma.project.groupBy({
      by: ['status'],
      _count: { status: true },
      where: rbacFilter,
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) {
    statusCounts[row.status] = row._count.status;
  }

  return {
    total,
    byStatus: statusCounts,
    active: (statusCounts['DRAFT'] || 0) +
      (statusCounts['NEEDS_IDENTIFICATION'] || 0) +
      (statusCounts['DTAO_PREPARATION'] || 0) +
      (statusCounts['DTAO_REVIEW'] || 0) +
      (statusCounts['PUBLISHED'] || 0) +
      (statusCounts['BID_RECEPTION'] || 0) +
      (statusCounts['BID_OPENING'] || 0) +
      (statusCounts['TECHNICAL_EVALUATION'] || 0) +
      (statusCounts['COMMERCIAL_EVALUATION'] || 0) +
      (statusCounts['ADJUDICATION'] || 0) +
      (statusCounts['CONTRACT_DRAFTING'] || 0),
    inExecution: (statusCounts['CONTRACT_SIGNED'] || 0) + (statusCounts['IN_EXECUTION'] || 0),
    closed: statusCounts['CLOSED'] || 0,
    cancelled: statusCounts['CANCELLED'] || 0,
  };
}
