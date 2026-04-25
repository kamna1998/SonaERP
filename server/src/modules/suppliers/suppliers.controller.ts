import { Request, Response, NextFunction } from 'express';
import * as suppliersService from './suppliers.service';

export async function createSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const supplier = await suppliersService.createSupplier(
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json(supplier);
  } catch (err) { next(err); }
}

export async function listSuppliers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await suppliersService.listSuppliers(req.query as any);
    res.set('X-Total-Count', String(result.pagination.total));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getSupplierById(req: Request, res: Response, next: NextFunction) {
  try {
    const supplier = await suppliersService.getSupplierById(req.params.id);
    res.json(supplier);
  } catch (err) { next(err); }
}

export async function updateSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const supplier = await suppliersService.updateSupplier(
      req.params.id,
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.json(supplier);
  } catch (err) { next(err); }
}

export async function setBlacklistStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const supplier = await suppliersService.setBlacklistStatus(
      req.params.id,
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.json(supplier);
  } catch (err) { next(err); }
}
