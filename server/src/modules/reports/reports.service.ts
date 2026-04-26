import { prisma } from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import {
  generateContractGreAGre,
  generateContractAppelOffres,
  generateAuditTrailReport,
  type GreAGreInput,
  type AppelOffresInput,
  type AuditTrailInput,
} from '../../utils/pdfGenerator';
import { getAuditChainHead } from '../../utils/auditChain';

const FULL_ACCESS_ROLES = [
  'ADMIN',
  'SYS_ADMIN',
  'DIRECTOR_GENERAL',
  'PROCUREMENT_DIRECTOR',
  'LEGAL_ADVISOR',
  'FINANCIAL_CONTROLLER',
];

function hasFullAccess(roles: string[]): boolean {
  return roles.some((r) => FULL_ACCESS_ROLES.includes(r));
}

export async function generateContractPdf(
  contractId: string,
  actorRoles: string[],
  actorDepartmentId: string,
) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      project: {
        include: { department: true },
      },
      avenants: { orderBy: { avenantNumber: 'asc' } },
    },
  });

  if (!contract) throw new NotFoundError('Contract', contractId);

  if (!hasFullAccess(actorRoles) && contract.project.departmentId !== actorDepartmentId) {
    throw new ForbiddenError('Accès interdit: ce contrat appartient à un autre département');
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id: contract.supplierId },
  });
  if (!supplier) throw new NotFoundError('Supplier', contract.supplierId);

  const isGreAGre = contract.project.procurementMode === 'GRE_A_GRE';

  if (isGreAGre) {
    const input: GreAGreInput = {
      contract: {
        id: contract.id,
        referenceNumber: contract.referenceNumber,
        titleFr: contract.titleFr,
        totalAmount: contract.totalAmount.toString(),
        currency: contract.currency,
        paymentTerms: contract.paymentTerms,
        effectiveDate: contract.effectiveDate,
        expiryDate: contract.expiryDate,
        durationMonths: contract.durationMonths,
      },
      project: {
        referenceNumber: contract.project.referenceNumber,
        titleFr: contract.project.titleFr,
        objectFr: contract.project.objectFr,
        departmentName: contract.project.department.nameFr,
      },
      supplier: {
        registrationNumber: supplier.registrationNumber,
        companyNameFr: supplier.companyNameFr,
        addressFr: supplier.address,
        legalRepresentative: null,
      },
      derogation: {
        article: 'Art. 49',
        reason: 'Procédure de gré à gré conformément aux dispositions de la Directive E-025/M R4.',
      },
    };

    return generateContractGreAGre(input);
  }

  const awardedBid = contract.awardedBidId
    ? await prisma.bid.findUnique({ where: { id: contract.awardedBidId } })
    : null;

  const cccMeeting = await prisma.cCCMeeting.findFirst({
    where: { projectId: contract.projectId, decision: 'ADJUGE' },
    orderBy: { createdAt: 'desc' },
  });

  const totalBids = await prisma.bid.count({ where: { projectId: contract.projectId } });

  const input: AppelOffresInput = {
    contract: {
      id: contract.id,
      referenceNumber: contract.referenceNumber,
      titleFr: contract.titleFr,
      totalAmount: contract.totalAmount.toString(),
      currency: contract.currency,
      paymentTerms: contract.paymentTerms,
      effectiveDate: contract.effectiveDate,
      expiryDate: contract.expiryDate,
      durationMonths: contract.durationMonths,
    },
    project: {
      referenceNumber: contract.project.referenceNumber,
      titleFr: contract.project.titleFr,
      objectFr: contract.project.objectFr,
      departmentName: contract.project.department.nameFr,
      minimumBidCount: contract.project.minimumBidCount,
    },
    supplier: {
      registrationNumber: supplier.registrationNumber,
      companyNameFr: supplier.companyNameFr,
    },
    award: {
      cccMeetingRef: cccMeeting ? `CCC-${cccMeeting.meetingNumber}` : 'N/A',
      decisionDate: cccMeeting?.endedAt ?? cccMeeting?.startedAt ?? new Date(),
      pvSha256Hash: cccMeeting?.pvSha256Hash ?? 'N/A',
      competitorCount: totalBids,
      technicalScore: awardedBid?.technicalScore?.toString(),
      commercialScore: awardedBid?.commercialScore?.toString(),
      compositeScore: awardedBid?.compositeScore?.toString(),
      rank: awardedBid?.rank ?? 1,
    },
    publicOpening: {
      openedAt: contract.project.bidOpeningDate ?? new Date(),
      witnessCount: 0,
      bidsOpenedCount: totalBids,
    },
  };

  return generateContractAppelOffres(input);
}

export async function generateProjectAuditTrailPdf(
  projectId: string,
  actorEmail: string,
  actorRoles: string[],
  actorDepartmentId: string,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { department: true },
  });

  if (!project) throw new NotFoundError('Project', projectId);

  if (!hasFullAccess(actorRoles) && project.departmentId !== actorDepartmentId) {
    throw new ForbiddenError('Accès interdit: ce projet appartient à un autre département');
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: { resource: 'project', resourceId: projectId },
    orderBy: { sequence: 'asc' },
    include: {
      actor: { select: { email: true } },
    },
  });

  const chainHead = await getAuditChainHead();

  const input: AuditTrailInput = {
    reportTitle: `PISTE D'AUDIT — ${project.referenceNumber}`,
    resourceType: 'project',
    resourceRef: project.referenceNumber,
    resourceTitle: project.titleFr,
    generatedBy: actorEmail,
    entries: auditLogs.map((log) => ({
      sequence: log.sequence,
      createdAt: log.createdAt,
      action: log.action,
      actorEmail: log.actor?.email ?? 'Système',
      description: log.description ?? '',
      justification: log.justification,
      chainHash: log.chainHash ?? '',
    })),
    chainHead,
  };

  return generateAuditTrailReport(input);
}

export async function generateContractAuditTrailPdf(
  contractId: string,
  actorEmail: string,
  actorRoles: string[],
  actorDepartmentId: string,
) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      project: { include: { department: true } },
    },
  });

  if (!contract) throw new NotFoundError('Contract', contractId);

  if (!hasFullAccess(actorRoles) && contract.project.departmentId !== actorDepartmentId) {
    throw new ForbiddenError('Accès interdit: ce contrat appartient à un autre département');
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: { resource: 'contract', resourceId: contractId },
    orderBy: { sequence: 'asc' },
    include: {
      actor: { select: { email: true } },
    },
  });

  const chainHead = await getAuditChainHead();

  const input: AuditTrailInput = {
    reportTitle: `PISTE D'AUDIT — ${contract.referenceNumber}`,
    resourceType: 'contract',
    resourceRef: contract.referenceNumber,
    resourceTitle: contract.titleFr,
    generatedBy: actorEmail,
    entries: auditLogs.map((log) => ({
      sequence: log.sequence,
      createdAt: log.createdAt,
      action: log.action,
      actorEmail: log.actor?.email ?? 'Système',
      description: log.description ?? '',
      justification: log.justification,
      chainHash: log.chainHash ?? '',
    })),
    chainHead,
  };

  return generateAuditTrailReport(input);
}

export async function verifyChainIntegrity(fromSequence?: number, toSequence?: number) {
  const { verifyAuditChain } = await import('../../utils/auditChain');
  return verifyAuditChain(fromSequence ?? 1, toSequence);
}
