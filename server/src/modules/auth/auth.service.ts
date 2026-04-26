import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { comparePassword, hashPassword } from '../../utils/hash';
import {
  generateAccessToken,
  generateRefreshTokenString,
  parseExpiry,
  AccessTokenPayload,
} from '../../utils/jwt';
import {
  UnauthorizedError,
  AccountLockedError,
  ValidationError,
  NotFoundError,
} from '../../utils/errors';
import { logAuditEvent } from '../../middleware/auditLog';
import { AuditAction } from '@prisma/client';
import type { LoginInput, ChangePasswordInput } from './auth.validation';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    employeeId: string;
    email: string;
    firstNameFr: string;
    lastNameFr: string;
    firstNameAr: string | null;
    lastNameAr: string | null;
    departmentId: string;
    departmentName: string;
    preferredLang: string;
    roles: string[];
    permissions: string[];
    mustChangePassword: boolean;
  };
}

async function loadUserPermissions(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId, isActive: true },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  const roles = userRoles.map((ur) => ur.role.code);
  const permissionSet = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissionSet.add(rp.permission.code);
    }
  }

  return { roles, permissions: Array.from(permissionSet) };
}

export async function login(
  input: LoginInput,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { department: true },
  });

  if (!user) {
    await logAuditEvent({
      action: AuditAction.FAILED_LOGIN,
      resource: 'auth',
      description: `Failed login attempt for ${input.email} - user not found`,
      ipAddress,
      userAgent,
    });
    throw new UnauthorizedError('Invalid email or password');
  }

  // Check account status
  if (user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is deactivated or suspended');
  }

  // Check lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AccountLockedError(user.lockedUntil);
  }

  // Verify password
  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    const newFailedCount = user.failedLoginCount + 1;
    const updateData: any = { failedLoginCount: newFailedCount };

    if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    await prisma.user.update({ where: { id: user.id }, data: updateData });

    await logAuditEvent({
      actorId: user.id,
      action: AuditAction.FAILED_LOGIN,
      resource: 'auth',
      description: `Failed login attempt (${newFailedCount}/${MAX_FAILED_ATTEMPTS})`,
      ipAddress,
      userAgent,
    });

    throw new UnauthorizedError('Invalid email or password');
  }

  // Reset failed attempts on successful login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  // Load roles and permissions
  const { roles, permissions } = await loadUserPermissions(user.id);

  // Generate tokens
  const tokenPayload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    roles,
    departmentId: user.departmentId,
    permissions,
    province: user.province,
    canParticipateInProcurement: user.canParticipateInProcurement,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshTokenStr = generateRefreshTokenString();

  // Store refresh token
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshTokenStr,
      userAgent,
      ipAddress,
      expiresAt: parseExpiry(env.JWT_REFRESH_EXPIRES_IN),
    },
  });

  await logAuditEvent({
    actorId: user.id,
    action: AuditAction.LOGIN,
    resource: 'auth',
    description: 'Successful login',
    ipAddress,
    userAgent,
  });

  return {
    accessToken,
    refreshToken: refreshTokenStr,
    user: {
      id: user.id,
      employeeId: user.employeeId,
      email: user.email,
      firstNameFr: user.firstNameFr,
      lastNameFr: user.lastNameFr,
      firstNameAr: user.firstNameAr,
      lastNameAr: user.lastNameAr,
      departmentId: user.departmentId,
      departmentName: user.department.nameFr,
      preferredLang: user.preferredLang,
      roles,
      permissions,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export async function refreshTokens(
  refreshToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!storedToken) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Check if token was revoked (possible theft detection)
  if (storedToken.revokedAt) {
    // Revoke all tokens for this user as a security measure
    await prisma.refreshToken.updateMany({
      where: { userId: storedToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Refresh token has been revoked. All sessions invalidated.');
  }

  // Check expiry
  if (storedToken.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token has expired');
  }

  // Check user status
  if (storedToken.user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is no longer active');
  }

  // Rotate: revoke old token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  // Load fresh permissions
  const { roles, permissions } = await loadUserPermissions(storedToken.userId);

  // Generate new tokens
  const tokenPayload: AccessTokenPayload = {
    sub: storedToken.userId,
    email: storedToken.user.email,
    roles,
    departmentId: storedToken.user.departmentId,
    permissions,
    province: storedToken.user.province,
    canParticipateInProcurement: storedToken.user.canParticipateInProcurement,
  };

  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshTokenString();

  await prisma.refreshToken.create({
    data: {
      userId: storedToken.userId,
      token: newRefreshToken,
      userAgent,
      ipAddress,
      expiresAt: parseExpiry(env.JWT_REFRESH_EXPIRES_IN),
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logout(
  refreshToken: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken, userId },
    data: { revokedAt: new Date() },
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.LOGOUT,
    resource: 'auth',
    description: 'User logged out',
    ipAddress,
    userAgent,
  });
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');

  const valid = await comparePassword(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw new ValidationError('Current password is incorrect');
  }

  const newHash = await hashPassword(input.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
    },
  });

  // Revoke all refresh tokens to force re-login on other devices
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.UPDATE,
    resource: 'auth',
    description: 'Password changed',
    ipAddress,
    userAgent,
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { department: true },
  });
  if (!user) throw new NotFoundError('User');

  const { roles, permissions } = await loadUserPermissions(userId);

  return {
    id: user.id,
    employeeId: user.employeeId,
    email: user.email,
    firstNameFr: user.firstNameFr,
    lastNameFr: user.lastNameFr,
    firstNameAr: user.firstNameAr,
    lastNameAr: user.lastNameAr,
    departmentId: user.departmentId,
    departmentName: user.department.nameFr,
    preferredLang: user.preferredLang,
    roles,
    permissions,
    mustChangePassword: user.mustChangePassword,
  };
}
