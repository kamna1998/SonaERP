import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import i18n from '../lib/i18n';

export default function Login() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { language, setLanguage } = useUIStore();

  if (isAuthenticated) return <Navigate to="/" replace />;

  function switchLang(lang: 'ar' | 'fr' | 'en') {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sonatrach-navy to-sonatrach-navy-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Language switcher */}
        <div className="flex justify-center gap-2 mb-6">
          {(['fr', 'en', 'ar'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => switchLang(lang)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                language === lang
                  ? 'bg-sonatrach-orange text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {lang === 'fr' ? 'FR' : lang === 'en' ? 'EN' : 'عربي'}
            </button>
          ))}
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-sonatrach-orange rounded-xl mb-4">
              <span className="text-white font-bold text-2xl">S</span>
            </div>
            <h1 className="text-2xl font-bold text-sonatrach-navy">
              {t('auth.loginTitle')}
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              {t('auth.loginSubtitle')}
            </p>
          </div>

          <LoginForm />
        </div>

        {/* Footer */}
        <p className="text-center text-white/40 text-xs mt-6">
          SonaERP v5.0 &copy; {new Date().getFullYear()} Sonatrach
        </p>
      </div>
    </div>
  );
}
