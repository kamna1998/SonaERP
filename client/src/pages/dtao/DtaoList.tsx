import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Filter, ChevronUp, ChevronDown, FileStack, ShieldCheck } from 'lucide-react';
import { useDtaoStore } from '../../stores/dtaoStore';
import StatusBadge from '../../components/common/StatusBadge';

const STATUS_OPTIONS = [
  { value: 'DRAFT', labelKey: 'dtao.statuses.DRAFT' },
  { value: 'UNDER_REVIEW', labelKey: 'dtao.statuses.UNDER_REVIEW' },
  { value: 'APPROVED', labelKey: 'dtao.statuses.APPROVED' },
  { value: 'PUBLISHED', labelKey: 'dtao.statuses.PUBLISHED' },
  { value: 'AMENDED', labelKey: 'dtao.statuses.AMENDED' },
  { value: 'CANCELLED', labelKey: 'dtao.statuses.CANCELLED' },
];

export default function DtaoList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dtaos, pagination, filters, loading, error, fetchDtaos, setFilters } = useDtaoStore();

  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDtaos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function handleSearch() {
    setFilters({ search: search || undefined, page: 1 });
  }

  function handleSort(field: 'createdAt' | 'referenceNumber' | 'status') {
    if (filters.sortBy === field) {
      setFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      setFilters({ sortBy: field, sortOrder: 'desc' });
    }
  }

  function SortIcon({ field }: { field: string }) {
    if (filters.sortBy !== field) return <ChevronDown size={14} className="text-gray-300" />;
    return filters.sortOrder === 'asc'
      ? <ChevronUp size={14} className="text-sonatrach-orange" />
      : <ChevronDown size={14} className="text-sonatrach-orange" />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sonatrach-navy/10 rounded-xl">
            <FileStack size={24} className="text-sonatrach-navy" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sonatrach-navy">
              {t('dtao.title')}
            </h1>
            <p className="text-sm text-gray-500">{t('dtao.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <ShieldCheck size={14} />
          {t('dtao.vaultNotice')}
        </div>
      </div>

      {/* Search + Filter */}
      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('dtao.searchPlaceholder')}
              className="input-field pl-10"
            />
          </div>
          <button onClick={handleSearch} className="btn-primary">
            {t('common.search')}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-gray-100' : ''}`}
          >
            <Filter size={16} />
            {t('common.filter')}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t('common.status')}
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ status: (e.target.value || undefined) as any, page: 1 })}
                className="input-field text-sm"
              >
                <option value="">{t('dtao.allStatuses')}</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch('');
                  setFilters({ search: undefined, status: undefined, page: 1 });
                }}
                className="btn-secondary text-sm w-full"
              >
                {t('projects.clearFilters')}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('referenceNumber')}
              >
                <div className="flex items-center gap-1">
                  {t('dtao.reference')}
                  <SortIcon field="referenceNumber" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('dtao.project')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('dtao.version')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  {t('common.status')}
                  <SortIcon field="status" />
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('dtao.docCount')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center gap-1">
                  {t('common.date')}
                  <SortIcon field="createdAt" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <div className="w-6 h-6 border-2 border-sonatrach-orange border-t-transparent rounded-full animate-spin" />
                    {t('common.loading')}
                  </div>
                </td>
              </tr>
            ) : !dtaos.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <FileStack size={32} className="text-gray-300" />
                    {t('common.noData')}
                  </div>
                </td>
              </tr>
            ) : (
              dtaos.map((dtao) => (
                <tr
                  key={dtao.id}
                  onClick={() => navigate(`/dtao/${dtao.id}`)}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sonatrach-navy bg-sonatrach-navy/5 px-2 py-1 rounded">
                      {dtao.referenceNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 truncate max-w-xs">
                      {dtao.project.titleFr}
                    </div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">
                      {dtao.project.referenceNumber}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                    v{dtao.versionMajor}.{dtao.versionMinor}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={dtao.status} />
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {dtao._count?.documents ?? 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(dtao.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {pagination.totalPages > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-sm text-gray-500">
              {t('common.total')}: <span className="font-semibold">{pagination.total}</span> {t('dtao.dtaosCount')}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setFilters({ page: pagination.page - 1 })}
                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
              >
                {t('common.previous')}
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                  const start = Math.max(1, pagination.page - 2);
                  const pageNum = start + i;
                  if (pageNum > pagination.totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setFilters({ page: pageNum })}
                      className={`w-8 h-8 rounded text-xs font-medium ${
                        pageNum === pagination.page
                          ? 'bg-sonatrach-navy text-white'
                          : 'hover:bg-gray-200 text-gray-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setFilters({ page: pagination.page + 1 })}
                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
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
