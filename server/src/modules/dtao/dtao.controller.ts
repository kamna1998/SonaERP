import { Request, Response, NextFunction } from 'express';
import * as dtaoService from './dtao.service';

export async function createDtao(req: Request, res: Response, next: NextFunction) {
  try {
    const dtao = await dtaoService.createDtao(
      req.body,
      req.user!.id,
      req.user!.roles,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json(dtao);
  } catch (err) { next(err); }
}

export async function listDtaos(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await dtaoService.listDtaos(
      req.query as any,
      req.user!.roles,
      req.user!.departmentId,
      req.user!.id
    );
    res.set('X-Total-Count', String(result.pagination.total));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getDtaoById(req: Request, res: Response, next: NextFunction) {
  try {
    const dtao = await dtaoService.getDtaoById(req.params.id, req.user!.roles);
    res.json(dtao);
  } catch (err) { next(err); }
}

export async function changeDtaoStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const dtao = await dtaoService.changeDtaoStatus(
      req.params.id,
      req.body,
      req.user!.id,
      req.user!.roles,
      req.ip,
      req.get('user-agent')
    );
    res.json(dtao);
  } catch (err) { next(err); }
}

export async function createDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await dtaoService.createDocument(
      req.params.id,
      req.body,
      req.user!.id,
      req.user!.roles,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json(doc);
  } catch (err) { next(err); }
}

export async function listDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await dtaoService.listDocuments(req.params.id, req.user!.roles);
    res.json(result);
  } catch (err) { next(err); }
}

export async function createDocumentVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const version = await dtaoService.createDocumentVersion(
      req.params.docId,
      req.body,
      req.user!.id,
      req.user!.roles,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json(version);
  } catch (err) { next(err); }
}

export async function sealDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const sealed = await dtaoService.sealDocument(
      req.params.docId,
      req.user!.id,
      req.user!.roles,
      req.ip,
      req.get('user-agent')
    );
    res.json(sealed);
  } catch (err) { next(err); }
}
