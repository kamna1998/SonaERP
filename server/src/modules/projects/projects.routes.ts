import { Router } from 'express';
import * as projectsController from './projects.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { auditLog } from '../../middleware/auditLog';
import { PERMISSIONS } from '../../utils/permissions';
import {
  createProjectSchema,
  updateProjectSchema,
  changeStatusSchema,
  listProjectsQuerySchema,
} from './projects.validation';

const router = Router();

router.use(authenticate);
router.use(auditLog('project'));

router.get(
  '/stats',
  authorize(PERMISSIONS.PROJECT_READ),
  projectsController.getStats
);

router.get(
  '/',
  authorize(PERMISSIONS.PROJECT_READ),
  validateRequest({ query: listProjectsQuerySchema }),
  projectsController.listProjects
);

router.get(
  '/:id',
  authorize(PERMISSIONS.PROJECT_READ),
  projectsController.getProjectById
);

router.post(
  '/',
  authorize(PERMISSIONS.PROJECT_CREATE),
  validateRequest({ body: createProjectSchema }),
  projectsController.createProject
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.PROJECT_UPDATE),
  validateRequest({ body: updateProjectSchema }),
  projectsController.updateProject
);

router.patch(
  '/:id/status',
  authorize(PERMISSIONS.PROJECT_CHANGE_STATUS),
  validateRequest({ body: changeStatusSchema }),
  projectsController.changeStatus
);

export default router;
