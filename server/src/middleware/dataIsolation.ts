import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import type { AlgerianProvince } from '@prisma/client';

/**
 * Data isolation middleware enforcing the technical/commercial vault separation
 * and provincial data silos.
 *
 * Vault isolation:
 * - INITIATOR / technical roles → can access TECHNICAL vault only
 * - PROC_OFFICER / FINANCE_CONTROLLER → can access COMMERCIAL vault only
 * - CCC members → TECHNICAL during tech phase, BOTH during commercial phase
 * - SYS_ADMIN / AUDITOR → can access both (read-only for auditor)
 *
 * Province isolation (Phase 4.2):
 * - Users only see projects created by users in the same administrative province
 * - ADMIN / SYS_ADMIN / DIRECTOR_GENERAL / AUDITOR bypass province check
 */
export type VaultType = 'TECHNICAL' | 'COMMERCIAL';

const TECHNICAL_ROLES = ['INITIATOR'];
const COMMERCIAL_ROLES = ['PROC_OFFICER', 'FINANCE_CONTROLLER'];
const FULL_ACCESS_ROLES = ['SYS_ADMIN', 'AUDITOR'];
const CCC_ROLES = ['CCC_PRESIDENT', 'CCC_MEMBER', 'CCC_RAPPORTEUR'];

export function enforceVaultAccess(requestedVault: VaultType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ForbiddenError('Authentication required for vault access'));
    }

    const userRoles = req.user.roles;

    // Full access roles can see everything
    if (userRoles.some((r) => FULL_ACCESS_ROLES.includes(r))) {
      return next();
    }

    // Technical-only roles
    if (userRoles.some((r) => TECHNICAL_ROLES.includes(r))) {
      if (requestedVault === 'COMMERCIAL') {
        logger.warn('Vault access denied: technical role tried to access commercial vault', {
          userId: req.user.id,
          roles: userRoles,
        });
        return next(
          new ForbiddenError('Technical roles cannot access commercial/financial data')
        );
      }
      return next();
    }

    // Commercial-only roles
    if (userRoles.some((r) => COMMERCIAL_ROLES.includes(r))) {
      if (requestedVault === 'TECHNICAL') {
        logger.warn('Vault access denied: commercial role tried to access technical vault', {
          userId: req.user.id,
          roles: userRoles,
        });
        return next(
          new ForbiddenError('Commercial roles cannot access technical specification data')
        );
      }
      return next();
    }

    // CCC members: can access both during evaluation phases
    // (project status check should be done at service level for more context)
    if (userRoles.some((r) => CCC_ROLES.includes(r))) {
      return next();
    }

    // Structure Manager and DG: access depends on vault type
    if (userRoles.includes('STRUCTURE_MANAGER')) {
      if (requestedVault === 'TECHNICAL') return next();
      return next(new ForbiddenError('Structure managers cannot access commercial vault'));
    }

    if (userRoles.includes('DG_APPROVER')) {
      if (requestedVault === 'COMMERCIAL') return next();
      return next(new ForbiddenError('DG approvers access commercial data only'));
    }

    return next(new ForbiddenError('No vault access configured for your role'));
  };
}

// ─── Province-based data isolation ──────────────────────────────────────────

const PROVINCE_BYPASS_ROLES = ['ADMIN', 'SYS_ADMIN', 'DIRECTOR_GENERAL', 'AUDITOR'];

export function enforceProvinceIsolation(resource: 'project' | 'contract' | 'bid') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ForbiddenError('Authentication required'));
    }

    if (req.user.roles.some((r) => PROVINCE_BYPASS_ROLES.includes(r))) {
      return next();
    }

    const userProvince = req.user.province;
    if (!userProvince) return next();

    const resourceId = req.params.id;
    if (!resourceId) return next();

    try {
      let creatorProvince: AlgerianProvince | null = null;

      if (resource === 'project') {
        const project = await prisma.project.findUnique({
          where: { id: resourceId },
          select: { createdBy: { select: { province: true } } },
        });
        creatorProvince = project?.createdBy.province ?? null;
      } else if (resource === 'contract') {
        const contract = await prisma.contract.findUnique({
          where: { id: resourceId },
          select: { project: { select: { createdBy: { select: { province: true } } } } },
        });
        creatorProvince = contract?.project.createdBy.province ?? null;
      } else if (resource === 'bid') {
        const bid = await prisma.bid.findUnique({
          where: { id: resourceId },
          select: { project: { select: { createdBy: { select: { province: true } } } } },
        });
        creatorProvince = bid?.project.createdBy.province ?? null;
      }

      if (creatorProvince && creatorProvince !== userProvince) {
        logger.warn('Province isolation block', {
          userId: req.user.id,
          userProvince,
          creatorProvince,
          resource,
          resourceId,
        });
        return next(
          new ForbiddenError(
            `Accès interdit: cette ressource appartient à la province ${creatorProvince}`,
          ),
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export function getProvinceWhereClause(
  userProvince: AlgerianProvince | undefined,
  userRoles: string[],
): { createdBy?: { province: AlgerianProvince } } {
  if (!userProvince || userRoles.some((r) => PROVINCE_BYPASS_ROLES.includes(r))) {
    return {};
  }
  return { createdBy: { province: userProvince } };
}
