import { z } from 'zod';

const ALGERIAN_WILAYAS = [
  'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Bejaia', 'Biskra',
  'Bechar', 'Blida', 'Bouira', 'Tamanrasset', 'Tebessa', 'Tlemcen', 'Tiaret',
  'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Setif', 'Saida', 'Skikda',
  'Sidi Bel Abbes', 'Annaba', 'Guelma', 'Constantine', 'Medea', 'Mostaganem',
  'Msila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi',
  'Bordj Bou Arreridj', 'Boumerdes', 'El Tarf', 'Tindouf', 'Tissemsilt',
  'El Oued', 'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Ain Defla',
  'Naama', 'Ain Temouchent', 'Ghardaia', 'Relizane',
] as const;

export const createSupplierSchema = z.object({
  registrationNumber: z
    .string()
    .min(5, 'Le numéro RC/NIF doit comporter au moins 5 caractères')
    .max(50, 'Numéro trop long')
    .regex(/^[A-Z0-9\-\/]+$/i, 'Caractères invalides dans le numéro d’enregistrement'),
  companyNameFr: z.string().min(2, 'Raison sociale requise').max(300),
  companyNameAr: z.string().max(300).optional(),
  contactEmail: z.string().email('Email invalide').max(200).optional().or(z.literal('')),
  contactPhone: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  wilaya: z.string().max(100).optional().or(z.literal('')),
  country: z.string().length(2, 'Code pays ISO-2 requis').default('DZ'),
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  registrationNumber: z.string().min(5).max(50).optional(),
});

export const blacklistSupplierSchema = z.object({
  isBlacklisted: z.boolean(),
  blacklistReason: z.string().max(2000).optional(),
});

export const listSuppliersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isBlacklisted: z
    .union([z.enum(['true', 'false']), z.boolean()])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  wilaya: z.string().optional(),
  sortBy: z.enum(['createdAt', 'companyNameFr', 'registrationNumber']).default('companyNameFr'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export { ALGERIAN_WILAYAS };

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type BlacklistSupplierInput = z.infer<typeof blacklistSupplierSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
