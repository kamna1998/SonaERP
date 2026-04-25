import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await usersService.listUsers(req.query as any);
    res.set('X-Total-Count', String(result.pagination.total));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.getUserById(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.updateUser(req.params.id, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await usersService.updateUserStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function assignRole(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await usersService.assignRole(
      req.params.id,
      req.body.roleId,
      req.body.projectId,
      req.user?.id
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeRole(req: Request, res: Response, next: NextFunction) {
  try {
    await usersService.removeRole(req.params.userId, req.params.roleId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await usersService.resetPassword(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
