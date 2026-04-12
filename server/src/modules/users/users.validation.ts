import { z } from 'zod';

export const createUserSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  email: z
    .string()
    .email('Invalid email format')
    .refine((e) => e.endsWith('@sonatrach.dz'), {
      message: 'Only @sonatrach.dz emails allowed',
    }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
  firstNameFr: z.string().min(1),
  lastNameFr: z.string().min(1),
  firstNameAr: z.string().optional(),
  lastNameAr: z.string().optional(),
  phone: z.string().optional(),
  departmentId: z.string().uuid(),
  preferredLang: z.enum(['AR', 'FR', 'EN']).default('FR'),
});

export const updateUserSchema = z.object({
  firstNameFr: z.string().min(1).optional(),
  lastNameFr: z.string().min(1).optional(),
  firstNameAr: z.string().optional(),
  lastNameAr: z.string().optional(),
  phone: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  preferredLang: z.enum(['AR', 'FR', 'EN']).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
});

export const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  roleCode: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
