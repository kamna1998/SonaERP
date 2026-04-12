import { useAuthStore } from '../stores/authStore';

export function usePermission() {
  const { hasPermission, hasRole, user } = useAuthStore();

  return {
    can: hasPermission,
    hasRole,
    roles: user?.roles ?? [],
    permissions: user?.permissions ?? [],
  };
}
