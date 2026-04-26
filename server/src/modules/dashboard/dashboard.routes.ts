import { Router } from 'express';
import * as ctrl from './dashboard.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/overview', ctrl.getOverview);
router.get('/project-status', ctrl.getProjectStatusBreakdown);
router.get('/budget-consumption', ctrl.getBudgetConsumption);
router.get('/lead-time', ctrl.getLeadTime);
router.get('/procurement-distribution', ctrl.getProcurementDistribution);
router.get('/savings', ctrl.getSavings);
router.get('/fiscal-year-trend', ctrl.getFiscalYearTrend);

export default router;
