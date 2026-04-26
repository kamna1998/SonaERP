import { Request } from 'express';
import type { AlgerianProvince } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  departmentId: string;
  permissions: string[];
  province: AlgerianProvince;
  canParticipateInProcurement: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      complianceDocumentHashes?: string[];
    }
  }
}
