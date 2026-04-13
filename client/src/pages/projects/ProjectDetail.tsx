import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Edit, Clock, CheckCircle2, XCircle,
  Building2, User, CalendarDays, DollarSign, Hash, AlertTriangle,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import StatusBadge from '../../components/common/StatusBadge';
import PermissionGate from '../../components/auth/PermissionGate';

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['NEEDS_IDENTIFICATION', 'CANCELLED'],
  NEEDS_IDENTIFICATION: ['DTAO_PREPARATION', 'CANCELLED'],
  DTAO_PREPARATION: ['DTAO_REVIEW', 'CANCELLED'],
  DTAO_REVIEW: ['PUBLISHED', 'DTAO_PREPARATION', 'CANCELLED'],
  PUBLISHED: ['BID_RECEPTION', 'CANCELLED'],
  BID_RECEPTION: ['BID_OPENING', 'DECLARED_INFRUCTUEUX', 'CANCELLED'],
  BID_OPENING: ['TECHNICAL_EVALUATION'],
  TECHNICAL_EVALUATION: ['COMMERCIAL_EVALUATION', 'DECLARED_INFRUCTUEUX'],
  COMMERCIAL_EVALUATION: ['ADJUDICATION', 'DECLARED_INFRUCTUEUX'],
  ADJUDICATION: ['CONTRACT_DRAFTING'],
  CONTRACT_DRAFTING: ['CONTRACT_SIGNED'],
  CONTRACT_SIGNED: ['IN_EXECUTION'],
  IN_EXECUTION: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
  DECLARED_INFRUCTUEUX: ['DRAFT'],
};

