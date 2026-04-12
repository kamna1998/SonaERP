import { Request, Response, NextFunction } from 'express';
import * as rolesService from './roles.service';

export async function listRoles(_req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await rolesService.listRoles();
    res.json(roles);
  } catch (err) {
    next(err);
  }
}

export async function getRoleById(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rolesService.getRoleById(req.params.id);
    res.json(role);
  } catch (err) {
    next(err);
  }
}

export async function createRole(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rolesService.createRole(req.body);
    res.status(201).json(role);
  } catch (err) {
    next(err);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await rolesService.updateRole(req.params.id, req.body);
    res.json(role);
  } catch (err) {
    next(err);
  }
}

export async function listPermissions(_req: Request, res: Response, next: NextFunction) {
  try {
    const permissions = await rolesService.listPermissions();
    res.json(permissions);
  } catch (err) {
    next(err);
  }
}
