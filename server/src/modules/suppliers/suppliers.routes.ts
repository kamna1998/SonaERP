import { Router } from 'express';
import * as suppliersController from './suppliers.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { auditLog } from '../../middleware/auditLog';
import { PERMISSIONS } from '../../utils/permissions';
import {
  createSupplierSchema,
  updateSupplierSchema,
  blacklistSupplierSchema,
  listSuppliersQuerySchema,
} from './suppliers.validation';

const router = Router();

router.use(authenticate);
router.use(auditLog('supplier'));

// Any authenticated user with project/bid-related permissions can list suppliers
router.get(
  '/',
  authorize(PERMISSIONS.BID_REGISTER, PERMISSIONS.PROJECT_READ, PERMISSIONS.CONTRACT_READ),
  validateRequest({ query: listSuppliersQuerySchema }),
  suppliersController.listSuppliers
);

router.get(
  '/:id',
  authorize(PERMISSIONS.BID_REGISTER, PERMISSIONS.PROJECT_READ, PERMISSIONS.CONTRACT_READ),
  suppliersController.getSupplierById
);

router.post(
  '/',
  authorize(PERMISSIONS.BID_REGISTER),
  validateRequest({ body: createSupplierSchema }),
  suppliersController.createSupplier
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.BID_REGISTER),
  validateRequest({ body: updateSupplierSchema }),
  suppliersController.updateSupplier
);

router.patch(
  '/:id/blacklist',
  authorize(PERMISSIONS.BID_REGISTER, PERMISSIONS.BID_AWARD),
  validateRequest({ body: blacklistSupplierSchema }),
  suppliersController.setBlacklistStatus
);

export default router;
