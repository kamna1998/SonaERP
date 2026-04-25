import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================
// Valid Status Transitions (Directive E-025/M R4 Workflow)
// ============================================================
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['NEEDS_IDENTIFICATION', 'CANCELLED'],
  NEEDS_IDENTIFICATION: ['DTAO_PREPARATION', 'CANCELLED'],
  DTAO_PREPARATION: ['DTAO_REVIEW', 'CANCELLED'],
  DTAO_REVIEW: ['PUBLISHED', 'DTAO_PREPARATION', 'CANCELLED'],
  PUBLISHED: ['BID_RECEPTION', 'CANCELLED'],
  BID_RECEPTION: ['BID_OPENING', 'DECLARED_INFRUCTUEUX', 'CANCELLED'],
  BID_OPENING: ['TECHNICAL_EVALUATION'],
  TECHNICAL_EVALUATION: ['COMMERCIAL_EVALUATION', 'DECLARED_INFRUCTUEUX'],
  COMMERCIAL_EVALUATION: ['ADJUDICATION', 'DECLARED_INFRUCTUEUX'],
  ADJUDICATION: ['CONTRACT_DRAFTING'],
  CONTRACT_DRAFTING: ['CONTRACT_SIGNED'],
  CONTRACT_SIGNED: ['IN_EXECUTION'],
  IN_EXECUTION: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
  DECLARED_INFRUCTUEUX: ['DRAFT'], // Can restart as new project
};

// ============================================================
// Procurement mode labels (for validation messages)
// ============================================================
const PROCUREMENT_MODES = [
  'APPEL_OFFRES_OUVERT',
  'APPEL_OFFRES_RESTREINT',
  'CONSULTATION_DIRECTE',
  'GRE_A_GRE_SIMPLE',
  'GRE_A_GRE_APRES_CONSULT',
  'COMMANDE_SANS_CONSULT',
] as const;

const PROJECT_STATUSES = [
  'DRAFT', 'NEEDS_IDENTIFICATION', 'DTAO_PREPARATION', 'DTAO_REVIEW',
  'PUBLISHED', 'BID_RECEPTION', 'BID_OPENING', 'TECHNICAL_EVALUATION',
  'COMMERCIAL_EVALUATION', 'ADJUDICATION', 'CONTRACT_DRAFTING',
  'CONTRACT_SIGNED', 'IN_EXECUTION', 'CLOSED', 'CANCELLED',
  'DECLARED_INFRUCTUEUX',
] as const;

// ============================================================
// Create Project Schema
// ============================================================
export const createProjectSchema = z.object({
  titleFr: z.string().min(3, 'Le titre doit comporter au moins 3 caractères').max(500),
  titleAr: z.string().max(500).optional(),
  titleEn: z.string().max(500).optional(),
  descriptionFr: z.string().max(5000).optional(),
  descriptionAr: z.string().max(5000).optional(),
  objectFr: z.string().min(5, "L'objet du marché est requis").max(2000),
  procurementMode: z.enum(PROCUREMENT_MODES, {
    errorMap: () => ({ message: 'Mode de passation invalide' }),
  }),
  estimatedBudget: z
    .string()
    .or(z.number())
    .transform((val) => String(val))
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, { message: 'Le budget estimé doit être un montant positif en DZD' }),
  budgetLineRef: z.string().max(100).optional(),
  fiscalYear: z.coerce
    .number()
    .int()
    .min(2020)
    .max(2050),
  publicationDate: z.string().datetime().optional(),
  bidDeadline: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
});

// ============================================================
// Update Project Schema
// ============================================================
export const updateProjectSchema = z.object({
  titleFr: z.string().min(3).max(500).optional(),
  titleAr: z.string().max(500).optional(),
  titleEn: z.string().max(500).optional(),
  descriptionFr: z.string().max(5000).optional(),
  descriptionAr: z.string().max(5000).optional(),
  objectFr: z.string().min(5).max(2000).optional(),
  procurementMode: z.enum(PROCUREMENT_MODES).optional(),
  estimatedBudget: z
    .string()
    .or(z.number())
    .transform((val) => String(val))
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, { message: 'Le budget estimé doit être un montant positif en DZD' })
    .optional(),
  budgetLineRef: z.string().max(100).optional(),
  publicationDate: z.string().datetime().optional().nullable(),
  bidDeadline: z.string().datetime().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

// ============================================================
// Status Transition Schema
// ============================================================
export const changeStatusSchema = z.object({
  status: z.enum(PROJECT_STATUSES, {
    errorMap: () => ({ message: 'Statut de projet invalide' }),
  }),
  reason: z.string().max(2000).optional(),
});

// ============================================================
// List / Query Schema
// ============================================================
export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  procurementMode: z.enum(PROCUREMENT_MODES).optional(),
  departmentId: z.string().uuid().optional(),
  fiscalYear: z.coerce.number().int().optional(),
  sortBy: z.enum(['createdAt', 'estimatedBudget', 'referenceNumber', 'titleFr', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================
// Types
// ============================================================
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
