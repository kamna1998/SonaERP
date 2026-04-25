import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus, Search, Filter, ChevronUp, ChevronDown, FileBox, ShieldCheck, Lock, Unlock,
} from 'lucide-react';
import { useBidStore } from '../../stores/bidStore';
import StatusBadge from '../../components/common/StatusBadge';
import PermissionGate from '../../components/auth/PermissionGate';

const STATUS_OPTIONS = [
  { value: 'RECEIVED', labelKey: 'bids.statuses.RECEIVED' },
  { value: 'OPENED', labelKey: 'bids.statuses.OPENED' },
  { value: 'UNDER_EVALUATION', labelKey: 'bids.statuses.UNDER_EVALUATION' },
  { value: 'TECHNICALLY_COMPLIANT', labelKey: 'bids.statuses.TECHNICALLY_COMPLIANT' },
  { value: 'TECHNICALLY_NON_COMPLIANT', labelKey: 'bids.statuses.TECHNICALLY_NON_COMPLIANT' },
  { value: 'COMMERCIALLY_EVALUATED', labelKey: 'bids.statuses.COMMERCIALLY_EVALUATED' },
  { value: 'AWARDED', labelKey: 'bids.statuses.AWARDED' },
  { value: 'REJECTED', labelKey: 'bids.statuses.REJECTED' },
  { value: 'WITHDRAWN', labelKey: 'bids.statuses.WITHDRAWN' },
];

export default function BidList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    bids, pagination, filters, allowedVaults, loading, error,
    fetchBids, setFilters,
  } = useBidStore();

  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBids();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function handleSearch() {
    setFilters({ search: search || undefined, page: 1 });
  }

  function handleSort(field: 'receivedAt' | 'referenceNumber' | 'status' | 'rank') {
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sonatrach-navy/10 rounded-xl">
            <FileBox size={24} className="text-sonatrach-navy" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sonatrach-navy">
              {t('bids.title')}
            </h1>
            <p className="text-sm text-gray-500">{t('bids.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <ShieldCheck size={14} />
            {t('bids.vaultNotice')}
            <span className="ml-1 font-mono">
              {allowedVaults.length === 0
                ? t('bids.noVaultAccess')
                : allowedVaults.join(' + ')}
            </span>
          </div>
          <PermissionGate permission="bid:register">
            <button onClick={() => navigate('/bids/new')} className="btn-orange flex items-center gap-2">
              <Plus size={18} />
              {t('bids.register')}
            </button>
          </PermissionGate>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('bids.searchPlaceholder')}
              className="input-field pl-10"
            />
          </div>
          <button onClick={handleSearch} className="btn-primary">{t('common.search')}</button>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('common.status')}</label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ status: (e.target.value || undefined) as any, page: 1 })}
                className="input-field text-sm"
              >
                <option value="">{t('bids.allStatuses')}</option>
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
                  {t('bids.reference')}
                  <SortIcon field="referenceNumber" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('bids.supplier')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('bids.project')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('receivedAt')}
              >
                <div className="flex items-center gap-1">
                  {t('bids.receivedAt')}
                  <SortIcon field="receivedAt" />
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('bids.envelopes')}
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
              <th
                className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('rank')}
              >
                <div className="flex items-center gap-1 justify-center">
                  {t('bids.rank')}
                  <SortIcon field="rank" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <div className="w-6 h-6 border-2 border-sonatrach-orange border-t-transparent rounded-full animate-spin" />
                    {t('common.loading')}
                  </div>
                </td>
              </tr>
            ) : !bids.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <FileBox size={32} className="text-gray-300" />
                    {t('common.noData')}
                  </div>
                </td>
              </tr>
            ) : (
              bids.map((bid) => (
                <tr
                  key={bid.id}
                  onClick={() => navigate(`/bids/${bid.id}`)}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sonatrach-navy bg-sonatrach-navy/5 px-2 py-1 rounded">
                      {bid.referenceNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{bid.supplier.companyNameFr}</div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">
                      {bid.supplier.registrationNumber}
                      {bid.supplier.isBlacklisted && (
                        <span className="ml-2 text-red-700 font-semibold">⚠</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-700 truncate max-w-[250px]">{bid.project.titleFr}</div>
                    <div className="text-xs text-gray-400 font-mono">{bid.project.referenceNumber}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(bid.receivedAt).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex gap-1.5">
                      <EnvelopeIcon sealed={bid.technicalEnvelopeSealed} label="T" />
                      <EnvelopeIcon sealed={bid.commercialEnvelopeSealed} label="C" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={bid.status} />
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    {bid.rank ? <span className="font-bold">#{bid.rank}</span> : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {pagination.totalPages > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-sm text-gray-500">
              {t('common.total')}: <span className="font-semibold">{pagination.total}</span>{' '}
              {t('bids.bidsCount')}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setFilters({ page: pagination.page - 1 })}
                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
              >
                {t('common.previous')}
              </button>
              <span className="text-sm text-gray-500">
                {pagination.page} / {pagination.totalPages}
              </span>
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

function EnvelopeIcon({ sealed, label }: { sealed: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-0.5 text-xs font-mono px-1.5 py-0.5 rounded border ${
        sealed
          ? 'bg-gray-50 border-gray-300 text-gray-600'
          : 'bg-orange-50 border-orange-300 text-orange-700'
      }`}
      title={sealed ? 'Scellée' : 'Ouverte'}
    >
      {sealed ? <Lock size={10} /> : <Unlock size={10} />}
      {label}
    </div>
  );
}
