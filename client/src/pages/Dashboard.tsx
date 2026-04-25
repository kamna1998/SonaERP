import { useTranslation } from 'react-i18next';
import { FolderKanban, Clock, FileText, FileSignature } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-sonatrach-navy">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-sonatrach-navy">
          {t('dashboard.welcome')}, {user?.firstNameFr} {user?.lastNameFr}
        </h1>
        <p className="text-gray-500 mt-1">
          {t('app.subtitle')} &mdash; {new Date().toLocaleDateString(
            user?.preferredLang === 'AR' ? 'ar-DZ' : user?.preferredLang === 'EN' ? 'en-US' : 'fr-FR',
            { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
          )}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FolderKanban size={24} className="text-blue-600" />}
          label={t('dashboard.activeProjects')}
          value={0}
          color="bg-blue-50"
        />
        <StatCard
          icon={<Clock size={24} className="text-yellow-600" />}
          label={t('dashboard.pendingApprovals')}
          value={0}
          color="bg-yellow-50"
        />
        <StatCard
          icon={<FileText size={24} className="text-purple-600" />}
          label={t('dashboard.openTenders')}
          value={0}
          color="bg-purple-50"
        />
        <StatCard
          icon={<FileSignature size={24} className="text-green-600" />}
          label={t('dashboard.activeContracts')}
          value={0}
          color="bg-green-50"
        />
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-sonatrach-navy mb-4">
            {t('dashboard.activeProjects')}
          </h3>
          <p className="text-gray-400 text-sm">{t('common.noData')}</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-sonatrach-navy mb-4">
            {t('dashboard.pendingApprovals')}
          </h3>
          <p className="text-gray-400 text-sm">{t('common.noData')}</p>
        </div>
      </div>
    </div>
  );
}
