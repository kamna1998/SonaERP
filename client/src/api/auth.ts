import apiClient from './client';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    employeeId: string;
    email: string;
    firstNameFr: string;
    lastNameFr: string;
    firstNameAr: string | null;
    lastNameAr: string | null;
    departmentId: string;
    departmentName: string;
    preferredLang: string;
    roles: string[];
    permissions: string[];
    mustChangePassword: boolean;
  };
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/login', payload);
  return res.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function getMe(): Promise<LoginResponse['user']> {
  const res = await apiClient.get<LoginResponse['user']>('/auth/me');
  return res.data;
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  await apiClient.post('/auth/change-password', payload);
}
