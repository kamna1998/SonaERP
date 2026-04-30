import { Request, Response, NextFunction } from 'express';
import * as cccService from './ccc.service';

export async function createMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await cccService.createMeeting(req.body, req.user!.id, req.ip, req.get('user-agent'));
    res.status(201).json(meeting);
  } catch (err) { next(err); }
}

export async function listMeetings(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await cccService.listMeetings(req.query as any, req.user!.roles, req.user!.id);
    res.set('X-Total-Count', String(result.pagination.total));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getMeetingById(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await cccService.getMeetingById(req.params.id);
    res.json(meeting);
  } catch (err) { next(err); }
}

export async function updateMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await cccService.updateMeeting(req.params.id, req.body);
    res.json(meeting);
  } catch (err) { next(err); }
}

export async function addMember(req: Request, res: Response, next: NextFunction) {
  try {
    const member = await cccService.addMember(req.params.id, req.body);
    res.status(201).json(member);
  } catch (err) { next(err); }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    await cccService.removeMember(req.params.id, req.params.memberId);
    res.status(204).end();
  } catch (err) { next(err); }
}

export async function markAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const member = await cccService.markAttendance(req.params.id, req.body);
    res.json(member);
  } catch (err) { next(err); }
}

export async function addAgendaItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await cccService.addAgendaItem(req.params.id, req.body);
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function updateAgendaItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await cccService.updateAgendaItem(req.params.id, req.params.itemId, req.body);
    res.json(item);
  } catch (err) { next(err); }
}

export async function startSession(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await cccService.startSession(req.params.id, req.user!.id, req.ip, req.get('user-agent'));
    res.json(meeting);
  } catch (err) { next(err); }
}

export async function recordVote(req: Request, res: Response, next: NextFunction) {
  try {
    const vote = await cccService.recordVote(req.params.id, req.body, req.user!.id);
    res.status(201).json(vote);
  } catch (err) { next(err); }
}

export async function setDecision(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await cccService.setDecision(req.params.id, req.body, req.user!.id, req.ip, req.get('user-agent'));
    res.json(meeting);
  } catch (err) { next(err); }
}

export async function generatePv(req: Request, res: Response, next: NextFunction) {
  try {
    const pv = await cccService.generatePv(req.params.id);
    res.json(pv);
  } catch (err) { next(err); }
}

export async function endSession(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await cccService.endSession(req.params.id, req.user!.id, req.ip, req.get('user-agent'));
    res.json(meeting);
  } catch (err) { next(err); }
}

export async function getMeetingStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await cccService.getMeetingStats(req.user!.roles, req.user!.id);
    res.json(stats);
  } catch (err) { next(err); }
}
