import { prisma } from '../../config/database';
import { Prisma, AuditAction, BidStatus, ProjectStatus } from '@prisma/client';
import { logAuditEvent } from '../../middleware/auditLog';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../../utils/errors';
import { sha256 } from '../../utils/hash';
import { MIN_QUORUM } from './ccc.validation';
import type {
  CreateMeetingInput, UpdateMeetingInput, AddMemberInput, MarkAttendanceInput,
  AddAgendaItemInput, UpdateAgendaItemInput, RecordVoteInput, SetDecisionInput,
  ListMeetingsQuery,
} from './ccc.validation';

const FULL_ACCESS_ROLES = ['ADMIN', 'SYS_ADMIN', 'DIRECTOR_GENERAL', 'AUDITOR'];

const MEETING_INCLUDE = {
  project: { select: { id: true, referenceNumber: true, titleFr: true, status: true } },
  members: { include: { user: { select: { id: true, firstNameFr: true, lastNameFr: true, email: true } } } },
  votes: { include: { voter: { select: { id: true, firstNameFr: true, lastNameFr: true } } } },
  agendaItems: { orderBy: { orderIndex: 'asc' as const } },
} as const;

export async function createMeeting(
  input: CreateMeetingInput,
  actorId: string,
  ip?: string,
  ua?: string,
) {
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new NotFoundError('Project', input.projectId);

  const existingCount = await prisma.cCCMeeting.count({ where: { projectId: input.projectId } });
  const meetingNumber = existingCount + 1;

  const meeting = await prisma.cCCMeeting.create({
    data: {
      projectId: input.projectId,
      meetingNumber,
      subject: input.subject,
      scheduledAt: new Date(input.scheduledAt),
      location: input.location,
      phase: input.phase ?? null,
      quorumRequired: input.quorumRequired ?? MIN_QUORUM,
    },
    include: MEETING_INCLUDE,
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.CREATE,
    resource: 'ccc_meeting',
    resourceId: meeting.id,
    description: `CCC meeting #${meetingNumber} scheduled for project ${project.referenceNumber}`,
    ipAddress: ip,
    userAgent: ua,
  });

  return meeting;
}

