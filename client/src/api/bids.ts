import apiClient from './client';

export type BidStatus =
  | 'RECEIVED'
  | 'OPENED'
  | 'UNDER_EVALUATION'
  | 'TECHNICALLY_COMPLIANT'
  | 'TECHNICALLY_NON_COMPLIANT'
  | 'COMMERCIALLY_EVALUATED'
  | 'AWARDED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type EnvelopeType = 'TECHNICAL' | 'COMMERCIAL';

export interface BidEnvelope {
  id: string;
  bidId: string;
  envelopeType: EnvelopeType;
  filePath: string;
  fileName: string;
  fileSize: number;
  sha256Hash: string;
  openedAt?: string | null;
  openedInMeetingId?: string | null;
  isSealed: boolean;
  createdAt: string;
}

export interface BidSummary {
  id: string;
  projectId: string;
  supplierId: string;
  referenceNumber: string;
  status: BidStatus;
  receivedAt: string;
  receivedByName: string;
  technicalEnvelopeSealed: boolean;
  commercialEnvelopeSealed: boolean;
  technicalScore?: string | null;
  commercialScore?: string | null;
  compositeScore?: string | null;
  rank?: number | null;
  hasBidBond: boolean;
  bidBondAmount?: string | null;
  bidBondExpiryDate?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: string;
    registrationNumber: string;
    companyNameFr: string;
    isBlacklisted: boolean;
  };
  project: {
    id: string;
    referenceNumber: string;
    titleFr: string;
    procurementMode: string;
    status: string;
    bidDeadline?: string | null;
    estimatedBudget?: string;
  };
  _count?: { envelopes: number; evaluations: number };
}

export interface BidDetail extends BidSummary {
  envelopes: BidEnvelope[];
  evaluations: Array<{
    id: string;
    criterionCode: string;
    criterionLabel: string;
    maxScore: string;
    givenScore: string;
    envelopeType: EnvelopeType;
    evaluatedAt: string;
    evaluator?: { id: string; firstNameFr: string; lastNameFr: string };
    justification?: string | null;
  }>;
  meta?: {
    allowedVaults: EnvelopeType[];
    hiddenEnvelopes: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  meta?: { allowedVaults: EnvelopeType[] };
}

export interface BidFilters {
  page?: number;
  limit?: number;
  projectId?: string;
  supplierId?: string;
  status?: BidStatus;
  search?: string;
  sortBy?: 'receivedAt' | 'referenceNumber' | 'status' | 'rank';
  sortOrder?: 'asc' | 'desc';
}

export async function listBids(filters?: BidFilters): Promise<PaginatedResponse<BidSummary>> {
  const params: Record<string, any> = {};
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) params[k] = v;
    });
  }
  const res = await apiClient.get<PaginatedResponse<BidSummary>>('/bids', { params });
  return res.data;
}

export async function getBidById(id: string): Promise<BidDetail> {
  const res = await apiClient.get<BidDetail>(`/bids/${id}`);
  return res.data;
}

export async function getBidsByProject(projectId: string) {
  const res = await apiClient.get<{ data: BidSummary[]; meta: { allowedVaults: EnvelopeType[] } }>(
    `/bids/by-project/${projectId}`
  );
  return res.data;
}

export async function registerBid(data: {
  projectId: string;
  supplierId: string;
  receivedByName: string;
  receivedAt?: string;
  hasBidBond?: boolean;
  bidBondAmount?: number | string;
  bidBondExpiryDate?: string;
}): Promise<BidSummary> {
  const res = await apiClient.post<BidSummary>('/bids', data);
  return res.data;
}

export async function uploadEnvelope(
  bidId: string,
  data: { envelopeType: EnvelopeType; content: string; fileName: string }
): Promise<BidEnvelope> {
  const res = await apiClient.post<BidEnvelope>(`/bids/${bidId}/envelopes`, data);
  return res.data;
}

export async function openEnvelope(
  bidId: string,
  data: { envelopeType: EnvelopeType; meetingId?: string; witnessNote?: string }
): Promise<BidEnvelope> {
  const res = await apiClient.post<BidEnvelope>(`/bids/${bidId}/open-envelope`, data);
  return res.data;
}

export async function changeBidStatus(
  id: string,
  status: BidStatus,
  reason?: string
): Promise<BidSummary> {
  const res = await apiClient.patch<BidSummary>(`/bids/${id}/status`, { status, reason });
  return res.data;
}
