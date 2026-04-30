import { z } from 'zod';

export const MIN_QUORUM = 3;

export const CCC_PHASES = ['TECHNICAL', 'COMMERCIAL'] as const;

export const CCC_DECISIONS = ['ADMIS', 'NON_ADMIS', 'ADJUGE', 'INFRUCTUEUX', 'REPORT'] as const;

export const CCC_VOTES = ['POUR', 'CONTRE', 'ABSTENTION', 'RESERVE'] as const;

export const VOTE_SUBJECT_TYPES = ['bid', 'bid_opening', 'other'] as const;

export const createMeetingSchema = z.object({
  projectId: z.string().uuid(),
  subject: z.string().min(3).max(500),
  scheduledAt: z.string().datetime(),
  location: z.string().max(500).optional(),
  phase: z.enum(CCC_PHASES).optional(),
  quorumRequired: z.coerce.number().int().min(MIN_QUORUM).default(MIN_QUORUM),
});

export const updateMeetingSchema = z.object({
  subject: z.string().min(3).max(500).optional(),
  scheduledAt: z.string().datetime().optional(),
  location: z.string().max(500).optional(),
  phase: z.enum(CCC_PHASES).optional(),
  quorumRequired: z.coerce.number().int().min(MIN_QUORUM).optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  roleFr: z.string().min(2).max(200),
});

export const markAttendanceSchema = z.object({
  memberId: z.string().uuid(),
  isPresent: z.boolean(),
});

export const addAgendaItemSchema = z.object({
  titleFr: z.string().min(2).max(500),
  description: z.string().max(2000).optional(),
  orderIndex: z.coerce.number().int().min(0).default(0),
});

export const updateAgendaItemSchema = z.object({
  titleFr: z.string().min(2).max(500).optional(),
  description: z.string().max(2000).optional(),
  resolution: z.string().max(5000).optional(),
  orderIndex: z.coerce.number().int().min(0).optional(),
});

export const recordVoteSchema = z.object({
  subjectType: z.enum(VOTE_SUBJECT_TYPES),
  subjectId: z.string().min(1).max(200),
  vote: z.enum(CCC_VOTES),
  reservation: z.string().max(2000).optional(),
});

export const setDecisionSchema = z.object({
  decision: z.enum(CCC_DECISIONS),
  rationale: z.string().min(5).max(5000),
  awardedBidId: z.string().uuid().optional(),
  additionalNotes: z.string().max(5000).optional(),
});

export const listMeetingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  projectId: z.string().uuid().optional(),
  phase: z.enum(CCC_PHASES).optional(),
  decision: z.enum(CCC_DECISIONS).optional(),
  search: z.string().optional(),
});

export const recordEvaluationSchema = z.object({
  criterionCode: z.string().min(1).max(100),
  criterionLabel: z.string().min(1).max(300),
  maxScore: z.coerce.number().min(0).max(100),
  givenScore: z.coerce.number().min(0),
  envelopeType: z.enum(['TECHNICAL', 'COMMERCIAL']),
  justification: z.string().max(2000).optional(),
});

export const recordEvaluationsSchema = z.object({
  evaluations: z.array(recordEvaluationSchema).min(1),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type AddAgendaItemInput = z.infer<typeof addAgendaItemSchema>;
export type UpdateAgendaItemInput = z.infer<typeof updateAgendaItemSchema>;
export type RecordVoteInput = z.infer<typeof recordVoteSchema>;
export type SetDecisionInput = z.infer<typeof setDecisionSchema>;
export type ListMeetingsQuery = z.infer<typeof listMeetingsQuerySchema>;
export type RecordEvaluationInput = z.infer<typeof recordEvaluationSchema>;