const STATUS_PIPELINE = [
  'DRAFT', 'NEEDS_IDENTIFICATION', 'DTAO_PREPARATION', 'DTAO_REVIEW',
  'PUBLISHED', 'BID_RECEPTION', 'IN_EXECUTION', 'CLOSED',
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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    currentProject: project, loading, error,
    fetchProjectById, changeStatus, clearCurrent, clearError,
  } = useProjectStore();

  const [statusModal, setStatusModal] = useState<{ target: string } | null>(null);
  const [reason, setReason] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (id) fetchProjectById(id);
    return () => clearCurrent();
  }, [id]);

  const nextStatuses = project ? (VALID_STATUS_TRANSITIONS[project.status] || []) : [];

  async function handleTransition(targetStatus: string) {
    if (!id) return;
    setTransitioning(true);
    clearError();
    try {
      await changeStatus(id, targetStatus, reason || undefined);
      setStatusModal(null);
      setReason('');
    } catch {
      // error set in store
    } finally {
      setTransitioning(false);
    }
  }

  function getStepState(step: string) {
    if (!project) return 'pending';
    if (project.status === 'CANCELLED') {
      const cancelIdx = STATUS_PIPELINE.indexOf(step);
      const historyStatuses = project.statusHistory?.map((h) => h.toStatus) || [];
      if (historyStatuses.includes(step) || project.status === step) return 'completed';
      return 'pending';
    }
    if (project.status === 'DECLARED_INFRUCTUEUX') {
      const historyStatuses = project.statusHistory?.map((h) => h.toStatus) || [];
      if (historyStatuses.includes(step)) return 'completed';
      return 'pending';
    }
    const currentIdx = STATUS_PIPELINE.indexOf(project.status);
    const stepIdx = STATUS_PIPELINE.indexOf(step);
    if (stepIdx < 0) return 'pending';
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'current';
    return 'pending';
  }

  if (loading && !project) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-sonatrach-orange border-t-transparent rounded-full animate-spin" />
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/projects')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={18} /> {t('common.back')}
        </button>
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/projects')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm font-semibold text-sonatrach-navy bg-sonatrach-navy/5 px-2.5 py-1 rounded">
                {project.referenceNumber}
              </span>
              <StatusBadge status={project.status} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{project.titleFr}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{project.objectFr}</p>
          </div>
        </div>
        {project.status === 'DRAFT' && (
          <PermissionGate permission="project:update">
            <button
              onClick={() => navigate(`/projects/${project.id}/edit`)}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit size={16} />
              {t('common.edit')}
            </button>
          </PermissionGate>
        )}
      </div>

      {/* Status error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>
      )}

      {/* Status Pipeline Stepper */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
          {t('projects.detail.workflow')}
        </h2>
        <div className="flex items-center overflow-x-auto pb-2">
          {STATUS_PIPELINE.map((step, idx) => {
            const state = getStepState(step);
            return (
              <div key={step} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      state === 'completed'
                        ? 'bg-green-500 text-white'
                        : state === 'current'
                        ? 'bg-sonatrach-orange text-white ring-4 ring-sonatrach-orange/20'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {state === 'completed' ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className={`text-xs mt-1.5 whitespace-nowrap max-w-[80px] text-center truncate ${
                    state === 'current' ? 'font-semibold text-sonatrach-orange' : 'text-gray-400'
                  }`}>
                    {t(`projects.statuses.${step}`, step.replace(/_/g, ' '))}
                  </span>
                </div>
                {idx < STATUS_PIPELINE.length - 1 && (
                  <div className={`w-12 h-0.5 mx-1 ${
                    getStepState(STATUS_PIPELINE[idx + 1]) === 'completed' || state === 'completed'
                      ? 'bg-green-400'
                      : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Cancelled / Infructueux badge */}
        {(project.status === 'CANCELLED' || project.status === 'DECLARED_INFRUCTUEUX') && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <XCircle size={16} className="text-red-500" />
            <span className="font-medium text-red-600">
              {t(`projects.statuses.${project.status}`)}
            </span>
          </div>
        )}
      </div>

      {/* Status Transition Actions */}
      {nextStatuses.length > 0 && (
        <PermissionGate permission="project:change_status">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
              {t('projects.detail.actions')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((ns) => (
                <button
                  key={ns}
                  onClick={() => setStatusModal({ target: ns })}
                  className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                    ns === 'CANCELLED'
                      ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                      : 'btn-primary'
                  }`}
                >
                  {t(`projects.detail.transitionTo`)} {t(`projects.statuses.${ns}`, ns.replace(/_/g, ' '))}
                </button>
              ))}
            </div>
          </div>
        </PermissionGate>
      )}

      {/* Project Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Budget */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-sonatrach-orange" />
            <h3 className="text-sm font-semibold text-gray-600">{t('projects.budget')}</h3>
          </div>
          <p className="text-xl font-bold font-mono text-gray-900">
            {formatDZD(project.estimatedBudget)}
          </p>
          {project.budgetLineRef && (
            <p className="text-xs text-gray-400 mt-1">{t('projects.form.budgetLineRef')}: {project.budgetLineRef}</p>
          )}
          {project.isAboveNationalThreshold && (
            <div className="flex items-center gap-1 mt-2 text-amber-600 text-xs">
              <AlertTriangle size={12} />
              {t('projects.detail.aboveThreshold')}
            </div>
          )}
        </div>

        {/* Procurement Mode */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Hash size={16} className="text-sonatrach-orange" />
            <h3 className="text-sm font-semibold text-gray-600">{t('projects.procurementMode')}</h3>
          </div>
          <span className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full font-medium">
            {t(`projects.modes.${project.procurementMode}`, project.procurementMode.replace(/_/g, ' '))}
          </span>
          {project.requiresCCCApproval && (
            <p className="text-xs text-amber-600 mt-2">{t('projects.detail.requiresCCC')}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {t('projects.detail.minBids')}: {project.minimumBidCount}
          </p>
        </div>

        {/* Department & Creator */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-sonatrach-orange" />
            <h3 className="text-sm font-semibold text-gray-600">{t('users.department')}</h3>
          </div>
          <p className="text-sm font-medium text-gray-900">{project.department.nameFr}</p>
          <p className="text-xs text-gray-400">{project.department.code}</p>
          <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
            <User size={12} />
            {project.createdBy.firstNameFr} {project.createdBy.lastNameFr}
          </div>
        </div>

        {/* Fiscal Year */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays size={16} className="text-sonatrach-orange" />
            <h3 className="text-sm font-semibold text-gray-600">{t('projects.fiscalYear')}</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{project.fiscalYear}</p>
        </div>

        {/* Dates */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-sonatrach-orange" />
            <h3 className="text-sm font-semibold text-gray-600">{t('projects.detail.dates')}</h3>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('projects.detail.created')}</span>
              <span className="text-gray-900">
                {new Date(project.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            </div>
            {project.publicationDate && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t('projects.form.publicationDate')}</span>
                <span className="text-gray-900">
                  {new Date(project.publicationDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            )}
            {project.bidDeadline && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t('projects.form.bidDeadline')}</span>
                <span className="text-gray-900">
                  {new Date(project.bidDeadline).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Counts */}
        {project._count && (
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <Hash size={16} className="text-sonatrach-orange" />
              <h3 className="text-sm font-semibold text-gray-600">{t('projects.detail.counts')}</h3>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('projects.detail.bidsCount')}</span>
                <span className="font-semibold text-gray-900">{project._count.bids}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('projects.detail.contractsCount')}</span>
                <span className="font-semibold text-gray-900">{project._count.contracts}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tags */}
      {project.tags && project.tags.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
            {t('projects.form.sectionTags')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag, idx) => (
              <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status History */}
      {project.statusHistory && project.statusHistory.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
            {t('projects.detail.statusHistory')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t('common.date')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t('projects.detail.fromStatus')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t('projects.detail.toStatus')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t('projects.detail.reason')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {project.statusHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 text-gray-600">
                      {new Date(entry.changedAt).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2"><StatusBadge status={entry.fromStatus} /></td>
                    <td className="px-4 py-2"><StatusBadge status={entry.toStatus} /></td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{entry.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status Transition Modal */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {t('projects.detail.confirmTransition')}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              <StatusBadge status={project.status} />
              <span className="mx-2">&rarr;</span>
              <StatusBadge status={statusModal.target} />
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('projects.detail.reason')} ({t('projects.detail.optional')})
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('projects.detail.reasonPlaceholder')}
                className="input-field resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setStatusModal(null); setReason(''); }}
                className="btn-secondary"
                disabled={transitioning}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleTransition(statusModal.target)}
                disabled={transitioning}
                className={`flex items-center gap-2 ${
                  statusModal.target === 'CANCELLED'
                    ? 'bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-lg font-medium'
                    : 'btn-orange'
                } disabled:opacity-50`}
              >
                {transitioning && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
