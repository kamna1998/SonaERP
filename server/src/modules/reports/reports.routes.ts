import { Router } from 'express';
import * as ctrl from './reports.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { PERMISSIONS } from '../../utils/permissions';

const router = Router();

router.use(authenticate);

router.get(
  '/contracts/:id/pdf',
  authorize(PERMISSIONS.REPORT_DOWNLOAD),
  ctrl.downloadContractPdf,
);

router.get(
  '/projects/:id/audit-trail',
  authorize(PERMISSIONS.REPORT_DOWNLOAD),
  ctrl.downloadProjectAuditTrail,
);

router.get(
  '/contracts/:id/audit-trail',
  authorize(PERMISSIONS.REPORT_DOWNLOAD),
  ctrl.downloadContractAuditTrail,
);

router.get(
  '/audit-chain/verify',
  authorize(PERMISSIONS.AUDIT_READ),
  ctrl.verifyAuditChain,
);

export default router;
