import { Request, Response, NextFunction } from 'express';
import * as reportsService from './reports.service';

export async function downloadContractPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const { buffer, sha256Hash } = await reportsService.generateContractPdf(
      req.params.id,
      req.user!.roles,
      req.user!.departmentId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="contract-${req.params.id}.pdf"`,
      'X-Document-Hash': sha256Hash,
      'Cache-Control': 'no-store',
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function downloadProjectAuditTrail(req: Request, res: Response, next: NextFunction) {
  try {
    const { buffer, sha256Hash } = await reportsService.generateProjectAuditTrailPdf(
      req.params.id,
      req.user!.email,
      req.user!.roles,
      req.user!.departmentId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="audit-trail-project-${req.params.id}.pdf"`,
      'X-Document-Hash': sha256Hash,
      'Cache-Control': 'no-store',
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function downloadContractAuditTrail(req: Request, res: Response, next: NextFunction) {
  try {
    const { buffer, sha256Hash } = await reportsService.generateContractAuditTrailPdf(
      req.params.id,
      req.user!.email,
      req.user!.roles,
      req.user!.departmentId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="audit-trail-contract-${req.params.id}.pdf"`,
      'X-Document-Hash': sha256Hash,
      'Cache-Control': 'no-store',
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function verifyAuditChain(req: Request, res: Response, next: NextFunction) {
  try {
    const from = req.query.from ? Number(req.query.from) : undefined;
    const to = req.query.to ? Number(req.query.to) : undefined;
    const result = await reportsService.verifyChainIntegrity(from, to);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
