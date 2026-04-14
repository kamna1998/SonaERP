import {
  Prisma, AuditAction, DTAOStatus, BidEnvelopeType, DTAODocumentType, ProjectStatus,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { logAuditEvent } from '../../middleware/auditLog';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors';
import { sha256, combinedSha256 } from '../../utils/hash';
import {
  VALID_DTAO_TRANSITIONS,
  REQUIRED_DOCUMENTS_BY_MODE,
  DOCUMENT_VAULT_MAP,
} from './dtao.validation';
import type {
  CreateDtaoInput,
  ChangeDtaoStatusInput,
  CreateDocumentInput,
  CreateVersionInput,
  ListDtaosQuery,
} from './dtao.validation';

// ============================================================
// Role-to-vault access matrix (mirrors dataIsolation middleware)
// ============================================================
const TECHNICAL_ROLES = ['INITIATOR', 'STRUCTURE_MANAGER'];
const COMMERCIAL_ROLES = ['PROC_OFFICER', 'FINANCE_CONTROLLER', 'DG_APPROVER'];
const FULL_ACCESS_ROLES = ['SYS_ADMIN', 'AUDITOR', 'LEGAL_ADVISOR'];
const CCC_ROLES = ['CCC_PRESIDENT', 'CCC_MEMBER', 'CCC_RAPPORTEUR'];

/**
 * Returns the list of vault types a user can access based on their roles.
 * Enforces the "technical privacy vs legal transparency" firewall.
 */
export function getAllowedVaults(userRoles: string[]): BidEnvelopeType[] {
  if (userRoles.some((r) => FULL_ACCESS_ROLES.includes(r))) {
    return [BidEnvelopeType.TECHNICAL, BidEnvelopeType.COMMERCIAL];
  }
  if (userRoles.some((r) => CCC_ROLES.includes(r))) {
    return [BidEnvelopeType.TECHNICAL, BidEnvelopeType.COMMERCIAL];
  }
  const vaults: BidEnvelopeType[] = [];
  if (userRoles.some((r) => TECHNICAL_ROLES.includes(r))) {
    vaults.push(BidEnvelopeType.TECHNICAL);
  }
  if (userRoles.some((r) => COMMERCIAL_ROLES.includes(r))) {
    vaults.push(BidEnvelopeType.COMMERCIAL);
  }
  return vaults;
}

export function assertVaultAccess(userRoles: string[], vault: BidEnvelopeType) {
  const allowed = getAllowedVaults(userRoles);
  if (!allowed.includes(vault)) {
    throw new ForbiddenError(
      vault === BidEnvelopeType.TECHNICAL
        ? 'Accès au coffre technique refusé pour votre rôle'
        : 'Accès au coffre commercial refusé pour votre rôle'
    );
  }
}

// ============================================================
// Auto-generate DTAO reference: DTAO-{year}-{seq}
// ============================================================
async function generateDtaoReference(fiscalYear: number): Promise<string> {
  const last = await prisma.dTAO.findFirst({
    where: { referenceNumber: { startsWith: `DTAO-${fiscalYear}-` } },
    orderBy: { referenceNumber: 'desc' },
    select: { referenceNumber: true },
  });
  let seq = 1;
  if (last) {
    const parts = last.referenceNumber.split('-');
    const n = parseInt(parts[2], 10);
    if (!isNaN(n)) seq = n + 1;
  }
  return `DTAO-${fiscalYear}-${String(seq).padStart(4, '0')}`;
}

// ============================================================
// CREATE DTAO — Only when project is in DTAO_PREPARATION
// ============================================================
export async function createDtao(
  input: CreateDtaoInput,
  userId: string,
  userRoles: string[],
  ipAddress?: string,
  userAgent?: string
) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, status: true, fiscalYear: true, referenceNumber: true, titleFr: true, procurementMode: true },
  });
  if (!project) throw new NotFoundError('Project', input.projectId);

  if (project.status !== ProjectStatus.DTAO_PREPARATION) {
    throw new ValidationError(
      `Un DTAO ne peut être créé que lorsque le projet est en statut DTAO_PREPARATION (statut actuel: ${project.status})`
    );
  }

  // Check if DTAO already exists for this project
  const existing = await prisma.dTAO.findUnique({ where: { projectId: input.projectId } });
  if (existing) {
    throw new ValidationError('Un DTAO existe déjà pour ce projet');
  }

  const referenceNumber = await generateDtaoReference(project.fiscalYear);

  const dtao = await prisma.dTAO.create({
    data: {
      projectId: input.projectId,
      referenceNumber,
      status: DTAOStatus.DRAFT,
      versionMajor: 1,
      versionMinor: 0,
      preparedById: userId,
    },
    include: {
      project: { select: { referenceNumber: true, titleFr: true, procurementMode: true, status: true } },
    },
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.CREATE,
    resource: 'dtao',
    resourceId: dtao.id,
    description: `DTAO créé: ${referenceNumber} pour projet ${project.referenceNumber}`,
    newState: { referenceNumber, status: 'DRAFT', projectId: input.projectId },
    ipAddress,
    userAgent,
  });

  return dtao;
}

