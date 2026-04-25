import { Request, Response, NextFunction } from 'express';
import * as projectsService from './projects.service';

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectsService.createProject(
      req.body,
      req.user!.id,
      req.user!.departmentId,
      req.ip,
      req.get('user-agent')
    );
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
}

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await projectsService.listProjects(
      req.query as any,
      req.user!.roles,
      req.user!.departmentId,
      req.user!.id
    );
    res.set('X-Total-Count', String(result.pagination.total));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProjectById(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectsService.getProjectById(req.params.id);
    res.json(project);
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectsService.updateProject(
      req.params.id,
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.json(project);
  } catch (err) {
    next(err);
  }
}

export async function changeStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await projectsService.changeProjectStatus(
      req.params.id,
      req.body,
      req.user!.id,
      req.ip,
      req.get('user-agent')
    );
    res.json(project);
  } catch (err) {
    next(err);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await projectsService.getProjectStats(
      req.user!.roles,
      req.user!.departmentId,
      req.user!.id
    );
    res.json(stats);
  } catch (err) {
    next(err);
  }
}
