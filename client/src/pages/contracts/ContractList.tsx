import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus, Search, Filter, ChevronUp, ChevronDown, FileText, Clock,
  CheckCircle2, AlertTriangle, Scale, Banknote,
} from 'lucide-react';
import { useContractStore } from '../../stores/contractStore';
import StatusBadge from '../../components/common/StatusBadge';
import PermissionGate from '../../components/auth/PermissionGate';

const STATUS_OPTIONS = [
  'DRAFT', 'UNDER_REVIEW', 'PENDING_VISA_LEGAL', 'PENDING_VISA_FINANCIAL',
  'PENDING_APPROVAL_DG', 'APPROVED', 'SIGNED', 'IN_EXECUTION',
  'SUSPENDED', 'TERMINATED', 'COMPLETED', 'RESILIE',
];

export default function ContractList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    contracts, pagination, filters, stats, loading, error,
    fetchContracts, fetchStats, setFilters,
  } = useContractStore();

  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchContracts(); }, [filters]);
  useEffect(() => { fetchStats(); }, []);

  function handleSearch() {
    setFilters({ search: search || undefined, page: 1 });
  }

  function handleSort(field: 'createdAt' | 'totalAmount' | 'expiryDate' | 'referenceNumber') {
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

  function formatDZD(amount: string | number) {
    return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(Number(amount));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sonatrach-navy/10 rounded-xl">
            <FileText size={24} className="text-sonatrach-navy" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sonatrach-navy">{t('contracts.title')}</h1>
            <p className="text-sm text-gray-500">{t('contracts.subtitle')}</p>
          </div>
        </div>
        <PermissionGate permission="contract:create">
          <button onClick={() => navigate('/contracts/new')} className="btn-orange flex items-center gap-2">
            <Plus size={18} />
            {t('contracts.createContract')}
          </button>
        </PermissionGate>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label={t('contracts.stats.total')} value={stats.total} icon={<FileText size={16} />} />
          <StatCard label={t('contracts.stats.draft')} value={stats.draft} icon={<Clock size={16} />} tone="gray" />
          <StatCard label={t('contracts.stats.pendingVisa')} value={stats.pendingVisa} icon={<AlertTriangle size={16} />} tone="amber" />
          <StatCard label={t('contracts.stats.approved')} value={stats.approved} icon={<CheckCircle2 size={16} />} tone="blue" />
          <StatCard label={t('contracts.stats.signed')} value={stats.signed} icon={<Scale size={16} />} tone="green" />
          <StatCard label={t('contracts.stats.inExecution')} value={stats.inExecution} icon={<FileText size={16} />} tone="indigo" />
          <StatCard label={t('contracts.stats.completed')} value={stats.completed} icon={<CheckCircle2 size={16} />} tone="gray" />
          <StatCard
            label={t('contracts.stats.totalValue')}
            value={formatDZD(stats.totalContractValue)}
            isText
            icon={<Banknote size={16} />}
            tone="default"
          />
        </div>
      )}

      {/* Search & Filters */}
      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('contracts.searchPlaceholder')}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('common.status')}</label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ status: (e.target.value || undefined) as any, page: 1 })}
                className="input-field text-sm"
              >
                <option value="">{t('common.all')}</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{t(`contracts.statuses.${s}`)}</option>
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

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('referenceNumber')}
              >
                <div className="flex items-center gap-1">
                  {t('contracts.reference')}
                  <SortIcon field="referenceNumber" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('contracts.contractTitle')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('contracts.project')}
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('totalAmount')}
              >
                <div className="flex items-center justify-end gap-1">
                  {t('contracts.amount')}
                  <SortIcon field="totalAmount" />
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('contracts.avenants')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('common.status')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('expiryDate')}
              >
                <div className="flex items-center gap-1">
                  {t('contracts.expiryDate')}
                  <SortIcon field="expiryDate" />
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
            ) : !contracts.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <FileText size={32} className="text-gray-300" />
                    {t('common.noData')}
                  </div>
                </td>
              </tr>
            ) : (
              contracts.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/contracts/${c.id}`)}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sonatrach-navy bg-sonatrach-navy/5 px-2 py-1 rounded">
                      {c.referenceNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-800 truncate max-w-[280px]">{c.titleFr}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-700 truncate max-w-[200px]">{c.project.titleFr}</div>
                    <div className="text-xs text-gray-400 font-mono">{c.project.referenceNumber}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                    {formatDZD(c.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-semibold text-gray-600">
                      {c._count?.avenants ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {c.expiryDate
                      ? new Date(c.expiryDate).toLocaleDateString('fr-FR')
                      : '—'}
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
              {t('contracts.contractsCount')}
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

function StatCard({
  label, value, icon, tone = 'default', isText = false,
}: { label: string; value: number | string; icon: React.ReactNode; tone?: string; isText?: boolean }) {
  const toneClasses: Record<string, string> = {
    default: 'bg-white border-gray-200 text-sonatrach-navy',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  };
  return (
    <div className={`p-3 border rounded-lg flex items-center gap-2 ${toneClasses[tone] || toneClasses.default}`}>
      <div className="opacity-80">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider opacity-75 truncate">{label}</div>
        <div className={`font-bold leading-tight ${isText ? 'text-xs' : 'text-lg'}`}>{value}</div>
      </div>
    </div>
  );
}
