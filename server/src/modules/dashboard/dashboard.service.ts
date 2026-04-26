import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';

interface DepartmentFilter {
  roles: string[];
  departmentId: string;
}

const FULL_ACCESS_ROLES = [
  'ADMIN',
  'SYS_ADMIN',
  'DIRECTOR_GENERAL',
  'PROCUREMENT_DIRECTOR',
  'LEGAL_ADVISOR',
  'FINANCIAL_CONTROLLER',
];

function deptWhere(f: DepartmentFilter): Prisma.ProjectWhereInput {
  if (f.roles.some((r) => FULL_ACCESS_ROLES.includes(r))) return {};
  return { departmentId: f.departmentId };
}

export async function getOverviewKpis(filter: DepartmentFilter) {
  const where = deptWhere(filter);

  const [
    totalProjects,
    activeProjects,
    closedProjects,
    cancelledProjects,
    infructueux,
    totalContracts,
    activeContracts,
    totalBids,
    awardedBids,
  ] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.count({
      where: {
        ...where,
        status: { notIn: ['CLOSED', 'CANCELLED', 'DECLARED_INFRUCTUEUX'] },
      },
    }),
    prisma.project.count({ where: { ...where, status: 'CLOSED' } }),
    prisma.project.count({ where: { ...where, status: 'CANCELLED' } }),
    prisma.project.count({ where: { ...where, status: 'DECLARED_INFRUCTUEUX' } }),
    prisma.contract.count({
      where: where.departmentId
        ? { project: { departmentId: where.departmentId as string } }
        : {},
    }),
    prisma.contract.count({
      where: {
        status: 'IN_EXECUTION',
        ...(where.departmentId
          ? { project: { departmentId: where.departmentId as string } }
          : {}),
      },
    }),
    prisma.bid.count({
      where: where.departmentId
        ? { project: { departmentId: where.departmentId as string } }
        : {},
    }),
    prisma.bid.count({
      where: {
        status: 'AWARDED',
        ...(where.departmentId
          ? { project: { departmentId: where.departmentId as string } }
          : {}),
      },
    }),
  ]);

  return {
    projects: { total: totalProjects, active: activeProjects, closed: closedProjects, cancelled: cancelledProjects, infructueux },
    contracts: { total: totalContracts, active: activeContracts },
    bids: { total: totalBids, awarded: awardedBids },
  };
}

export async function getProjectStatusBreakdown(filter: DepartmentFilter) {
  const where = deptWhere(filter);
  const groups = await prisma.project.groupBy({
    by: ['status'],
    where,
    _count: { id: true },
  });

  return groups.map((g) => ({ status: g.status, count: g._count.id }));
}

export async function getBudgetConsumption(filter: DepartmentFilter) {
  const where = deptWhere(filter);

  const projects = await prisma.project.findMany({
    where,
    select: { id: true, referenceNumber: true, titleFr: true, estimatedBudget: true },
  });

  const contractSums = await prisma.contract.groupBy({
    by: ['projectId'],
    where: {
      status: { notIn: ['DRAFT', 'RESILIE'] },
      ...(where.departmentId
        ? { project: { departmentId: where.departmentId as string } }
        : {}),
    },
    _sum: { totalAmount: true },
  });

  const contractMap = new Map(contractSums.map((c) => [c.projectId, c._sum.totalAmount]));

  let totalBudget = new Prisma.Decimal(0);
  let totalCommitted = new Prisma.Decimal(0);

  const breakdown = projects.map((p) => {
    const committed = contractMap.get(p.id) ?? new Prisma.Decimal(0);
    const budget = p.estimatedBudget;
    const pct = budget.gt(0) ? committed.div(budget).mul(100).toNumber() : 0;

    totalBudget = totalBudget.add(budget);
    totalCommitted = totalCommitted.add(committed);

    return {
      projectId: p.id,
      reference: p.referenceNumber,
      title: p.titleFr,
      budget: budget.toString(),
      committed: committed.toString(),
      consumptionPct: Math.round(pct * 100) / 100,
    };
  });

  const overallPct = totalBudget.gt(0)
    ? totalCommitted.div(totalBudget).mul(100).toNumber()
    : 0;

  return {
    totalBudget: totalBudget.toString(),
    totalCommitted: totalCommitted.toString(),
    overallConsumptionPct: Math.round(overallPct * 100) / 100,
    projects: breakdown,
  };
}