// ============================================================
// LIST DTAOs
// ============================================================
export async function listDtaos(
  query: ListDtaosQuery,
  userRoles: string[],
  departmentId: string,
  userId: string
) {
  const { page, limit, status, projectId, search, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.DTAOWhereInput = {};
  if (status) where.status = status as DTAOStatus;
  if (projectId) where.projectId = projectId;
  if (search) {
    where.OR = [
      { referenceNumber: { contains: search, mode: 'insensitive' } },
      { project: { titleFr: { contains: search, mode: 'insensitive' } } },
      { project: { referenceNumber: { contains: search, mode: 'insensitive' } } },
    ];
  }

  // RBAC: non-global roles see own department only
  const isGlobal = userRoles.some((r) => FULL_ACCESS_ROLES.includes(r) || r === 'PROC_OFFICER');
  if (!isGlobal) {
    where.project = {
      ...(typeof where.project === 'object' ? where.project : {}),
      departmentId,
    };
  }

  const [dtaos, total] = await Promise.all([
    prisma.dTAO.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        project: {
          select: {
            id: true, referenceNumber: true, titleFr: true, procurementMode: true, status: true,
            department: { select: { code: true, nameFr: true } },
          },
        },
        _count: { select: { documents: true } },
      },
    }),
    prisma.dTAO.count({ where }),
  ]);

  return {
    data: dtaos,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ============================================================
// GET DTAO BY ID (vault-filtered documents)
// ============================================================
export async function getDtaoById(id: string, userRoles: string[]) {
  const allowedVaults = getAllowedVaults(userRoles);

  const dtao = await prisma.dTAO.findUnique({
    where: { id },
    include: {
      project: {
        select: {
          id: true, referenceNumber: true, titleFr: true, procurementMode: true,
          status: true, estimatedBudget: true, fiscalYear: true,
          department: { select: { code: true, nameFr: true } },
        },
      },
      documents: {
        where: { vault: { in: allowedVaults } },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: {
              id: true, versionNumber: true, fileName: true, fileSize: true,
              mimeType: true, sha256Hash: true, isSealed: true, createdAt: true,
              uploadedBy: { select: { id: true, firstNameFr: true, lastNameFr: true } },
            },
          },
        },
      },
    },
  });
  if (!dtao) throw new NotFoundError('DTAO', id);

  // Compute required-vs-provided documents checklist
  const requiredTypes = REQUIRED_DOCUMENTS_BY_MODE[dtao.project.procurementMode] || [];
  const providedTypes = new Set(dtao.documents.map((d) => d.documentType));
  const checklist = requiredTypes.map((type) => {
    const doc = dtao.documents.find((d) => d.documentType === type);
    return {
      documentType: type,
      vault: DOCUMENT_VAULT_MAP[type] || 'COMMERCIAL',
      provided: providedTypes.has(type as DTAODocumentType),
      sealed: doc?.versions[0]?.isSealed ?? false,
      hidden: !allowedVaults.includes((DOCUMENT_VAULT_MAP[type] || 'COMMERCIAL') as BidEnvelopeType),
    };
  });

  return { ...dtao, checklist, allowedVaults };
}

