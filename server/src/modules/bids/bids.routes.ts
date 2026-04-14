import { Router } from 'express';
import * as bidsController from './bids.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { auditLog } from '../../middleware/auditLog';
import { PERMISSIONS } from '../../utils/permissions';
import {
  registerBidSchema,
  uploadEnvelopeSchema,
  openEnvelopeSchema,
  changeBidStatusSchema,
  listBidsQuerySchema,
} from './bids.validation';

const router = Router();

router.use(authenticate);
router.use(auditLog('bid'));

// ============================================================
// Bid listing & detail — accessible to read-technical OR read-commercial
// ============================================================
router.get(
  '/',
  authorize(PERMISSIONS.BID_READ_TECHNICAL, PERMISSIONS.BID_READ_COMMERCIAL, PERMISSIONS.BID_REGISTER),
  validateRequest({ query: listBidsQuerySchema }),
  bidsController.listBids
);

router.get(
  '/by-project/:projectId',
  authorize(PERMISSIONS.BID_READ_TECHNICAL, PERMISSIONS.BID_READ_COMMERCIAL, PERMISSIONS.BID_REGISTER),
  bidsController.getBidsByProject
);

router.get(
  '/:id',
  authorize(PERMISSIONS.BID_READ_TECHNICAL, PERMISSIONS.BID_READ_COMMERCIAL, PERMISSIONS.BID_REGISTER),
  bidsController.getBidById
);

// ============================================================
// Bid registration & envelope upload (procurement desk)
// ============================================================
router.post(
  '/',
  authorize(PERMISSIONS.BID_REGISTER),
  validateRequest({ body: registerBidSchema }),
  bidsController.registerBid
);

router.post(
  '/:id/envelopes',
  authorize(PERMISSIONS.BID_REGISTER),
  validateRequest({ body: uploadEnvelopeSchema }),
  bidsController.uploadEnvelope
);

// ============================================================
// Envelope opening — permission-gated by envelope type at service layer
// ============================================================
router.post(
  '/:id/open-envelope',
  authorize(PERMISSIONS.BID_OPEN_TECHNICAL, PERMISSIONS.BID_OPEN_COMMERCIAL),
  validateRequest({ body: openEnvelopeSchema }),
  bidsController.openEnvelope
);

// ============================================================
// Status transitions (evaluation outcomes, withdrawal)
// ============================================================
router.patch(
  '/:id/status',
  authorize(
    PERMISSIONS.BID_OPEN_TECHNICAL,
    PERMISSIONS.BID_OPEN_COMMERCIAL,
    PERMISSIONS.BID_EVALUATE_TECHNICAL,
    PERMISSIONS.BID_EVALUATE_COMMERCIAL,
    PERMISSIONS.BID_AWARD,
    PERMISSIONS.BID_REGISTER
  ),
  validateRequest({ body: changeBidStatusSchema }),
  bidsController.changeBidStatus
);

export default router;
