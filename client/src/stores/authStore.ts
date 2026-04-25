import { create } from 'zustand';

export interface AuthUser {
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
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setAuth: (accessToken, user) =>
    set({ accessToken, user, isAuthenticated: true }),

  setAccessToken: (token) =>
    set({ accessToken: token }),

  logout: () =>
    set({ accessToken: null, user: null, isAuthenticated: false }),

  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    // Check exact match and scoped variants
    return user.permissions.some(
      (p) => p === permission || p.startsWith(permission + ':')
    );
  },

  hasRole: (role) => {
    const { user } = get();
    return user?.roles.includes(role) ?? false;
  },
}));
