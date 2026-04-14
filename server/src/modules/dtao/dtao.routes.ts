import { Router } from 'express';
import * as dtaoController from './dtao.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { auditLog } from '../../middleware/auditLog';
import { PERMISSIONS } from '../../utils/permissions';
import {
  createDtaoSchema,
  changeDtaoStatusSchema,
  createDocumentSchema,
  createVersionSchema,
  listDtaosQuerySchema,
} from './dtao.validation';

const router = Router();

router.use(authenticate);
router.use(auditLog('dtao'));

// ============================================================
// DTAO-level endpoints
// ============================================================
router.get(
  '/',
  authorize(PERMISSIONS.DTAO_READ_TECHNICAL, PERMISSIONS.DTAO_READ_COMMERCIAL),
  validateRequest({ query: listDtaosQuerySchema }),
  dtaoController.listDtaos
);

router.post(
  '/',
  authorize(PERMISSIONS.DTAO_CREATE),
  validateRequest({ body: createDtaoSchema }),
  dtaoController.createDtao
);

router.get(
  '/:id',
  authorize(PERMISSIONS.DTAO_READ_TECHNICAL, PERMISSIONS.DTAO_READ_COMMERCIAL),
  dtaoController.getDtaoById
);

router.patch(
  '/:id/status',
  authorize(PERMISSIONS.DTAO_UPDATE, PERMISSIONS.DTAO_APPROVE, PERMISSIONS.DTAO_PUBLISH),
  validateRequest({ body: changeDtaoStatusSchema }),
  dtaoController.changeDtaoStatus
);

// ============================================================
// Document-level endpoints (vault enforcement at service layer)
// ============================================================
router.get(
  '/:id/documents',
  authorize(PERMISSIONS.DTAO_READ_TECHNICAL, PERMISSIONS.DTAO_READ_COMMERCIAL),
  dtaoController.listDocuments
);

router.post(
  '/:id/documents',
  authorize(PERMISSIONS.DTAO_UPDATE),
  validateRequest({ body: createDocumentSchema }),
  dtaoController.createDocument
);

router.post(
  '/documents/:docId/versions',
  authorize(PERMISSIONS.DTAO_UPDATE),
  validateRequest({ body: createVersionSchema }),
  dtaoController.createDocumentVersion
);

router.post(
  '/documents/:docId/seal',
  authorize(PERMISSIONS.DTAO_UPDATE, PERMISSIONS.DTAO_APPROVE),
  dtaoController.sealDocument
);

export default router;