export async function listMeetings(
  query: ListMeetingsQuery,
  userRoles: string[],
  userId: string,
) {
  const where: Prisma.CCCMeetingWhereInput = {};

  if (query.projectId) where.projectId = query.projectId;
  if (query.phase) where.phase = query.phase;
  if (query.decision) where.decision = query.decision;
  if (query.search) {
    where.OR = [
      { subject: { contains: query.search, mode: 'insensitive' } },
      { project: { referenceNumber: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  if (!userRoles.some((r) => FULL_ACCESS_ROLES.includes(r))) {
    where.members = { some: { userId } };
  }

  const [data, total] = await Promise.all([
    prisma.cCCMeeting.findMany({
      where,
      include: MEETING_INCLUDE,
      orderBy: { scheduledAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.cCCMeeting.count({ where }),
  ]);

  return {
    data,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getMeetingById(id: string) {
  const meeting = await prisma.cCCMeeting.findUnique({
    where: { id },
    include: MEETING_INCLUDE,
  });
  if (!meeting) throw new NotFoundError('CCC Meeting', id);
  return meeting;
}

export async function updateMeeting(id: string, input: UpdateMeetingInput) {
  const meeting = await prisma.cCCMeeting.findUnique({ where: { id } });
  if (!meeting) throw new NotFoundError('CCC Meeting', id);
  if (meeting.startedAt) throw new ValidationError('Cannot update meeting after session has started');

  return prisma.cCCMeeting.update({
    where: { id },
    data: {
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.scheduledAt !== undefined && { scheduledAt: new Date(input.scheduledAt) }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.phase !== undefined && { phase: input.phase }),
      ...(input.quorumRequired !== undefined && { quorumRequired: input.quorumRequired }),
    },
    include: MEETING_INCLUDE,
  });
}

export async function addMember(meetingId: string, input: AddMemberInput) {
  const meeting = await prisma.cCCMeeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new NotFoundError('CCC Meeting', meetingId);
  if (meeting.startedAt) throw new ValidationError('Cannot add members after session has started');

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new NotFoundError('User', input.userId);

  const existing = await prisma.cCCMember.findUnique({
    where: { meetingId_userId: { meetingId, userId: input.userId } },
  });
  if (existing) throw new ConflictError('User is already a member of this meeting');

  return prisma.cCCMember.create({
    data: { meetingId, userId: input.userId, roleFr: input.roleFr },
    include: { user: { select: { id: true, firstNameFr: true, lastNameFr: true, email: true } } },
  });
}

export async function removeMember(meetingId: string, memberId: string) {
  const meeting = await prisma.cCCMeeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new NotFoundError('CCC Meeting', meetingId);
  if (meeting.startedAt) throw new ValidationError('Cannot remove members after session has started');

  const member = await prisma.cCCMember.findFirst({ where: { id: memberId, meetingId } });
  if (!member) throw new NotFoundError('CCC Member', memberId);

  return prisma.cCCMember.delete({ where: { id: memberId } });
}

export async function markAttendance(meetingId: string, input: MarkAttendanceInput) {
  const meeting = await prisma.cCCMeeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new NotFoundError('CCC Meeting', meetingId);
  if (meeting.endedAt) throw new ValidationError('Cannot mark attendance after session has ended');

  const member = await prisma.cCCMember.findFirst({ where: { id: input.memberId, meetingId } });
  if (!member) throw new NotFoundError('CCC Member', input.memberId);

  return prisma.cCCMember.update({
    where: { id: input.memberId },
    data: { isPresent: input.isPresent, attendedAt: input.isPresent ? new Date() : null },
    include: { user: { select: { id: true, firstNameFr: true, lastNameFr: true, email: true } } },
  });
}

export async function addAgendaItem(meetingId: string, input: AddAgendaItemInput) {
  const meeting = await prisma.cCCMeeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new NotFoundError('CCC Meeting', meetingId);
  if (meeting.endedAt) throw new ValidationError('Cannot modify agenda after session has ended');

  return prisma.cCCAgendaItem.create({
    data: { meetingId, titleFr: input.titleFr, description: input.description, orderIndex: input.orderIndex },
  });
}

export async function updateAgendaItem(meetingId: string, itemId: string, input: UpdateAgendaItemInput) {
  const item = await prisma.cCCAgendaItem.findFirst({ where: { id: itemId, meetingId } });
  if (!item) throw new NotFoundError('CCC Agenda Item', itemId);

  return prisma.cCCAgendaItem.update({
    where: { id: itemId },
    data: {
      ...(input.titleFr !== undefined && { titleFr: input.titleFr }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.resolution !== undefined && { resolution: input.resolution }),
      ...(input.orderIndex !== undefined && { orderIndex: input.orderIndex }),
    },
  });
}

export async function startSession(
  meetingId: string,
  actorId: string,
  ip?: string,
  ua?: string,
) {
  const meeting = await prisma.cCCMeeting.findUnique({
    where: { id: meetingId },
    include: { members: true, project: true },
  });
  if (!meeting) throw new NotFoundError('CCC Meeting', meetingId);
  if (meeting.startedAt) throw new ValidationError('Session has already started');

  const presentCount = meeting.members.filter((m) => m.isPresent).length;
  if (presentCount < meeting.quorumRequired) {
    throw new ValidationError(`Quorum non atteint: ${presentCount}/${meeting.quorumRequired}`);
  }

  const projectStatus = meeting.phase === 'TECHNICAL'
    ? ProjectStatus.TECHNICAL_EVALUATION
    : meeting.phase === 'COMMERCIAL'
      ? ProjectStatus.COMMERCIAL_EVALUATION
      : undefined;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.cCCMeeting.update({
      where: { id: meetingId },
      data: { startedAt: new Date(), quorumMet: true },
      include: MEETING_INCLUDE,
    });

    if (projectStatus) {
      await tx.project.update({
        where: { id: meeting.projectId },
        data: { status: projectStatus },
      });
    }

    return updated;
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.STATUS_CHANGE,
    resource: 'ccc_meeting',
    resourceId: meetingId,
    description: `CCC session started (quorum: ${presentCount}/${meeting.quorumRequired})`,
    ipAddress: ip,
    userAgent: ua,
  });

  return result;
}

export async function recordVote(
  meetingId: string,
  input: RecordVoteInput,
  voterId: string,
) {
  const meeting = await prisma.cCCMeeting.findUnique({
    where: { id: meetingId },
    include: { members: true },
  });
  if (!meeting) throw new NotFoundError('CCC Meeting', meetingId);
  if (!meeting.startedAt) throw new ValidationError('Session has not started');
  if (meeting.endedAt) throw new ValidationError('Session has already ended');

  const member = meeting.members.find((m) => m.userId === voterId);
  if (!member) throw new ForbiddenError('You are not a member of this meeting');
  if (!member.isPresent) throw new ForbiddenError('You must be marked as present to vote');

  if (input.vote === 'RESERVE' && (!input.reservation || input.reservation.trim().length === 0)) {
    throw new ValidationError('A reservation comment is required for RESERVE votes');
  }

  const existing = await prisma.cCCVote.findUnique({
    where: {
      meetingId_voterId_subjectType_subjectId: {
        meetingId,
        voterId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      },
    },
  });
  if (existing) throw new ConflictError('You have already voted on this subject');

  return prisma.cCCVote.create({
    data: {
      meetingId,
      voterId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      vote: input.vote,
      reservation: input.reservation,
    },
    include: { voter: { select: { id: true, firstNameFr: true, lastNameFr: true } } },
  });
}

export async function setDecision(
  meetingId: string,
  input: SetDecisionInput,
  actorId: string,
  ip?: string,
  ua?: string,
) {
  const meeting = await prisma.cCCMeeting.findUnique({
    where: { id: meetingId },
    include: { project: true },
  });
  if (!meeting) throw new NotFoundError('CCC Meeting', meetingId);
  if (!meeting.startedAt) throw new ValidationError('Session has not started');
  if (meeting.endedAt) throw new ValidationError('Session has already ended');
  if (meeting.decision) throw new ValidationError('Decision has already been set');

  if (input.decision === 'ADJUGE') {
    if (!input.awardedBidId) throw new ValidationError('awardedBidId is required for ADJUGE decision');

    const bid = await prisma.bid.findUnique({ where: { id: input.awardedBidId } });
    if (!bid) throw new NotFoundError('Bid', input.awardedBidId);
    if (bid.projectId !== meeting.projectId) throw new ValidationError('Awarded bid does not belong to this project');
    if (!['COMMERCIALLY_EVALUATED', 'TECHNICALLY_COMPLIANT'].includes(bid.status)) {
      throw new ValidationError('Awarded bid must be in COMMERCIALLY_EVALUATED or TECHNICALLY_COMPLIANT status');
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.cCCMeeting.update({
      where: { id: meetingId },
      data: {
        decision: input.decision,
        decisionRationale: input.rationale,
      },
      include: MEETING_INCLUDE,
    });

    if (input.decision === 'ADJUGE' && input.awardedBidId) {
      await tx.bid.update({
        where: { id: input.awardedBidId },
        data: { status: BidStatus.AWARDED, rank: 1 },
      });

      await tx.bid.updateMany({
        where: {
          projectId: meeting.projectId,
          id: { not: input.awardedBidId },
          status: { notIn: [BidStatus.WITHDRAWN, BidStatus.REJECTED] },
        },
        data: { status: BidStatus.REJECTED },
      });

      await tx.project.update({
        where: { id: meeting.projectId },
        data: { status: ProjectStatus.ADJUDICATION },
      });
    }

    if (input.decision === 'INFRUCTUEUX') {
      await tx.project.update({
        where: { id: meeting.projectId },
        data: { status: ProjectStatus.DECLARED_INFRUCTUEUX },
      });
    }

    return updated;
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.STATUS_CHANGE,
    resource: 'ccc_meeting',
    resourceId: meetingId,
    description: `CCC decision: ${input.decision} for project ${meeting.project.referenceNumber}`,
    ipAddress: ip,
    userAgent: ua,
    metadata: { decision: input.decision, awardedBidId: input.awardedBidId },
  });

  return result;
}

export async function generatePv(meetingId: string) {
  const meeting = await prisma.cCCMeeting.findUnique({
    where: { id: meetingId },
    include: {
      project: true,
      members: { include: { user: { select: { firstNameFr: true, lastNameFr: true } } } },
      agendaItems: { orderBy: { orderIndex: 'asc' } },
      votes: { include: { voter: { select: { firstNameFr: true, lastNameFr: true } } } },
    },
  });
  if (!meeting) throw new NotFoundError('CCC Meeting', meetingId);
  if (!meeting.decision) throw new ValidationError('A decision must be set before generating the PV');

  const lines: string[] = [
    `PROCÈS-VERBAL DE LA COMMISSION DE CONTRÔLE DES COMMANDES`,
    `======================================================`,
    ``,
    `Réunion N° ${meeting.meetingNumber}`,
    `Projet: ${meeting.project.referenceNumber} — ${meeting.project.titleFr}`,
    `Date prévue: ${meeting.scheduledAt.toLocaleDateString('fr-FR')}`,
    `Lieu: ${meeting.location ?? 'Non spécifié'}`,
    `Phase: ${meeting.phase ?? 'Générale'}`,
    ``,
    `--- MEMBRES ET PRÉSENCE ---`,
  ];

  for (const m of meeting.members) {
    const name = `${m.user.firstNameFr} ${m.user.lastNameFr}`;
    const status = m.isPresent ? 'PRÉSENT' : 'ABSENT';
    lines.push(`  ${name} (${m.roleFr}): ${status}`);
  }

  lines.push('', `Quorum requis: ${meeting.quorumRequired}`, `Quorum atteint: ${meeting.quorumMet ? 'OUI' : 'NON'}`);

  if (meeting.agendaItems.length > 0) {
    lines.push('', '--- ORDRE DU JOUR ---');
    for (const item of meeting.agendaItems) {
      lines.push(`  ${item.orderIndex + 1}. ${item.titleFr}`);
      if (item.description) lines.push(`     Description: ${item.description}`);
      if (item.resolution) lines.push(`     Résolution: ${item.resolution}`);
    }
  }

  if (meeting.votes.length > 0) {
    lines.push('', '--- VOTES ---');
    for (const v of meeting.votes) {
      const name = `${v.voter.firstNameFr} ${v.voter.lastNameFr}`;
      lines.push(`  ${name}: ${v.vote} (${v.subjectType}:${v.subjectId})${v.reservation ? ` — Réserve: ${v.reservation}` : ''}`);
    }
  }

  lines.push(
    '',
    '--- DÉCISION ---',
    `Décision: ${meeting.decision}`,
    `Motif: ${meeting.decisionRationale ?? ''}`,
    '',
    `Fait le ${new Date().toLocaleDateString('fr-FR')}`,
    `Généré automatiquement par SonaERP v5.0`,
  );

  const pvText = lines.join('\n');
  const pvSha256Hash = sha256(pvText);

  await prisma.cCCMeeting.update({
    where: { id: meetingId },
    data: { pvFilePath: pvText, pvSha256Hash, pvGeneratedAt: new Date() },
  });

  return { pvText, pvSha256Hash };
}

export async function endSession(
  meetingId: string,
  actorId: string,
  ip?: string,
  ua?: string,
) {
  const meeting = await prisma.cCCMeeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new NotFoundError('CCC Meeting', meetingId);
  if (!meeting.startedAt) throw new ValidationError('Session has not started');
  if (meeting.endedAt) throw new ValidationError('Session has already ended');
  if (!meeting.decision) throw new ValidationError('A decision must be set before ending the session');

  const updated = await prisma.cCCMeeting.update({
    where: { id: meetingId },
    data: { endedAt: new Date() },
    include: MEETING_INCLUDE,
  });

  await logAuditEvent({
    actorId,
    action: AuditAction.STATUS_CHANGE,
    resource: 'ccc_meeting',
    resourceId: meetingId,
    description: `CCC session ended with decision: ${meeting.decision}`,
    ipAddress: ip,
    userAgent: ua,
  });

  return updated;
}

export async function getMeetingStats(userRoles: string[], userId: string) {
  const where: Prisma.CCCMeetingWhereInput = {};
  if (!userRoles.some((r) => FULL_ACCESS_ROLES.includes(r))) {
    where.members = { some: { userId } };
  }

  const [total, scheduled, inSession, decided, closed] = await Promise.all([
    prisma.cCCMeeting.count({ where }),
    prisma.cCCMeeting.count({ where: { ...where, startedAt: null } }),
    prisma.cCCMeeting.count({ where: { ...where, startedAt: { not: null }, endedAt: null } }),
    prisma.cCCMeeting.count({ where: { ...where, decision: { not: null } } }),
    prisma.cCCMeeting.count({ where: { ...where, endedAt: { not: null } } }),
  ]);

  return { total, scheduled, inSession, decided, closed };
}
