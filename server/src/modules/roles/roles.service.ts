import { prisma } from '../../config/database';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors';
import type { CreateRoleInput, UpdateRoleInput } from './roles.validation';

export async function listRoles() {
  return prisma.role.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
    include: {
      rolePermissions: {
        include: { permission: true },
      },
      _count: { select: { userRoles: { where: { isActive: true } } } },
    },
  });
}

export async function getRoleById(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      rolePermissions: {
        include: { permission: true },
      },
      userRoles: {
        where: { isActive: true },
        include: {
          user: {
            select: { id: true, email: true, firstNameFr: true, lastNameFr: true },
          },
        },
      },
    },
  });
  if (!role) throw new NotFoundError('Role', id);
  return role;
}

export async function createRole(input: CreateRoleInput) {
  const existing = await prisma.role.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError('A role with this code already exists');

  const { permissionIds, ...roleData } = input;

  const role = await prisma.role.create({
    data: {
      ...roleData,
      isSystem: false,
      rolePermissions: permissionIds
        ? {
            create: permissionIds.map((permissionId) => ({ permissionId })),
          }
        : undefined,
    },
    include: {
      rolePermissions: { include: { permission: true } },
    },
  });

  return role;
}

export async function updateRole(id: string, input: UpdateRoleInput) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new NotFoundError('Role', id);
  if (role.isSystem) throw new ForbiddenError('System roles cannot be modified');

  const { permissionIds, ...roleData } = input;

  // Update role fields
  const updated = await prisma.role.update({
    where: { id },
    data: roleData,
  });

  // Update permission mappings if provided
  if (permissionIds !== undefined) {
    await prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
    });
  }

  return prisma.role.findUnique({
    where: { id },
    include: { rolePermissions: { include: { permission: true } } },
  });
}

export async function listPermissions() {
  return prisma.permission.findMany({
    orderBy: [{ resource: 'asc' }, { action: 'asc' }],
  });
}