// ============================================================
// CHANGE DTAO STATUS
// ============================================================
export async function changeDtaoStatus(
  id: string,
  input: ChangeDtaoStatusInput,
  userId: string,
  userRoles: string[],
  ipAddress?: string,
  userAgent?: string
) {
  const dtao = await prisma.dTAO.findUnique({
    where: { id },
    include: {
      documents: {
        include: {
          versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        },
      },
      project: { select: { id: true, referenceNumber: true, procurementMode: true, status: true } },
    },
  });
  if (!dtao) throw new NotFoundError('DTAO', id);

  const target = input.status as DTAOStatus;
  const allowed = VALID_DTAO_TRANSITIONS[dtao.status];
  if (!allowed || !allowed.includes(target)) {
    throw new ValidationError(
      `Transition invalide: "${dtao.status}" → "${target}". Autorisées: ${(allowed || []).join(', ') || 'aucune'}`
    );
  }

  // Pre-transition guards
  if (target === DTAOStatus.UNDER_REVIEW || target === DTAOStatus.APPROVED) {
    const requiredTypes = REQUIRED_DOCUMENTS_BY_MODE[dtao.project.procurementMode] || [];
    const missing = requiredTypes.filter(
      (t) => !dtao.documents.find((d) => d.documentType === t)
    );
    if (missing.length > 0) {
      throw new ValidationError(
        `Documents obligatoires manquants: ${missing.join(', ')}`
      );
    }
    const unsealed = dtao.documents.filter(
      (d) => !d.versions[0]?.isSealed
    );
    if (unsealed.length > 0 && target === DTAOStatus.APPROVED) {
      throw new ValidationError(
        `Tous les documents doivent être scellés avant approbation. Non scellés: ${unsealed
          .map((d) => d.documentType)
          .join(', ')}`
      );
    }
  }

  // Compute combined technical spec hash on approval
  let technicalSpecHash: string | undefined;
  if (target === DTAOStatus.APPROVED) {
    const techHashes = dtao.documents
      .filter((d) => d.vault === BidEnvelopeType.TECHNICAL)
      .map((d) => d.versions[0]?.sha256Hash)
      .filter((h): h is string => !!h);
    technicalSpecHash = techHashes.length > 0 ? combinedSha256(techHashes) : undefined;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDtao = await tx.dTAO.update({
      where: { id },
      data: {
        status: target,
        ...(target === DTAOStatus.APPROVED && {
          approvedById: userId,
          approvedAt: new Date(),
          ...(technicalSpecHash && { technicalSpecHash }),
        }),
        ...(target === DTAOStatus.UNDER_REVIEW && { reviewedById: userId }),
      },
      include: {
        project: { select: { id: true, referenceNumber: true, titleFr: true, status: true, procurementMode: true } },
      },
    });

    // Cascade project status when DTAO is published
    if (target === DTAOStatus.PUBLISHED && dtao.project.status === ProjectStatus.DTAO_REVIEW) {
      await tx.project.update({
        where: { id: dtao.project.id },
        data: { status: ProjectStatus.PUBLISHED },
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: dtao.project.id,
          fromStatus: ProjectStatus.DTAO_REVIEW,
          toStatus: ProjectStatus.PUBLISHED,
          changedById: userId,
          reason: `DTAO ${dtao.referenceNumber} publié`,
        },
      });
    }

    // Cascade project to DTAO_REVIEW when DTAO goes UNDER_REVIEW
    if (target === DTAOStatus.UNDER_REVIEW && dtao.project.status === ProjectStatus.DTAO_PREPARATION) {
      await tx.project.update({
        where: { id: dtao.project.id },
        data: { status: ProjectStatus.DTAO_REVIEW },
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: dtao.project.id,
          fromStatus: ProjectStatus.DTAO_PREPARATION,
          toStatus: ProjectStatus.DTAO_REVIEW,
          changedById: userId,
          reason: `DTAO ${dtao.referenceNumber} soumis à revue`,
        },
      });
    }

    return updatedDtao;
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.STATUS_CHANGE,
    resource: 'dtao',
    resourceId: id,
    description: `Statut DTAO ${dtao.referenceNumber}: ${dtao.status} → ${target}`,
    previousState: { status: dtao.status },
    newState: { status: target, technicalSpecHash },
    metadata: { reason: input.reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ============================================================
// CREATE DOCUMENT (metadata) — vault auto-derived from type
// ============================================================
export async function createDocument(
  dtaoId: string,
  input: CreateDocumentInput,
  userId: string,
  userRoles: string[],
  ipAddress?: string,
  userAgent?: string
) {
  const dtao = await prisma.dTAO.findUnique({
    where: { id: dtaoId },
    select: { id: true, status: true, referenceNumber: true, projectId: true },
  });
  if (!dtao) throw new NotFoundError('DTAO', dtaoId);

  if (dtao.status !== DTAOStatus.DRAFT && dtao.status !== DTAOStatus.AMENDED) {
    throw new ForbiddenError(
      `Les documents ne peuvent être ajoutés qu'en statut DRAFT ou AMENDED (actuel: ${dtao.status})`
    );
  }

  const vault = (input.vault ||
    DOCUMENT_VAULT_MAP[input.documentType] ||
    'COMMERCIAL') as BidEnvelopeType;

  // Enforce vault access
  assertVaultAccess(userRoles, vault);

  // Prevent duplicate document type for the same DTAO
  const existing = await prisma.dTAODocument.findFirst({
    where: { dtaoId, documentType: input.documentType as DTAODocumentType },
  });
  if (existing) {
    throw new ValidationError(
      `Un document de type ${input.documentType} existe déjà pour ce DTAO`
    );
  }

  const doc = await prisma.dTAODocument.create({
    data: {
      dtaoId,
      documentType: input.documentType as DTAODocumentType,
      titleFr: input.titleFr,
      vault,
    },
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.CREATE,
    resource: 'dtao_document',
    resourceId: doc.id,
    description: `Document créé: ${input.documentType} (${vault}) sur DTAO ${dtao.referenceNumber}`,
    newState: { documentType: input.documentType, vault, titleFr: input.titleFr },
    ipAddress,
    userAgent,
  });

  return doc;
}

// ============================================================
// CREATE DOCUMENT VERSION (upload content, SHA256 seal)
// ============================================================
export async function createDocumentVersion(
  documentId: string,
  input: CreateVersionInput,
  userId: string,
  userRoles: string[],
  ipAddress?: string,
  userAgent?: string
) {
  const doc = await prisma.dTAODocument.findUnique({
    where: { id: documentId },
    include: {
      dtao: { select: { id: true, status: true, referenceNumber: true } },
      versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
    },
  });
  if (!doc) throw new NotFoundError('DTAODocument', documentId);

  assertVaultAccess(userRoles, doc.vault);

  if (doc.dtao.status !== DTAOStatus.DRAFT && doc.dtao.status !== DTAOStatus.AMENDED) {
    throw new ForbiddenError(
      `Impossible de téléverser: DTAO en statut ${doc.dtao.status}`
    );
  }

  // Cannot replace a sealed version
  const latest = doc.versions[0];
  if (latest?.isSealed) {
    throw new ForbiddenError(
      'Cette version est scellée et ne peut plus être remplacée. Créez une amendement (nouvelle version majeure) pour continuer.'
    );
  }

  // Compute SHA-256 from content (base64 or utf8 text)
  const contentBuffer = Buffer.from(input.content, 'base64');
  // If base64 decode fails or produces garbage, fall back to utf8
  const isBase64Valid = contentBuffer.toString('base64').replace(/=+$/, '') ===
    input.content.replace(/=+$/, '');
  const finalBuffer = isBase64Valid ? contentBuffer : Buffer.from(input.content, 'utf8');
  const hash = sha256(finalBuffer);
  const fileSize = finalBuffer.length;

  const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

  // Pseudo filePath (real storage will be Phase 4); keep addressable by hash
  const filePath = `/storage/dtao/${doc.dtaoId}/${documentId}/v${nextVersionNumber}-${hash.slice(0, 12)}`;

  const version = await prisma.documentVersion.create({
    data: {
      documentId,
      versionNumber: nextVersionNumber,
      filePath,
      fileName: input.fileName,
      fileSize,
      mimeType: input.mimeType,
      sha256Hash: hash,
      uploadedById: userId,
      isSealed: input.isSealed,
    },
    select: {
      id: true, versionNumber: true, fileName: true, fileSize: true,
      mimeType: true, sha256Hash: true, isSealed: true, createdAt: true,
    },
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.DOCUMENT_UPLOAD,
    resource: 'document_version',
    resourceId: version.id,
    description: `Version ${nextVersionNumber} téléversée pour document ${doc.documentType}`,
    newState: {
      documentId, versionNumber: nextVersionNumber, sha256Hash: hash,
      isSealed: input.isSealed, vault: doc.vault,
    },
    ipAddress,
    userAgent,
  });

  return version;
}

// ============================================================
// SEAL DOCUMENT (lock the latest version as immutable)
// ============================================================
export async function sealDocument(
  documentId: string,
  userId: string,
  userRoles: string[],
  ipAddress?: string,
  userAgent?: string
) {
  const doc = await prisma.dTAODocument.findUnique({
    where: { id: documentId },
    include: {
      dtao: { select: { id: true, status: true, referenceNumber: true } },
      versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
    },
  });
  if (!doc) throw new NotFoundError('DTAODocument', documentId);
  assertVaultAccess(userRoles, doc.vault);

  const latest = doc.versions[0];
  if (!latest) {
    throw new ValidationError('Aucune version à sceller');
  }
  if (latest.isSealed) {
    throw new ValidationError('Cette version est déjà scellée');
  }

  const sealed = await prisma.documentVersion.update({
    where: { id: latest.id },
    data: { isSealed: true },
    select: {
      id: true, versionNumber: true, sha256Hash: true, isSealed: true,
    },
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.UPDATE,
    resource: 'document_version',
    resourceId: sealed.id,
    description: `Document ${doc.documentType} scellé (SHA256: ${sealed.sha256Hash.slice(0, 12)}…)`,
    newState: { isSealed: true },
    ipAddress,
    userAgent,
  });

  return sealed;
}

// ============================================================
// LIST DOCUMENTS OF A DTAO (vault-filtered)
// ============================================================
export async function listDocuments(dtaoId: string, userRoles: string[]) {
  const allowedVaults = getAllowedVaults(userRoles);
  const docs = await prisma.dTAODocument.findMany({
    where: { dtaoId, vault: { in: allowedVaults } },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        select: {
          id: true, versionNumber: true, fileName: true, fileSize: true,
          mimeType: true, sha256Hash: true, isSealed: true, createdAt: true,
          uploadedBy: { select: { id: true, firstNameFr: true, lastNameFr: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  return { data: docs, allowedVaults };
}
