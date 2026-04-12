import { prisma } from '../../config/database';
import { hashPassword } from '../../utils/hash';
import { NotFoundError, ConflictError } from '../../utils/errors';
import type { CreateUserInput, UpdateUserInput, ListUsersQuery } from './users.validation';

export async function listUsers(query: ListUsersQuery) {
  const { page, limit, search, departmentId, status, roleCode } = query;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { firstNameFr: { contains: search, mode: 'insensitive' } },
      { lastNameFr: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { employeeId: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (departmentId) where.departmentId = departmentId;
  if (status) where.status = status;
  if (roleCode) {
    where.userRoles = { some: { role: { code: roleCode }, isActive: true } };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { lastNameFr: 'asc' },
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstNameFr: true,
        lastNameFr: true,
        firstNameAr: true,
        lastNameAr: true,
        phone: true,
        departmentId: true,
        department: { select: { code: true, nameFr: true } },
        preferredLang: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          where: { isActive: true },
          select: { role: { select: { code: true, nameFr: true } } },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users.map((u) => ({
      ...u,
      roles: u.userRoles.map((ur) => ur.role),
      userRoles: undefined,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      employeeId: true,
      email: true,
      firstNameFr: true,
      lastNameFr: true,
      firstNameAr: true,
      lastNameAr: true,
      phone: true,
      departmentId: true,
      department: { select: { code: true, nameFr: true, nameAr: true, nameEn: true } },
      preferredLang: true,
      status: true,
      lastLoginAt: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        where: { isActive: true },
        select: {
          id: true,
          role: { select: { id: true, code: true, nameFr: true } },
          projectId: true,
          assignedAt: true,
        },
      },
    },
  });

  if (!user) throw new NotFoundError('User', id);
  return user;
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { employeeId: input.employeeId }] },
  });
  if (existing) {
    throw new ConflictError(
      existing.email === input.email
        ? 'A user with this email already exists'
        : 'A user with this employee ID already exists'
    );
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      employeeId: input.employeeId,
      email: input.email,
      passwordHash,
      firstNameFr: input.firstNameFr,
      lastNameFr: input.lastNameFr,
      firstNameAr: input.firstNameAr,
      lastNameAr: input.lastNameAr,
      phone: input.phone,
      departmentId: input.departmentId,
      preferredLang: input.preferredLang as any,
      mustChangePassword: true,
    },
    select: {
      id: true,
      employeeId: true,
      email: true,
      firstNameFr: true,
      lastNameFr: true,
      departmentId: true,
      status: true,
      createdAt: true,
    },
  });

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('User', id);

  return prisma.user.update({
    where: { id },
    data: input as any,
    select: {
      id: true,
      employeeId: true,
      email: true,
      firstNameFr: true,
      lastNameFr: true,
      firstNameAr: true,
      lastNameAr: true,
      phone: true,
      departmentId: true,
      preferredLang: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function updateUserStatus(id: string, status: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('User', id);

  // If deactivating/suspending, revoke all refresh tokens
  if (status !== 'ACTIVE') {
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return prisma.user.update({
    where: { id },
    data: { status: status as any },
    select: { id: true, email: true, status: true },
  });
}

export async function assignRole(userId: string, roleId: string, projectId?: string, assignedBy?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User', userId);

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new NotFoundError('Role', roleId);

  // Check if role already assigned
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId, projectId: projectId || null, isActive: true },
  });
  if (existing) {
    throw new ConflictError('This role is already assigned to the user');
  }

  return prisma.userRole.create({
    data: {
      userId,
      roleId,
      projectId,
      assignedBy,
    },
    include: {
      role: { select: { code: true, nameFr: true } },
    },
  });
}

export async function removeRole(userId: string, userRoleId: string) {
  const userRole = await prisma.userRole.findFirst({
    where: { id: userRoleId, userId },
  });
  if (!userRole) throw new NotFoundError('UserRole', userRoleId);

  return prisma.userRole.update({
    where: { id: userRoleId },
    data: { isActive: false },
  });
}

export async function resetPassword(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User', userId);

  const tempPassword = 'Sonatrach@' + Math.random().toString(36).slice(2, 10);
  const passwordHash = await hashPassword(tempPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
  });

  // Revoke all sessions
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { temporaryPassword: tempPassword };
}
