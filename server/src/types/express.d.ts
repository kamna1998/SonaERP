import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  departmentId: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
