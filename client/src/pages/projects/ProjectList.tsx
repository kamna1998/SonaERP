import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Filter, ChevronUp, ChevronDown, FolderKanban } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import StatusBadge from '../../components/common/StatusBadge';
import PermissionGate from '../../components/auth/PermissionGate';

const PROCUREMENT_MODE_OPTIONS = [
  { value: '', label: '' },
  { value: 'APPEL_OFFRES_OUVERT', labelKey: 'projects.modes.appelOffresOuvert' },
  { value: 'APPEL_OFFRES_RESTREINT', labelKey: 'projects.modes.appelOffresRestreint' },
  { value: 'CONSULTATION_DIRECTE', labelKey: 'projects.modes.consultationDirecte' },
  { value: 'GRE_A_GRE_SIMPLE', labelKey: 'projects.modes.greAGreSimple' },
  { value: 'GRE_A_GRE_APRES_CONSULT', labelKey: 'projects.modes.greAGreApresConsult' },
  { value: 'COMMANDE_SANS_CONSULT', labelKey: 'projects.modes.commandeSansConsult' },
];

const STATUS_OPTIONS = [
  { value: '', label: '' },
  { value: 'DRAFT', labelKey: 'projects.statuses.DRAFT' },
  { value: 'NEEDS_IDENTIFICATION', labelKey: 'projects.statuses.NEEDS_IDENTIFICATION' },
  { value: 'DTAO_PREPARATION', labelKey: 'projects.statuses.DTAO_PREPARATION' },
  { value: 'DTAO_REVIEW', labelKey: 'projects.statuses.DTAO_REVIEW' },
  { value: 'PUBLISHED', labelKey: 'projects.statuses.PUBLISHED' },
  { value: 'BID_RECEPTION', labelKey: 'projects.statuses.BID_RECEPTION' },
  { value: 'IN_EXECUTION', labelKey: 'projects.statuses.IN_EXECUTION' },
  { value: 'CLOSED', labelKey: 'projects.statuses.CLOSED' },
  { value: 'CANCELLED', labelKey: 'projects.statuses.CANCELLED' },
];

function formatDZD(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export default function ProjectList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    projects, pagination, filters, loading, error,
    fetchProjects, setFilters,
  } = useProjectStore();

  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProjects();
  }, [filters]);

  function handleSearch() {
    setFilters({ search: search || undefined, page: 1 });
  }

  function handleSort(field: string) {
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
            <FolderKanban size={24} className="text-sonatrach-navy" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sonatrach-navy">
              {t('projects.title')}
            </h1>
            <p className="text-sm text-gray-500">{t('projects.subtitle')}</p>
          </div>
        </div>
        <PermissionGate permission="project:create">
          <button
            onClick={() => navigate('/projects/new')}
            className="btn-orange flex items-center gap-2"
          >
            <Plus size={18} />
            {t('projects.createProject')}
          </button>
        </PermissionGate>
      </div>

      {/* Search + Filter Bar */}
      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('projects.searchPlaceholder')}
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

        {/* Expanded Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t('common.status')}
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ status: e.target.value || undefined, page: 1 })}
                className="input-field text-sm"
              >
                <option value="">{t('projects.allStatuses')}</option>
                {STATUS_OPTIONS.filter((s) => s.value).map((s) => (
                  <option key={s.value} value={s.value}>{t(s.labelKey!)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t('projects.procurementMode')}
              </label>
              <select
                value={filters.procurementMode || ''}
                onChange={(e) => setFilters({ procurementMode: e.target.value || undefined, page: 1 })}
                className="input-field text-sm"
              >
                <option value="">{t('projects.allModes')}</option>
                {PROCUREMENT_MODE_OPTIONS.filter((m) => m.value).map((m) => (
                  <option key={m.value} value={m.value}>{t(m.labelKey!)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t('projects.fiscalYear')}
              </label>
              <select
                value={filters.fiscalYear || ''}
                onChange={(e) => setFilters({ fiscalYear: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
                className="input-field text-sm"
              >
                <option value="">{t('projects.allYears')}</option>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch('');
                  setFilters({ search: undefined, status: undefined, procurementMode: undefined, fiscalYear: undefined, page: 1 });
                }}
                className="btn-secondary text-sm w-full"
              >
                {t('projects.clearFilters')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
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
                  {t('projects.reference')}
                  <SortIcon field="referenceNumber" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('titleFr')}
              >
                <div className="flex items-center gap-1">
                  {t('projects.projectTitle')}
                  <SortIcon field="titleFr" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('projects.procurementMode')}
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('estimatedBudget')}
              >
                <div className="flex items-center justify-end gap-1">
                  {t('projects.budget')}
                  <SortIcon field="estimatedBudget" />
                </div>
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('users.department')}
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
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <div className="w-6 h-6 border-2 border-sonatrach-orange border-t-transparent rounded-full animate-spin" />
                    {t('common.loading')}
                  </div>
                </td>
              </tr>
            ) : !projects.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <FolderKanban size={32} className="text-gray-300" />
                    {t('common.noData')}
                  </div>
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sonatrach-navy bg-sonatrach-navy/5 px-2 py-1 rounded">
                      {project.referenceNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 truncate max-w-xs">
                      {project.titleFr}
                    </div>
                    <div className="text-xs text-gray-400 truncate max-w-xs mt-0.5">
                      {project.objectFr}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                      {t(`projects.modes.${project.procurementMode}`, project.procurementMode.replace(/_/g, ' '))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-medium text-gray-800">
                    {formatDZD(project.estimatedBudget)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={project.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {project.department.nameFr}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(project.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-sm text-gray-500">
              {t('common.total')}: <span className="font-semibold">{pagination.total}</span> {t('projects.projectsCount')}
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
