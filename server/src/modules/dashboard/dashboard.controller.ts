import { Request, Response, NextFunction } from 'express';
import * as dashboardService from './dashboard.service';

function getFilter(req: Request) {
  return {
    roles: req.user!.roles,
    departmentId: req.user!.departmentId,
  };
}

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await dashboardService.getOverviewKpis(getFilter(req));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getProjectStatusBreakdown(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await dashboardService.getProjectStatusBreakdown(getFilter(req));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getBudgetConsumption(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await dashboardService.getBudgetConsumption(getFilter(req));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getLeadTime(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await dashboardService.getAverageLeadTime(getFilter(req));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getProcurementDistribution(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await dashboardService.getProcurementModeDistribution(getFilter(req));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getSavings(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await dashboardService.getSavingsAnalysis(getFilter(req));
    res.json(result);
  } catch (err) { next(err); }
}

export async function getFiscalYearTrend(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await dashboardService.getFiscalYearTrend(getFilter(req));
    res.json(result);
  } catch (err) { next(err); }
}
