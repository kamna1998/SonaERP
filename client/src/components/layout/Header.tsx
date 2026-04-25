import { useTranslation } from 'react-i18next';
import { Menu, LogOut, Globe, Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import i18n from '../../lib/i18n';

export default function Header() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { language, setLanguage, toggleSidebar } = useUIStore();
  const user = useAuthStore((s) => s.user);

  function cycleLang() {
    const langs: Array<'fr' | 'en' | 'ar'> = ['fr', 'en', 'ar'];
    const idx = langs.indexOf(language);
    const next = langs[(idx + 1) % langs.length];
    setLanguage(next);
    i18n.changeLanguage(next);
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>
        <h2 className="text-lg font-semibold text-sonatrach-navy hidden sm:block">
          {t('app.title')}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={cycleLang}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-sm font-medium text-gray-600 transition-colors"
          title="Switch language"
        >
          <Globe size={16} />
          <span>{language.toUpperCase()}</span>
        </button>

        {/* Notifications placeholder */}
        <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 relative">
          <Bell size={18} />
        </button>

        {/* User info */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
          <div className="w-8 h-8 bg-sonatrach-orange rounded-full flex items-center justify-center text-white text-sm font-medium">
            {user?.firstNameFr.charAt(0)}
            {user?.lastNameFr.charAt(0)}
          </div>
          <div className="text-sm">
            <p className="font-medium text-gray-700">
              {user?.firstNameFr} {user?.lastNameFr}
            </p>
            <p className="text-xs text-gray-500">{user?.roles[0] || ''}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
          title={t('auth.logout')}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
