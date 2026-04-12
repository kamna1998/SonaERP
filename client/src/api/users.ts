import apiClient from './client';

export interface User {
  id: string;
  employeeId: string;
  email: string;
  firstNameFr: string;
  lastNameFr: string;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
  phone?: string | null;
  departmentId: string;
  department: { code: string; nameFr: string };
  preferredLang: string;
  status: string;
  lastLoginAt?: string | null;
  createdAt: string;
  roles: { code: string; nameFr: string }[];
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

export async function listUsers(params?: Record<string, any>): Promise<PaginatedResponse<User>> {
  const res = await apiClient.get<PaginatedResponse<User>>('/users', { params });
  return res.data;
}

export async function getUserById(id: string): Promise<User> {
  const res = await apiClient.get<User>(`/users/${id}`);
  return res.data;
}

export async function createUser(data: Record<string, any>): Promise<User> {
  const res = await apiClient.post<User>('/users', data);
  return res.data;
}

export async function updateUser(id: string, data: Record<string, any>): Promise<User> {
  const res = await apiClient.patch<User>(`/users/${id}`, data);
  return res.data;
}
