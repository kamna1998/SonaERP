import { ProcurementMode } from '@prisma/client';

export interface ThresholdRule {
  maxAmount?: number;
  minAmount?: number;
  minSuppliers?: number;
  requiresCCC: boolean;
  requiresDGApproval: boolean;
  requiresFinanceVisa: boolean;
}

export const PROCUREMENT_THRESHOLDS: Record<string, ThresholdRule> = {
  COMMANDE_SANS_CONSULT: {
    maxAmount: 1_000_000,
    requiresCCC: false,
    requiresDGApproval: false,
    requiresFinanceVisa: false,
  },
  GRE_A_GRE_SIMPLE: {
    maxAmount: 6_000_000,
    requiresCCC: false,
    requiresDGApproval: false,
    requiresFinanceVisa: false,
  },
  CONSULTATION_DIRECTE: {
    maxAmount: 12_000_000,
    minSuppliers: 3,
    requiresCCC: false,
    requiresDGApproval: false,
    requiresFinanceVisa: true,
  },
  APPEL_OFFRES_OUVERT: {
    minAmount: 12_000_001,
    requiresCCC: true,
    requiresDGApproval: true,
    requiresFinanceVisa: true,
  },
  APPEL_OFFRES_RESTREINT: {
    minAmount: 12_000_001,
    requiresCCC: true,
    requiresDGApproval: true,
    requiresFinanceVisa: true,
  },
};

export const NATIONAL_THRESHOLD = 100_000_000;

export const AVENANT_THRESHOLDS = {
  works: 10,     // 10% of original contract value
  supplies: 20,  // 20%
  services: 20,  // 20%
};

/**
 * Determines the valid procurement modes for a given estimated budget amount.
 */
export function getValidProcurementModes(amountDZD: number): ProcurementMode[] {
  const modes: ProcurementMode[] = [];

  if (amountDZD <= 1_000_000) {
    modes.push(ProcurementMode.COMMANDE_SANS_CONSULT);
  }
  if (amountDZD <= 6_000_000) {
    modes.push(ProcurementMode.GRE_A_GRE_SIMPLE);
    modes.push(ProcurementMode.CONSULTATION_DIRECTE);
  }
  if (amountDZD <= 12_000_000 && amountDZD > 1_000_000) {
    modes.push(ProcurementMode.CONSULTATION_DIRECTE);
  }
  if (amountDZD > 12_000_000) {
    modes.push(ProcurementMode.APPEL_OFFRES_OUVERT);
    modes.push(ProcurementMode.APPEL_OFFRES_RESTREINT);
  }

  // Gre a gre apres consultation is always possible after a failed tender
  modes.push(ProcurementMode.GRE_A_GRE_APRES_CONSULT);

  // Deduplicate
  return [...new Set(modes)];
}

/**
 * Checks if the estimated budget exceeds the national threshold.
 */
export function isAboveNationalThreshold(amountDZD: number): boolean {
  return amountDZD > NATIONAL_THRESHOLD;
}

/**
 * Checks if cumulative avenant percentage exceeds the allowed threshold.
 */
export function exceedsAvenantThreshold(
  cumulativePct: number,
  category: 'works' | 'supplies' | 'services'
): boolean {
  return cumulativePct > AVENANT_THRESHOLDS[category];
}
