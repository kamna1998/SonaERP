import { Router } from 'express';
import * as ctrl from './contracts.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { auditLog } from '../../middleware/auditLog';
import { PERMISSIONS } from '../../utils/permissions';
import {
  createContractSchema,
  updateContractSchema,
  transitionContractStatusSchema,
  listContractsQuerySchema,
  createAvenantSchema,
  updateAvenantSchema,
  transitionAvenantStatusSchema,
  listAvenantsQuerySchema,
} from './contracts.validation';

const router = Router();

router.use(authenticate);
router.use(auditLog('contract'));

// ============================================================
// Contract endpoints
// ============================================================

router.get(
  '/stats',
  authorize(PERMISSIONS.CONTRACT_READ),
  ctrl.getContractStats
);

router.get(
  '/',
  authorize(PERMISSIONS.CONTRACT_READ),
  validateRequest({ query: listContractsQuerySchema }),
  ctrl.listContracts
);

router.get(
  '/:id',
  authorize(PERMISSIONS.CONTRACT_READ),
  ctrl.getContractById
);

router.post(
  '/',
  authorize(PERMISSIONS.CONTRACT_CREATE),
  validateRequest({ body: createContractSchema }),
  ctrl.createContract
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.CONTRACT_UPDATE),
  validateRequest({ body: updateContractSchema }),
  ctrl.updateContract
);

router.post(
  '/:id/status',
  authorize(PERMISSIONS.CONTRACT_UPDATE),
  validateRequest({ body: transitionContractStatusSchema }),
  ctrl.transitionContractStatus
);

router.post(
  '/:id/seal',
  authorize(PERMISSIONS.CONTRACT_SIGN),
  ctrl.sealContract
);

// ============================================================
// Cumulative delta endpoint (for Financial Impact Gauge)
// ============================================================

router.get(
  '/:id/cumulative-delta',
  authorize(PERMISSIONS.CONTRACT_READ),
  ctrl.getCumulativeDelta
);

// ============================================================
// Avenant endpoints (nested under /contracts/:id/avenants)
// ============================================================

router.get(
  '/:id/avenants',
  authorize(PERMISSIONS.AVENANT_READ),
  validateRequest({ query: listAvenantsQuerySchema }),
  ctrl.listAvenants
);

router.post(
  '/:id/avenants',
  authorize(PERMISSIONS.AVENANT_CREATE),
  validateRequest({ body: createAvenantSchema }),
  ctrl.createAvenant
);

router.get(
  '/:id/avenants/:avenantId',
  authorize(PERMISSIONS.AVENANT_READ),
  ctrl.getAvenantById
);

router.patch(
  '/:id/avenants/:avenantId',
  authorize(PERMISSIONS.AVENANT_CREATE),
  validateRequest({ body: updateAvenantSchema }),
  ctrl.updateAvenant
);

router.post(
  '/:id/avenants/:avenantId/status',
  authorize(PERMISSIONS.AVENANT_CREATE),
  validateRequest({ body: transitionAvenantStatusSchema }),
  ctrl.transitionAvenantStatus
);

router.post(
  '/:id/avenants/:avenantId/seal',
  authorize(PERMISSIONS.AVENANT_APPROVE),
  ctrl.sealAvenant
);

export default router;
