export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  tokens: AuthTokens;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  employeeId: string;
  email: string;
  firstNameFr: string;
  lastNameFr: string;
  firstNameAr?: string;
  lastNameAr?: string;
  departmentId: string;
  departmentName: string;
  preferredLang: string;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
}
