import apiClient from './client';

// ============================================================
// Types
// ============================================================
export interface Project {
  id: string;
  referenceNumber: string;
  titleFr: string;
  titleAr?: string | null;
  titleEn?: string | null;
  descriptionFr?: string | null;
  descriptionAr?: string | null;
  objectFr: string;
  status: string;
  procurementMode: string;
  estimatedBudget: string;
  currency: string;
  budgetLineRef?: string | null;
  departmentId: string;
  department: { code: string; nameFr: string };
  createdById: string;
  createdBy: { id: string; firstNameFr: string; lastNameFr: string; email?: string };
  fiscalYear: number;
  isAboveNationalThreshold: boolean;
  requiresCCCApproval: boolean;
  minimumBidCount: number;
  publicationDate?: string | null;
  bidDeadline?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { bids: number; contracts: number; cccMeetings?: number };
  statusHistory?: StatusHistoryEntry[];
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: string;
  toStatus: string;
  changedById: string;
  reason?: string | null;
  changedAt: string;
}

export interface ProjectStats {
  total: number;
  active: number;
  inExecution: number;
  closed: number;
  cancelled: number;
  byStatus: Record<string, number>;
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

export interface ProjectFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  procurementMode?: string;
  departmentId?: string;
  fiscalYear?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================
// API Calls
// ============================================================
export async function listProjects(filters?: ProjectFilters): Promise<PaginatedResponse<Project>> {
  const params: Record<string, any> = {};
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) params[k] = v;
    });
  }
  const res = await apiClient.get<PaginatedResponse<Project>>('/projects', { params });
  return res.data;
}

export async function getProjectById(id: string): Promise<Project> {
  const res = await apiClient.get<Project>(`/projects/${id}`);
  return res.data;
}

export async function createProject(data: Record<string, any>): Promise<Project> {
  const res = await apiClient.post<Project>('/projects', data);
  return res.data;
}

export async function updateProject(id: string, data: Record<string, any>): Promise<Project> {
  const res = await apiClient.patch<Project>(`/projects/${id}`, data);
  return res.data;
}

export async function changeProjectStatus(
  id: string,
  status: string,
  reason?: string
): Promise<Project> {
  const res = await apiClient.patch<Project>(`/projects/${id}/status`, { status, reason });
  return res.data;
}

export async function getProjectStats(): Promise<ProjectStats> {
  const res = await apiClient.get<ProjectStats>('/projects/stats');
  return res.data;
}
