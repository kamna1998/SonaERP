import { Request, Response, NextFunction } from 'express';
import * as auditService from './audit.service';

export async function queryLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await auditService.queryAuditLogs(req.query as any);
    res.set('X-Total-Count', String(result.pagination.total));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getMyActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const result = await auditService.getMyActivity(req.user!.id, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getResourceTrail(req: Request, res: Response, next: NextFunction) {
  try {
    const logs = await auditService.getResourceAuditTrail(
      req.params.type,
      req.params.id
    );
    res.json(logs);
  } catch (err) {
    next(err);
  }
}
