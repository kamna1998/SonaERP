import { z } from 'zod';

// ============================================================
// Bid Status Transitions (Directive E-025/M R4)
// ============================================================
// Workflow:
//   RECEIVED → OPENED (technical envelope opened in session)
//   OPENED → UNDER_EVALUATION
//   UNDER_EVALUATION → TECHNICALLY_COMPLIANT | TECHNICALLY_NON_COMPLIANT
//   TECHNICALLY_COMPLIANT → COMMERCIALLY_EVALUATED (commercial envelope opened)
//   COMMERCIALLY_EVALUATED → AWARDED | REJECTED
//   Any pre-open state → WITHDRAWN
export const VALID_BID_TRANSITIONS: Record<string, string[]> = {
  RECEIVED: ['OPENED', 'WITHDRAWN'],
  OPENED: ['UNDER_EVALUATION'],
  UNDER_EVALUATION: ['TECHNICALLY_COMPLIANT', 'TECHNICALLY_NON_COMPLIANT'],
  TECHNICALLY_COMPLIANT: ['COMMERCIALLY_EVALUATED', 'REJECTED'],
  TECHNICALLY_NON_COMPLIANT: ['REJECTED'],
  COMMERCIALLY_EVALUATED: ['AWARDED', 'REJECTED'],
  AWARDED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const BID_STATUSES = [
  'RECEIVED', 'OPENED', 'UNDER_EVALUATION', 'TECHNICALLY_COMPLIANT',
  'TECHNICALLY_NON_COMPLIANT', 'COMMERCIALLY_EVALUATED', 'AWARDED',
  'REJECTED', 'WITHDRAWN',
] as const;

const ENVELOPE_TYPES = ['TECHNICAL', 'COMMERCIAL'] as const;

// ============================================================
// Register Bid Reception
// ============================================================
export const registerBidSchema = z.object({
  projectId: z.string().uuid('ID de projet invalide'),
  supplierId: z.string().uuid('ID de fournisseur invalide'),
  receivedByName: z.string().min(2, 'Nom du récepteur requis').max(200),
  receivedAt: z.string().datetime('Date de réception invalide').optional(),
  hasBidBond: z.boolean().default(false),
  bidBondAmount: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'string' ? parseFloat(v) : v))
    .refine((v) => !isNaN(v) && v >= 0, 'Montant de caution invalide')
    .optional(),
  bidBondExpiryDate: z.string().datetime().optional(),
});

// ============================================================
// Upload Envelope (base64 content; server computes SHA-256)
// ============================================================
export const uploadEnvelopeSchema = z.object({
  envelopeType: z.enum(ENVELOPE_TYPES, {
    errorMap: () => ({ message: "Type d'enveloppe invalide" }),
  }),
  content: z.string().min(1, 'Contenu requis (base64)'),
  fileName: z.string().min(1).max(500),
});

// ============================================================
// Open Envelope (requires permission + project in correct phase)
// ============================================================
export const openEnvelopeSchema = z.object({
  envelopeType: z.enum(ENVELOPE_TYPES),
  meetingId: z.string().uuid().optional(),
  witnessNote: z.string().max(2000).optional(),
});

// ============================================================
// Change Bid Status (state machine)
// ============================================================
export const changeBidStatusSchema = z.object({
  status: z.enum(BID_STATUSES, {
    errorMap: () => ({ message: 'Statut de soumission invalide' }),
  }),
  reason: z.string().max(2000).optional(),
});

// ============================================================
// Query params
// ============================================================
export const listBidsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  projectId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  status: z.enum(BID_STATUSES).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['receivedAt', 'referenceNumber', 'status', 'rank']).default('receivedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type RegisterBidInput = z.infer<typeof registerBidSchema>;
export type UploadEnvelopeInput = z.infer<typeof uploadEnvelopeSchema>;
export type OpenEnvelopeInput = z.infer<typeof openEnvelopeSchema>;
export type ChangeBidStatusInput = z.infer<typeof changeBidStatusSchema>;
export type ListBidsQuery = z.infer<typeof listBidsQuerySchema>;
