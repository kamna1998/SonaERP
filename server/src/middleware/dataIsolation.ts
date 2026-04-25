import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Data isolation middleware enforcing the technical/commercial vault separation.
 *
 * This is the core "technical privacy vs legal transparency" enforcement:
 * - INITIATOR / technical roles → can access TECHNICAL vault only
 * - PROC_OFFICER / FINANCE_CONTROLLER → can access COMMERCIAL vault only
 * - CCC members → TECHNICAL during tech phase, BOTH during commercial phase
 * - SYS_ADMIN / AUDITOR → can access both (read-only for auditor)
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
