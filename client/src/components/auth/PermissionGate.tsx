import { useAuthStore } from '../../stores/authStore';

interface PermissionGateProps {
  permission?: string;
  role?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function PermissionGate({
  permission,
  role,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, hasRole } = useAuthStore();

  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  if (role && !hasRole(role)) return <>{fallback}</>;

  return <>{children}</>;
}
