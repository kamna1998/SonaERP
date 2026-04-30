import { Router } from 'express';
import * as ctrl from './ccc.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validateRequest';
import { PERMISSIONS } from '../../utils/permissions';
import {
  createMeetingSchema, updateMeetingSchema, addMemberSchema,
  markAttendanceSchema, addAgendaItemSchema, updateAgendaItemSchema,
  recordVoteSchema, setDecisionSchema, listMeetingsQuerySchema,
} from './ccc.validation';

const router = Router();

router.use(authenticate);

router.get('/stats', authorize(PERMISSIONS.CCC_READ), ctrl.getMeetingStats);

router.get(
  '/',
  authorize(PERMISSIONS.CCC_READ),
  validateRequest({ query: listMeetingsQuerySchema }),
  ctrl.listMeetings,
);

router.post(
  '/',
  authorize(PERMISSIONS.CCC_SCHEDULE),
  validateRequest({ body: createMeetingSchema }),
  ctrl.createMeeting,
);

router.get('/:id', authorize(PERMISSIONS.CCC_READ), ctrl.getMeetingById);

router.patch(
  '/:id',
  authorize(PERMISSIONS.CCC_SCHEDULE),
  validateRequest({ body: updateMeetingSchema }),
  ctrl.updateMeeting,
);

router.post(
  '/:id/members',
  authorize(PERMISSIONS.CCC_SCHEDULE),
  validateRequest({ body: addMemberSchema }),
  ctrl.addMember,
);

router.delete(
  '/:id/members/:memberId',
  authorize(PERMISSIONS.CCC_SCHEDULE),
  ctrl.removeMember,
);

router.post(
  '/:id/attendance',
  authorize(PERMISSIONS.CCC_SCHEDULE, PERMISSIONS.CCC_START_SESSION),
  validateRequest({ body: markAttendanceSchema }),
  ctrl.markAttendance,
);

router.post(
  '/:id/agenda',
  authorize(PERMISSIONS.CCC_SCHEDULE, PERMISSIONS.CCC_START_SESSION),
  validateRequest({ body: addAgendaItemSchema }),
  ctrl.addAgendaItem,
);

router.patch(
  '/:id/agenda/:itemId',
  authorize(PERMISSIONS.CCC_SCHEDULE, PERMISSIONS.CCC_START_SESSION),
  validateRequest({ body: updateAgendaItemSchema }),
  ctrl.updateAgendaItem,
);

router.post('/:id/start', authorize(PERMISSIONS.CCC_START_SESSION), ctrl.startSession);

router.post(
  '/:id/votes',
  authorize(PERMISSIONS.CCC_VOTE),
  validateRequest({ body: recordVoteSchema }),
  ctrl.recordVote,
);

router.post(
  '/:id/decision',
  authorize(PERMISSIONS.CCC_START_SESSION),
  validateRequest({ body: setDecisionSchema }),
  ctrl.setDecision,
);

router.post('/:id/pv', authorize(PERMISSIONS.CCC_GENERATE_PV), ctrl.generatePv);

router.post('/:id/end', authorize(PERMISSIONS.CCC_START_SESSION), ctrl.endSession);

export default router;
