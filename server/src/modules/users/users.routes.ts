import { Router } from 'express';
import * as usersController from './users.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { auditLog } from '../../middleware/auditLog';
import { PERMISSIONS } from '../../utils/permissions';
import {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  assignRoleSchema,
  listUsersQuerySchema,
} from './users.validation';

const router = Router();

router.use(authenticate);
router.use(auditLog('user'));

router.get(
  '/',
  authorize(PERMISSIONS.USER_READ),
  validateRequest({ query: listUsersQuerySchema }),
  usersController.listUsers
);

router.get(
  '/:id',
  authorize(PERMISSIONS.USER_READ),
  usersController.getUserById
);

router.post(
  '/',
  authorize(PERMISSIONS.USER_CREATE),
  validateRequest({ body: createUserSchema }),
  usersController.createUser
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.USER_UPDATE),
  validateRequest({ body: updateUserSchema }),
  usersController.updateUser
);

router.patch(
  '/:id/status',
  authorize(PERMISSIONS.USER_DELETE),
  validateRequest({ body: updateStatusSchema }),
  usersController.updateStatus
);

router.post(
  '/:id/roles',
  authorize(PERMISSIONS.USER_ASSIGN_ROLE),
  validateRequest({ body: assignRoleSchema }),
  usersController.assignRole
);

router.delete(
  '/:userId/roles/:roleId',
  authorize(PERMISSIONS.USER_ASSIGN_ROLE),
  usersController.removeRole
);

router.post(
  '/:id/reset-password',
  authorize(PERMISSIONS.USER_UPDATE),
  usersController.resetPassword
);

export default router;
