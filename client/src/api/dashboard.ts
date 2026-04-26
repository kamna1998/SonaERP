import apiClient from './client';

export interface OverviewKpis {
  projects: { total: number; active: number; closed: number; cancelled: number; infructueux: number };
  contracts: { total: number; active: number };
  bids: { total: number; awarded: number };
}

export interface StatusBreakdown {
  status: string;
  count: number;
}

export interface BudgetConsumption {
  totalBudget: string;
  totalCommitted: string;
  overallConsumptionPct: number;
  projects: Array<{
    projectId: string;
    reference: string;
    title: string;
    budget: string;
    committed: string;
    consumptionPct: number;
  }>;
}

export interface LeadTimeData {
  averageDays: number;
  sampleSize: number;
  projects: Array<{ reference: string; days: number }>;
}

export interface ProcurementDistribution {
  mode: string;
  count: number;
  totalBudget: string;
}

export interface SavingsData {
  totalEstimated: string;
  totalContracted: string;
  totalSavings: string;
  savingsPct: number;
  projects: Array<{
    projectId: string;
    reference: string;
    estimated: string;
    contracted: string;
    savings: string;
    savingsPct: number;
  }>;
}

export interface FiscalYearTrend {
  year: number;
  count: number;
  totalBudget: string;
}

export async function fetchOverview(): Promise<OverviewKpis> {
  const res = await apiClient.get('/dashboard/overview');
  return res.data;
}

export async function fetchProjectStatusBreakdown(): Promise<StatusBreakdown[]> {
  const res = await apiClient.get('/dashboard/project-status');
  return res.data;
}

export async function fetchBudgetConsumption(): Promise<BudgetConsumption> {
  const res = await apiClient.get('/dashboard/budget-consumption');
  return res.data;
}

export async function fetchLeadTime(): Promise<LeadTimeData> {
  const res = await apiClient.get('/dashboard/lead-time');
  return res.data;
}

export async function fetchProcurementDistribution(): Promise<ProcurementDistribution[]> {
  const res = await apiClient.get('/dashboard/procurement-distribution');
  return res.data;
}

export async function fetchSavings(): Promise<SavingsData> {
  const res = await apiClient.get('/dashboard/savings');
  return res.data;
}

export async function fetchFiscalYearTrend(): Promise<FiscalYearTrend[]> {
  const res = await apiClient.get('/dashboard/fiscal-year-trend');
  return res.data;
}
