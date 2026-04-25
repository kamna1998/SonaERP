import { Request, Response, NextFunction } from 'express';
import * as bidsService from './bids.service';

export async function registerBid(req: Request, res: Response, next: NextFunction) {
  try {
    const bid = await bidsService.registerBid(
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json(bid);
  } catch (err) { next(err); }
}

export async function listBids(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await bidsService.listBids(req.query as any, req.user!.roles);
    res.set('X-Total-Count', String(result.pagination.total));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getBidById(req: Request, res: Response, next: NextFunction) {
  try {
    const bid = await bidsService.getBidById(req.params.id, req.user!.roles);
    res.json(bid);
  } catch (err) { next(err); }
}

export async function uploadEnvelope(req: Request, res: Response, next: NextFunction) {
  try {
    const envelope = await bidsService.uploadEnvelope(
      req.params.id,
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json(envelope);
  } catch (err) { next(err); }
}

export async function openEnvelope(req: Request, res: Response, next: NextFunction) {
  try {
    const envelope = await bidsService.openEnvelope(
      req.params.id,
      req.body,
      req.user!.id,
      req.user!.roles,
      req.ip,
      req.get('user-agent')
    );
    res.json(envelope);
  } catch (err) { next(err); }
}

export async function changeBidStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const bid = await bidsService.changeBidStatus(
      req.params.id,
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.json(bid);
  } catch (err) { next(err); }
}

export async function getBidsByProject(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await bidsService.getBidsByProject(req.params.projectId, req.user!.roles);
    res.json(result);
  } catch (err) { next(err); }
}
