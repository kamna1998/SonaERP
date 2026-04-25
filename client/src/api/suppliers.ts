import apiClient from './client';

export interface Supplier {
  id: string;
  registrationNumber: string;
  companyNameFr: string;
  companyNameAr?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  wilaya?: string | null;
  country: string;
  isBlacklisted: boolean;
  blacklistReason?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { bids: number };
}

export interface SupplierWithBids extends Supplier {
  bids: {
    id: string;
    referenceNumber: string;
    status: string;
    receivedAt: string;
    projectId: string;
    project: { referenceNumber: string; titleFr: string };
  }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface SupplierFilters {
  page?: number;
  limit?: number;
  search?: string;
  isBlacklisted?: boolean;
  wilaya?: string;
  sortBy?: 'createdAt' | 'companyNameFr' | 'registrationNumber';
  sortOrder?: 'asc' | 'desc';
}

export async function listSuppliers(filters?: SupplierFilters): Promise<PaginatedResponse<Supplier>> {
  const params: Record<string, any> = {};
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) params[k] = v;
    });
  }
  const res = await apiClient.get<PaginatedResponse<Supplier>>('/suppliers', { params });
  return res.data;
}

export async function getSupplierById(id: string): Promise<SupplierWithBids> {
  const res = await apiClient.get<SupplierWithBids>(`/suppliers/${id}`);
  return res.data;
}

export async function createSupplier(data: Record<string, any>): Promise<Supplier> {
  const res = await apiClient.post<Supplier>('/suppliers', data);
  return res.data;
}

export async function updateSupplier(id: string, data: Record<string, any>): Promise<Supplier> {
  const res = await apiClient.patch<Supplier>(`/suppliers/${id}`, data);
  return res.data;
}

export async function setBlacklistStatus(
  id: string,
  isBlacklisted: boolean,
  reason?: string
): Promise<Supplier> {
  const res = await apiClient.patch<Supplier>(`/suppliers/${id}/blacklist`, {
    isBlacklisted,
    blacklistReason: reason,
  });
  return res.data;
}
