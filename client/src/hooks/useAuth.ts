import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import * as authApi from '../api/auth';
import i18n from '../lib/i18n';

export function useAuth() {
  const navigate = useNavigate();
  const { setAuth, logout: clearAuth, user, isAuthenticated } = useAuthStore();
  const { setLanguage } = useUIStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(email: string, password: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login({ email, password });
      setAuth(res.accessToken, res.user);

      // Set UI language from user preference
      const lang = res.user.preferredLang.toLowerCase() as 'ar' | 'fr' | 'en';
      setLanguage(lang);
      i18n.changeLanguage(lang);

      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // Continue logout even if API call fails
    }
    clearAuth();
    navigate('/login');
  }

  return { login, logout, loading, error, user, isAuthenticated };
}
