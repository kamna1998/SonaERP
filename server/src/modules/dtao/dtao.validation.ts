import { z } from 'zod';

// ============================================================
// DTAO Status Transitions (strict state machine per E-025/M R4)
// ============================================================
export const VALID_DTAO_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['PUBLISHED', 'UNDER_REVIEW', 'CANCELLED'],
  PUBLISHED: ['AMENDED', 'CANCELLED'],
  AMENDED: ['PUBLISHED', 'CANCELLED'],
  CANCELLED: [],
};

// ============================================================
// Required documents per procurement mode
// ============================================================
export const REQUIRED_DOCUMENTS_BY_MODE: Record<string, string[]> = {
  APPEL_OFFRES_OUVERT: [
    'CAHIER_DES_CHARGES',
    'REGLEMENT_CONSULTATION',
    'CAHIER_PRESCRIPTIONS_TECHNIQUES',
    'BORDEREAU_PRIX',
    'LETTRE_SOUMISSION',
    'DECLARATION_PROBITE',
  ],
  APPEL_OFFRES_RESTREINT: [
    'CAHIER_DES_CHARGES',
    'REGLEMENT_CONSULTATION',
    'CAHIER_PRESCRIPTIONS_TECHNIQUES',
    'BORDEREAU_PRIX',
    'LETTRE_SOUMISSION',
    'DECLARATION_PROBITE',
    'DECLARATION_CANDIDATURE',
  ],
  CONSULTATION_DIRECTE: [
    'CAHIER_DES_CHARGES',
    'CAHIER_PRESCRIPTIONS_TECHNIQUES',
    'BORDEREAU_PRIX',
  ],
  GRE_A_GRE_SIMPLE: ['CAHIER_DES_CHARGES', 'BORDEREAU_PRIX'],
  GRE_A_GRE_APRES_CONSULT: ['CAHIER_DES_CHARGES', 'BORDEREAU_PRIX'],
  COMMANDE_SANS_CONSULT: ['BORDEREAU_PRIX'],
};

// ============================================================
// Vault classification per document type
// ============================================================
export const DOCUMENT_VAULT_MAP: Record<string, 'TECHNICAL' | 'COMMERCIAL'> = {
  CAHIER_PRESCRIPTIONS_TECHNIQUES: 'TECHNICAL',
  CAHIER_DES_CHARGES: 'COMMERCIAL',
  REGLEMENT_CONSULTATION: 'COMMERCIAL',
  BORDEREAU_PRIX: 'COMMERCIAL',
  LETTRE_SOUMISSION: 'COMMERCIAL',
  DECLARATION_PROBITE: 'COMMERCIAL',
  DECLARATION_CANDIDATURE: 'COMMERCIAL',
  CAUTION_SOUMISSION: 'COMMERCIAL',
  MODELE_CONTRAT: 'COMMERCIAL',
  AUTRES: 'COMMERCIAL',
};

const DTAO_STATUSES = [
  'DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'AMENDED', 'CANCELLED',
] as const;

const DOCUMENT_TYPES = [
  'CAHIER_DES_CHARGES',
  'REGLEMENT_CONSULTATION',
  'CAHIER_PRESCRIPTIONS_TECHNIQUES',
  'BORDEREAU_PRIX',
  'LETTRE_SOUMISSION',
  'DECLARATION_PROBITE',
  'DECLARATION_CANDIDATURE',
  'CAUTION_SOUMISSION',
  'MODELE_CONTRAT',
  'AUTRES',
] as const;

const VAULT_TYPES = ['TECHNICAL', 'COMMERCIAL'] as const;

// ============================================================
// Schemas
// ============================================================
export const createDtaoSchema = z.object({
  projectId: z.string().uuid('ID de projet invalide'),
});

export const updateDtaoSchema = z.object({
  versionMajor: z.number().int().positive().optional(),
  versionMinor: z.number().int().nonnegative().optional(),
});

export const changeDtaoStatusSchema = z.object({
  status: z.enum(DTAO_STATUSES, {
    errorMap: () => ({ message: 'Statut DTAO invalide' }),
  }),
  reason: z.string().max(2000).optional(),
});

export const createDocumentSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES, {
    errorMap: () => ({ message: 'Type de document invalide' }),
  }),
  titleFr: z.string().min(3, 'Le titre est requis').max(500),
  vault: z.enum(VAULT_TYPES).optional(), // Auto-derived if omitted
});

export const createVersionSchema = z.object({
  content: z.string().min(1, 'Le contenu est requis'),
  fileName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(100).default('text/plain'),
  isSealed: z.boolean().default(false),
});

export const listDtaosQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(DTAO_STATUSES).optional(),
  projectId: z.string().uuid().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'referenceNumber', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateDtaoInput = z.infer<typeof createDtaoSchema>;
export type UpdateDtaoInput = z.infer<typeof updateDtaoSchema>;
export type ChangeDtaoStatusInput = z.infer<typeof changeDtaoStatusSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type CreateVersionInput = z.infer<typeof createVersionSchema>;
export type ListDtaosQuery = z.infer<typeof listDtaosQuerySchema>;