export async function getAverageLeadTime(filter: DepartmentFilter) {
  const where = deptWhere(filter);

  const closedProjects = await prisma.project.findMany({
    where: { ...where, status: { in: ['CLOSED', 'CONTRACT_SIGNED', 'IN_EXECUTION'] } },
    select: { id: true, referenceNumber: true, createdAt: true },
  });

  if (closedProjects.length === 0) {
    return { averageDays: 0, sampleSize: 0, projects: [] };
  }

  const contractDates = await prisma.contract.findMany({
    where: {
      projectId: { in: closedProjects.map((p) => p.id) },
      signedAt: { not: null },
    },
    select: { projectId: true, signedAt: true },
    orderBy: { signedAt: 'asc' },
  });

  const firstContractMap = new Map<string, Date>();
  for (const c of contractDates) {
    if (c.signedAt && !firstContractMap.has(c.projectId)) {
      firstContractMap.set(c.projectId, c.signedAt);
    }
  }

  let totalDays = 0;
  let count = 0;
  const projects: Array<{ reference: string; days: number }> = [];

  for (const p of closedProjects) {
    const signedAt = firstContractMap.get(p.id);
    if (!signedAt) continue;
    const days = Math.ceil((signedAt.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    totalDays += days;
    count++;
    projects.push({ reference: p.referenceNumber, days });
  }

  return {
    averageDays: count > 0 ? Math.round(totalDays / count) : 0,
    sampleSize: count,
    projects,
  };
}

export async function getProcurementModeDistribution(filter: DepartmentFilter) {
  const where = deptWhere(filter);
  const groups = await prisma.project.groupBy({
    by: ['procurementMode'],
    where,
    _count: { id: true },
    _sum: { estimatedBudget: true },
  });

  return groups.map((g) => ({
    mode: g.procurementMode,
    count: g._count.id,
    totalBudget: g._sum.estimatedBudget?.toString() ?? '0',
  }));
}

export async function getSavingsAnalysis(filter: DepartmentFilter) {
  const where = deptWhere(filter);

  const projects = await prisma.project.findMany({
    where: { ...where, status: { in: ['CONTRACT_SIGNED', 'IN_EXECUTION', 'CLOSED'] } },
    select: { id: true, referenceNumber: true, estimatedBudget: true },
  });

  if (projects.length === 0) {
    return { totalEstimated: '0', totalContracted: '0', totalSavings: '0', savingsPct: 0, projects: [] };
  }

  const contractSums = await prisma.contract.groupBy({
    by: ['projectId'],
    where: {
      projectId: { in: projects.map((p) => p.id) },
      status: { notIn: ['DRAFT', 'RESILIE'] },
    },
    _sum: { totalAmount: true },
  });

  const contractMap = new Map(contractSums.map((c) => [c.projectId, c._sum.totalAmount]));

  let totalEstimated = new Prisma.Decimal(0);
  let totalContracted = new Prisma.Decimal(0);

  const breakdown = projects.map((p) => {
    const contracted = contractMap.get(p.id) ?? new Prisma.Decimal(0);
    const estimated = p.estimatedBudget;
    const savings = estimated.sub(contracted);
    const pct = estimated.gt(0) ? savings.div(estimated).mul(100).toNumber() : 0;

    totalEstimated = totalEstimated.add(estimated);
    totalContracted = totalContracted.add(contracted);

    return {
      projectId: p.id,
      reference: p.referenceNumber,
      estimated: estimated.toString(),
      contracted: contracted.toString(),
      savings: savings.toString(),
      savingsPct: Math.round(pct * 100) / 100,
    };
  });

  const totalSavings = totalEstimated.sub(totalContracted);
  const overallPct = totalEstimated.gt(0)
    ? totalSavings.div(totalEstimated).mul(100).toNumber()
    : 0;

  return {
    totalEstimated: totalEstimated.toString(),
    totalContracted: totalContracted.toString(),
    totalSavings: totalSavings.toString(),
    savingsPct: Math.round(overallPct * 100) / 100,
    projects: breakdown,
  };
}

export async function getFiscalYearTrend(filter: DepartmentFilter) {
  const where = deptWhere(filter);
  const groups = await prisma.project.groupBy({
    by: ['fiscalYear'],
    where,
    _count: { id: true },
    _sum: { estimatedBudget: true },
    orderBy: { fiscalYear: 'asc' },
  });

  return groups.map((g) => ({
    year: g.fiscalYear,
    count: g._count.id,
    totalBudget: g._sum.estimatedBudget?.toString() ?? '0',
  }));
}
