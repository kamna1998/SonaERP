import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Users, Calendar, CheckCircle, Clock, Gavel } from 'lucide-react';
import { useCCCStore } from '../../stores/cccStore';
import StatusBadge from '../../components/common/StatusBadge';
import PermissionGate from '../../components/auth/PermissionGate';

function getSessionState(meeting: { startedAt: string | null; endedAt: string | null }) {
  if (meeting.endedAt) return 'closed';
  if (meeting.startedAt) return 'inSession';
  return 'scheduled';
}

export default function CCCList() {
  const { t } = useTranslation();
  const { meetings, stats, pagination, loading, error, fetchMeetings, fetchStats, clearError } = useCCCStore();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchMeetings({ page, search: search || undefined });
    fetchStats();
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchMeetings({ page: 1, search: search || undefined });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sonatrach-navy">{t('ccc.title', 'Commission de Contrôle des Commandes')}</h1>
          <p className="text-gray-500 mt-1">{t('ccc.subtitle', 'Réunions CCC, votes collégiaux et décisions')}</p>
        </div>
        <PermissionGate permission="ccc:schedule">
          <Link to="/ccc/new" className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            {t('ccc.scheduleMeeting', 'Programmer une réunion')}
          </Link>
        </PermissionGate>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200 flex justify-between">
          {error}
          <button onClick={clearError} className="text-red-500 hover:text-red-700 font-medium">×</button>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: t('ccc.stats.total', 'Total'), value: stats.total, icon: <Users size={18} />, color: 'bg-blue-50 text-blue-600' },
            { label: t('ccc.stats.scheduled', 'Programmées'), value: stats.scheduled, icon: <Calendar size={18} />, color: 'bg-yellow-50 text-yellow-600' },
            { label: t('ccc.stats.inSession', 'En session'), value: stats.inSession, icon: <Clock size={18} />, color: 'bg-orange-50 text-orange-600' },
            { label: t('ccc.stats.decided', 'Décidées'), value: stats.decided, icon: <Gavel size={18} />, color: 'bg-purple-50 text-purple-600' },
            { label: t('ccc.stats.closed', 'Clôturées'), value: stats.closed, icon: <CheckCircle size={18} />, color: 'bg-green-50 text-green-600' },
          ].map((s) => (
            <div key={s.label} className="card flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-xl font-bold text-sonatrach-navy">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('ccc.searchPlaceholder', 'Rechercher par sujet ou référence projet...')}
            className="input pl-10 w-full"
          />
        </div>
        <button onClick={handleSearch} className="btn-secondary">{t('common.search', 'Rechercher')}</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-sonatrach-orange border-t-transparent rounded-full animate-spin" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">{t('common.noData', 'Aucune donnée')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-gray-500">
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">{t('ccc.subject', 'Sujet')}</th>
                <th className="pb-3 font-medium">{t('ccc.project', 'Projet')}</th>
                <th className="pb-3 font-medium">{t('ccc.phase', 'Phase')}</th>
                <th className="pb-3 font-medium">{t('ccc.scheduledAt', 'Date prévue')}</th>
                <th className="pb-3 font-medium">{t('ccc.sessionState', 'État')}</th>
                <th className="pb-3 font-medium">{t('ccc.decision', 'Décision')}</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => {
                const state = getSessionState(m);
                return (
                  <tr key={m.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-3 text-sm font-mono">{m.meetingNumber}</td>
                    <td className="py-3">
                      <Link to={`/ccc/${m.id}`} className="text-sonatrach-navy font-medium hover:underline">
                        {m.subject}
                      </Link>
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      <Link to={`/projects/${m.projectId}`} className="hover:underline">
                        {m.project.referenceNumber}
                      </Link>
                    </td>
                    <td className="py-3 text-sm">
                      {m.phase ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${m.phase === 'TECHNICAL' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {t(`ccc.phases.${m.phase}`, m.phase)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {new Date(m.scheduledAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        state === 'closed' ? 'bg-gray-100 text-gray-600' :
                        state === 'inSession' ? 'bg-green-100 text-green-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {t(`ccc.sessionStates.${state}`, state)}
                      </span>
                    </td>
                    <td className="py-3">
                      {m.decision ? <StatusBadge status={m.decision} /> : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {t('common.previous', 'Précédent')}
          </button>
          <span className="flex items-center text-sm text-gray-500">
            {t('common.page', 'Page')} {page} {t('common.of', 'sur')} {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {t('common.next', 'Suivant')}
          </button>
        </div>
      )}
    </div>
  );
}
