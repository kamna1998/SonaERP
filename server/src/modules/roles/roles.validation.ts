import { z } from 'zod';

export const createRoleSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z_]+$/, 'Code must be uppercase with underscores'),
  nameFr: z.string().min(1),
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

export const updateRoleSchema = z.object({
  nameFr: z.string().min(1).optional(),
  nameAr: z.string().min(1).optional(),
  nameEn: z.string().min(1).optional(),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
