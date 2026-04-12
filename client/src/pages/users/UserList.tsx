import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import { listUsers, type User, type PaginatedResponse } from '../../api/users';
import StatusBadge from '../../components/common/StatusBadge';
import PermissionGate from '../../components/auth/PermissionGate';

export default function UserList() {
  const { t } = useTranslation();
  const [data, setData] = useState<PaginatedResponse<User> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listUsers({ page, limit: 20, search: search || undefined })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-sonatrach-navy">{t('users.title')}</h1>
        <PermissionGate permission="user:create">
          <button className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            {t('users.createUser')}
          </button>
        </PermissionGate>
      </div>

      {/* Search bar */}
      <div className="card">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('common.search')}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">{t('users.employeeId')}</th>
              <th className="px-4 py-3 text-left">{t('users.lastName')}</th>
              <th className="px-4 py-3 text-left">{t('users.firstName')}</th>
              <th className="px-4 py-3 text-left">{t('auth.email')}</th>
              <th className="px-4 py-3 text-left">{t('users.department')}</th>
              <th className="px-4 py-3 text-left">{t('users.role')}</th>
              <th className="px-4 py-3 text-left">{t('users.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  {t('common.loading')}
                </td>
              </tr>
            ) : !data?.data.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  {t('common.noData')}
                </td>
              </tr>
            ) : (
              data.data.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{user.employeeId}</td>
                  <td className="px-4 py-3 font-medium">{user.lastNameFr}</td>
                  <td className="px-4 py-3">{user.firstNameFr}</td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">{user.department.nameFr}</td>
                  <td className="px-4 py-3">
                    {user.roles.map((r) => (
                      <span
                        key={r.code}
                        className="inline-block bg-sonatrach-navy/10 text-sonatrach-navy text-xs px-2 py-0.5 rounded mr-1"
                      >
                        {r.nameFr}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={user.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              {t('common.total')}: {data.pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
              >
                {t('common.previous')}
              </button>
              <span className="text-sm text-gray-600 flex items-center">
                {t('common.page')} {page} {t('common.of')} {data.pagination.totalPages}
              </span>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
