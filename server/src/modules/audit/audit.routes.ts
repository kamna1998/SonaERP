import { Router } from 'express';
import * as auditController from './audit.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { PERMISSIONS } from '../../utils/permissions';

const router = Router();

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.AUDIT_READ), auditController.queryLogs);

router.get('/my-activity', auditController.getMyActivity);

router.get(
  '/resource/:type/:id',
  authorize(PERMISSIONS.AUDIT_READ),
  auditController.getResourceTrail
);

export default router;
