import apiClient from './client';

// ============================================================
// Types
// ============================================================
export type DtaoStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'AMENDED'
  | 'CANCELLED';

export type VaultType = 'TECHNICAL' | 'COMMERCIAL';

export interface DtaoSummary {
  id: string;
  referenceNumber: string;
  projectId: string;
  project: {
    id: string;
    referenceNumber: string;
    titleFr: string;
    procurementMode: string;
    departmentId: string;
    department?: { code: string; nameFr: string };
  };
  status: DtaoStatus;
  versionMajor: number;
  versionMinor: number;
  technicalSpecHash?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  createdById: string;
  createdBy: { id: string; firstNameFr: string; lastNameFr: string };
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number };
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  sha256Hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  isSealed: boolean;
  sealedAt?: string | null;
  sealedById?: string | null;
  uploadedById: string;
  uploadedBy?: { id: string; firstNameFr: string; lastNameFr: string };
  createdAt: string;
}

export interface DtaoDocument {
  id: string;
  dtaoId: string;
  documentType: string;
  titleFr: string;
  vault: VaultType;
  latestVersionId?: string | null;
  latestVersion?: DocumentVersion | null;
  versions?: DocumentVersion[];
  isSealed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChecklistItem {
  documentType: string;
  required: boolean;
  provided: boolean;
  sealed: boolean;
  vault: VaultType;
}

export interface DtaoDetail extends DtaoSummary {
  documents: DtaoDocument[];
  checklist: DocumentChecklistItem[];
  statusHistory?: StatusHistoryEntry[];
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: string;
  toStatus: string;
  changedById: string;
  changedBy?: { firstNameFr: string; lastNameFr: string };
  reason?: string | null;
  changedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DtaoFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: DtaoStatus;
  projectId?: string;
  sortBy?: 'createdAt' | 'referenceNumber' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// ============================================================
// API Calls
// ============================================================
export async function listDtaos(filters?: DtaoFilters): Promise<PaginatedResponse<DtaoSummary>> {
  const params: Record<string, any> = {};
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) params[k] = v;
    });
  }
  const res = await apiClient.get<PaginatedResponse<DtaoSummary>>('/dtao', { params });
  return res.data;
}

export async function getDtaoById(id: string): Promise<DtaoDetail> {
  const res = await apiClient.get<DtaoDetail>(`/dtao/${id}`);
  return res.data;
}

export async function createDtao(projectId: string): Promise<DtaoSummary> {
  const res = await apiClient.post<DtaoSummary>('/dtao', { projectId });
  return res.data;
}

export async function changeDtaoStatus(
  id: string,
  status: DtaoStatus,
  reason?: string
): Promise<DtaoSummary> {
  const res = await apiClient.patch<DtaoSummary>(`/dtao/${id}/status`, { status, reason });
  return res.data;
}

export async function listDocuments(dtaoId: string): Promise<DtaoDocument[]> {
  const res = await apiClient.get<{ documents: DtaoDocument[] }>(`/dtao/${dtaoId}/documents`);
  return res.data.documents;
}

export async function createDocument(
  dtaoId: string,
  data: { documentType: string; titleFr: string; vault?: VaultType }
): Promise<DtaoDocument> {
  const res = await apiClient.post<DtaoDocument>(`/dtao/${dtaoId}/documents`, data);
  return res.data;
}

export async function createDocumentVersion(
  docId: string,
  data: { content: string; fileName: string; mimeType?: string; isSealed?: boolean }
): Promise<DocumentVersion> {
  const res = await apiClient.post<DocumentVersion>(`/dtao/documents/${docId}/versions`, data);
  return res.data;
}

export async function sealDocument(docId: string): Promise<DtaoDocument> {
  const res = await apiClient.post<DtaoDocument>(`/dtao/documents/${docId}/seal`);
  return res.data;
}
