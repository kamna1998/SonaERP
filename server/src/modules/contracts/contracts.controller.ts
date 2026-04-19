import { Request, Response, NextFunction } from 'express';
import * as contractsService from './contracts.service';
import * as avenantsService from './avenants.service';

// ============================================================
// Contract handlers
// ============================================================

export async function createContract(req: Request, res: Response, next: NextFunction) {
  try {
    const contract = await contractsService.createContract(
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json(contract);
  } catch (err) { next(err); }
}

export async function listContracts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await contractsService.listContracts(req.query as any, req.user!.roles);
    res.set('X-Total-Count', String(result.pagination.total));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getContractById(req: Request, res: Response, next: NextFunction) {
  try {
    const contract = await contractsService.getContractById(req.params.id);
    res.json(contract);
  } catch (err) { next(err); }
}

export async function updateContract(req: Request, res: Response, next: NextFunction) {
  try {
    const contract = await contractsService.updateContract(
      req.params.id,
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.json(contract);
  } catch (err) { next(err); }
}

export async function transitionContractStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const contract = await contractsService.transitionContractStatus(
      req.params.id,
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.json(contract);
  } catch (err) { next(err); }
}

export async function sealContract(req: Request, res: Response, next: NextFunction) {
  try {
    const contract = await contractsService.sealContract(
      req.params.id,
      req.body.content,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.json(contract);
  } catch (err) { next(err); }
}

export async function getContractStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await contractsService.getContractStats();
    res.json(stats);
  } catch (err) { next(err); }
}

// ============================================================
// Avenant handlers
// ============================================================

export async function createAvenant(req: Request, res: Response, next: NextFunction) {
  try {
    const avenant = await avenantsService.createAvenant(
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json(avenant);
  } catch (err) { next(err); }
}

export async function listAvenants(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await avenantsService.listAvenants(req.query as any);
    res.set('X-Total-Count', String(result.pagination.total));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getAvenantById(req: Request, res: Response, next: NextFunction) {
  try {
    const avenant = await avenantsService.getAvenantById(req.params.avenantId);
    res.json(avenant);
  } catch (err) { next(err); }
}

export async function updateAvenant(req: Request, res: Response, next: NextFunction) {
  try {
    const avenant = await avenantsService.updateAvenant(
      req.params.avenantId,
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.json(avenant);
  } catch (err) { next(err); }
}

export async function transitionAvenantStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const avenant = await avenantsService.transitionAvenantStatus(
      req.params.avenantId,
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.json(avenant);
  } catch (err) { next(err); }
}

export async function sealAvenant(req: Request, res: Response, next: NextFunction) {
  try {
    const avenant = await avenantsService.sealAvenant(
      req.params.avenantId,
      req.body.content,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.json(avenant);
  } catch (err) { next(err); }
}

export async function getCumulativeDelta(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await avenantsService.getCumulativeDelta(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
}
