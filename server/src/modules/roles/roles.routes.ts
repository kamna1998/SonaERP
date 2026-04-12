import { Router } from 'express';
import * as rolesController from './roles.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { auditLog } from '../../middleware/auditLog';
import { PERMISSIONS } from '../../utils/permissions';
import { createRoleSchema, updateRoleSchema } from './roles.validation';

const router = Router();

router.use(authenticate);
router.use(auditLog('role'));

router.get('/', authorize(PERMISSIONS.ROLE_READ), rolesController.listRoles);

router.get('/permissions', authorize(PERMISSIONS.ROLE_READ), rolesController.listPermissions);

router.get('/:id', authorize(PERMISSIONS.ROLE_READ), rolesController.getRoleById);

router.post(
  '/',
  authorize(PERMISSIONS.ROLE_CREATE),
  validateRequest({ body: createRoleSchema }),
  rolesController.createRole
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.ROLE_UPDATE),
  validateRequest({ body: updateRoleSchema }),
  rolesController.updateRole
);

export default router;
