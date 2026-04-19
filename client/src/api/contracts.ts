import apiClient from './client';

// ============================================================
// Types
// ============================================================

export type ContractStatus =
  | 'DRAFT' | 'UNDER_REVIEW' | 'PENDING_VISA_LEGAL' | 'PENDING_VISA_FINANCIAL'
  | 'PENDING_APPROVAL_DG' | 'APPROVED' | 'SIGNED' | 'IN_EXECUTION'
  | 'SUSPENDED' | 'TERMINATED' | 'COMPLETED' | 'RESILIE';

export type AvenantType =
  | 'MODIFICATION_SCOPE' | 'EXTENSION_DELAY' | 'PRICE_REVISION'
  | 'ADDITIONAL_WORKS' | 'REDUCTION';

export type AvenantStatus =
  | 'DRAFT' | 'UNDER_REVIEW' | 'PENDING_CCC_APPROVAL' | 'PENDING_LEGAL_VISA'
  | 'PENDING_FINANCIAL_VISA' | 'APPROVED' | 'SIGNED' | 'REJECTED';

export interface ContractSummary {
  id: string;
  projectId: string;
  referenceNumber: string;
  titleFr: string;
  status: ContractStatus;
  totalAmount: string;
  currency: string;
  supplierId: string;
  signedAt?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  durationMonths?: number | null;
  sha256Hash?: string | null;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    referenceNumber: string;
    titleFr: string;
    status: string;
    procurementMode?: string;
  };
  _count?: { avenants: number };
}

export interface ContractDetail extends ContractSummary {
  paymentTerms?: string | null;
  retentionRate?: string | null;
  advancePaymentRate?: string | null;
  awardedBidId?: string | null;
  legalVisaById?: string | null;
  legalVisaAt?: string | null;
  financialVisaById?: string | null;
  financialVisaAt?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  filePath?: string | null;
  avenants: AvenantSummary[];
}

export interface AvenantSummary {
  id: string;
  contractId: string;
  avenantNumber: number;
  referenceNumber: string;
  type: AvenantType;
  status: AvenantStatus;
  titleFr: string;
  justification: string;
  originalAmount: string;
  amendedAmount: string;
  differenceAmount: string;
  cumulativeAvenantPct: string;
  exceedsThreshold: boolean;
  thresholdPct?: string | null;
  requiresNewTender: boolean;
  originalEndDate?: string | null;
  newEndDate?: string | null;
  requestedById: string;
  legalVisaAt?: string | null;
  financialVisaAt?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  sha256Hash?: string | null;
  createdAt: string;
  updatedAt: string;
  contract?: {
    id: string;
    referenceNumber: string;
    titleFr: string;
    totalAmount?: string;
  };
}

export interface ContractStats {
  total: number;
  draft: number;
  underReview: number;
  pendingVisa: number;
  approved: number;
  signed: number;
  inExecution: number;
  completed: number;
  totalContractValue: string;
}

export interface CumulativeDelta {
  contractId: string;
  contractReferenceNumber: string;
  originalAmount: string;
  cumulativeDelta: string;
  cumulativePct: string;
  thresholdPct: number;
  remainingHeadroom: string;
  breakdown: Array<{
    avenantNumber: number;
    referenceNumber: string;
    delta: string;
    runningTotal: string;
    runningPct: string;
  }>;
}

export interface ContractFilters {
  page?: number;
  limit?: number;
  projectId?: string;
  status?: ContractStatus;
  supplierId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'totalAmount' | 'expiryDate' | 'referenceNumber';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedContracts {
  data: ContractSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ============================================================
// API functions
// ============================================================

export async function listContracts(filters?: ContractFilters): Promise<PaginatedContracts> {
  const params: Record<string, any> = {};
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) params[k] = v;
    });
  }
  const res = await apiClient.get<PaginatedContracts>('/contracts', { params });
  return res.data;
}

export async function getContractById(id: string): Promise<ContractDetail> {
  const res = await apiClient.get<ContractDetail>(`/contracts/${id}`);
  return res.data;
}

export async function getContractStats(): Promise<ContractStats> {
  const res = await apiClient.get<ContractStats>('/contracts/stats');
  return res.data;
}

export async function createContract(data: {
  projectId: string;
  titleFr: string;
  totalAmount: number;
  supplierId: string;
  awardedBidId?: string;
  currency?: string;
  paymentTerms?: string;
  retentionRate?: number;
  advancePaymentRate?: number;
  durationMonths?: number;
  effectiveDate?: string;
  expiryDate?: string;
}): Promise<ContractSummary> {
  const res = await apiClient.post<ContractSummary>('/contracts', data);
  return res.data;
}

export async function updateContract(
  id: string,
  data: Partial<{
    titleFr: string;
    paymentTerms: string;
    retentionRate: number;
    advancePaymentRate: number;
    durationMonths: number;
    effectiveDate: string;
    expiryDate: string;
  }>
): Promise<ContractSummary> {
  const res = await apiClient.patch<ContractSummary>(`/contracts/${id}`, data);
  return res.data;
}

export async function transitionContractStatus(
  id: string,
  data: { status: ContractStatus; reason?: string; signedAt?: string }
): Promise<ContractSummary> {
  const res = await apiClient.post<ContractSummary>(`/contracts/${id}/status`, data);
  return res.data;
}

export async function getCumulativeDelta(contractId: string): Promise<CumulativeDelta> {
  const res = await apiClient.get<CumulativeDelta>(`/contracts/${contractId}/cumulative-delta`);
  return res.data;
}

// ============================================================
// Avenant API
// ============================================================

export async function listAvenants(
  contractId: string,
  params?: { page?: number; limit?: number; status?: string }
): Promise<{ data: AvenantSummary[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const res = await apiClient.get(`/contracts/${contractId}/avenants`, { params });
  return res.data;
}

export async function getAvenantById(contractId: string, avenantId: string): Promise<AvenantSummary> {
  const res = await apiClient.get<AvenantSummary>(`/contracts/${contractId}/avenants/${avenantId}`);
  return res.data;
}

export async function createAvenant(data: {
  contractId: string;
  type: AvenantType;
  titleFr: string;
  justification: string;
  amendedAmount: number;
  newEndDate?: string;
}): Promise<AvenantSummary> {
  const res = await apiClient.post<AvenantSummary>(`/contracts/${data.contractId}/avenants`, data);
  return res.data;
}

export async function updateAvenant(
  contractId: string,
  avenantId: string,
  data: Partial<{
    titleFr: string;
    justification: string;
    amendedAmount: number;
    newEndDate: string;
  }>
): Promise<AvenantSummary> {
  const res = await apiClient.patch<AvenantSummary>(`/contracts/${contractId}/avenants/${avenantId}`, data);
  return res.data;
}

export async function transitionAvenantStatus(
  contractId: string,
  avenantId: string,
  data: { status: AvenantStatus; reason?: string }
): Promise<AvenantSummary> {
  const res = await apiClient.post<AvenantSummary>(
    `/contracts/${contractId}/avenants/${avenantId}/status`,
    data
  );
  return res.data;
}
