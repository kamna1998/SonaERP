import { z } from 'zod';

// ============================================================
// Constants
// ============================================================

/** Legal cumulative avenant threshold (Directive E-025/M R4) */
export const LEGAL_CUMULATIVE_THRESHOLD_PCT = 20;

// ============================================================
// Contract schemas
// ============================================================

export const createContractSchema = z.object({
  projectId: z.string().uuid(),
  awardedBidId: z.string().uuid().optional(),
  titleFr: z.string().min(3).max(500),
  totalAmount: z.number().positive(),
  currency: z.string().default('DZD'),
  supplierId: z.string().uuid(),
  paymentTerms: z.string().max(2000).optional(),
  retentionRate: z.number().min(0).max(100).optional(),
  advancePaymentRate: z.number().min(0).max(100).optional(),
  durationMonths: z.number().int().positive().optional(),
  effectiveDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = z.object({
  titleFr: z.string().min(3).max(500).optional(),
  paymentTerms: z.string().max(2000).optional(),
  retentionRate: z.number().min(0).max(100).optional(),
  advancePaymentRate: z.number().min(0).max(100).optional(),
  durationMonths: z.number().int().positive().optional(),
  effectiveDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
});

export type UpdateContractInput = z.infer<typeof updateContractSchema>;

export const transitionContractStatusSchema = z.object({
  status: z.enum([
    'UNDER_REVIEW',
    'PENDING_VISA_LEGAL',
    'PENDING_VISA_FINANCIAL',
    'PENDING_APPROVAL_DG',
    'APPROVED',
    'SIGNED',
    'IN_EXECUTION',
    'SUSPENDED',
    'TERMINATED',
    'COMPLETED',
    'RESILIE',
    'DRAFT',
  ]),
  reason: z.string().max(2000).optional(),
  signedAt: z.string().datetime().optional(),
});

export type TransitionContractStatusInput = z.infer<typeof transitionContractStatusSchema>;

export const listContractsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  projectId: z.string().uuid().optional(),
  status: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'totalAmount', 'expiryDate', 'referenceNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;

// ============================================================
// Avenant schemas
// ============================================================

export const createAvenantSchema = z.object({
  contractId: z.string().uuid(),
  type: z.enum([
    'MODIFICATION_SCOPE',
    'EXTENSION_DELAY',
    'PRICE_REVISION',
    'ADDITIONAL_WORKS',
    'REDUCTION',
  ]),
  titleFr: z.string().min(3).max(500),
  justification: z.string().min(5).max(5000),
  amendedAmount: z.number().positive(),
  newEndDate: z.string().datetime().optional(),
});

export type CreateAvenantInput = z.infer<typeof createAvenantSchema>;

export const updateAvenantSchema = z.object({
  titleFr: z.string().min(3).max(500).optional(),
  justification: z.string().min(5).max(5000).optional(),
  amendedAmount: z.number().positive().optional(),
  newEndDate: z.string().datetime().optional(),
});

export type UpdateAvenantInput = z.infer<typeof updateAvenantSchema>;

export const transitionAvenantStatusSchema = z.object({
  status: z.enum([
    'UNDER_REVIEW',
    'PENDING_CCC_APPROVAL',
    'PENDING_LEGAL_VISA',
    'PENDING_FINANCIAL_VISA',
    'APPROVED',
    'SIGNED',
    'REJECTED',
    'DRAFT',
  ]),
  reason: z.string().max(2000).optional(),
});

export type TransitionAvenantStatusInput = z.infer<typeof transitionAvenantStatusSchema>;

export const listAvenantsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  contractId: z.string().uuid().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.enum(['createdAt', 'avenantNumber', 'amendedAmount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListAvenantsQuery = z.infer<typeof listAvenantsQuerySchema>;
