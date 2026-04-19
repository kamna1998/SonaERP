import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, FileText, Banknote, Calendar, Building2, Plus,
  CheckCircle2, Clock, AlertTriangle, Shield, Hash, ChevronRight,
  Scale, Gavel, XCircle,
} from 'lucide-react';
import { useContractStore } from '../../stores/contractStore';
import { useAuthStore } from '../../stores/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import PermissionGate from '../../components/auth/PermissionGate';
import type { ContractStatus, AvenantStatus } from '../../api/contracts';

// Mirror server VALID_CONTRACT_TRANSITIONS
const VALID_CONTRACT_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['PENDING_VISA_LEGAL', 'DRAFT'],
  PENDING_VISA_LEGAL: ['PENDING_VISA_FINANCIAL'],
  PENDING_VISA_FINANCIAL: ['PENDING_APPROVAL_DG'],
  PENDING_APPROVAL_DG: ['APPROVED', 'UNDER_REVIEW'],
  APPROVED: ['SIGNED'],
  SIGNED: ['IN_EXECUTION'],
  IN_EXECUTION: ['COMPLETED', 'SUSPENDED', 'TERMINATED', 'RESILIE'],
  SUSPENDED: ['IN_EXECUTION', 'TERMINATED', 'RESILIE'],
  TERMINATED: [],
  COMPLETED: [],
  RESILIE: [],
};

// Permission needed per target status
const STATUS_PERMISSION: Record<string, string> = {
  UNDER_REVIEW: 'contract:update',
  PENDING_VISA_LEGAL: 'contract:update',
  PENDING_VISA_FINANCIAL: 'contract:visa_legal',
  PENDING_APPROVAL_DG: 'contract:visa_financial',
  APPROVED: 'contract:approve',
  SIGNED: 'contract:sign',
  IN_EXECUTION: 'contract:sign',
  COMPLETED: 'contract:update',
  SUSPENDED: 'contract:update',
  TERMINATED: 'contract:update',
  RESILIE: 'contract:update',
};

function formatDZD(amount: string | number | null | undefined, currency = 'DZD'): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(num)) return '—';
  if (currency === 'DZD') {
    return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(num);
  }
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(num);
}

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('fr-FR');
}

// ─── Financial Impact Gauge ──────────────────────────────────────────────────

function FinancialGauge({ pct, remainingHeadroom, totalValue }: {
  pct: number;
  remainingHeadroom: string;
  totalValue: string;
}) {
  const { t } = useTranslation();
  const clamped = Math.min(pct, 100);
  const color = pct >= 20 ? 'bg-red-500' : pct >= 16 ? 'bg-amber-500' : 'bg-green-500';
  const textColor = pct >= 20 ? 'text-red-700' : pct >= 16 ? 'text-amber-700' : 'text-green-700';

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{t('contracts.cumulativeDelta')}</span>
        <span className={`font-semibold ${textColor}`}>{pct.toFixed(2)}% / 20%</span>
      </div>
      <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden">
        {/* threshold marker at 80% of bar (=16% of contract) */}
        <div className="absolute top-0 bottom-0 w-px bg-amber-400" style={{ left: '80%' }} />
        {/* threshold marker at 100% of bar (=20% of contract) */}
        <div className="absolute top-0 bottom-0 w-px bg-red-400" style={{ left: '100%' }} />
        <div className={`h-full ${color} transition-all`} style={{ width: `${clamped * 5}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>0%</span>
        <span className="text-amber-500">16%</span>
        <span className="text-red-500">20%</span>
      </div>
      <div className="flex items-center justify-between text-xs mt-1">
        <span className="text-gray-500">{t('contracts.remainingHeadroom')}</span>
        <span className="font-mono font-semibold text-gray-700">{formatDZD(remainingHeadroom)}</span>
      </div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-sonatrach-navy">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Avenant status badge colours ────────────────────────────────────────────

const AVENANT_BADGE: Record<AvenantStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  UNDER_REVIEW: 'bg-blue-100 text-blue-700',
  PENDING_CCC_APPROVAL: 'bg-amber-100 text-amber-700',
  PENDING_LEGAL_VISA: 'bg-purple-100 text-purple-700',
  PENDING_FINANCIAL_VISA: 'bg-indigo-100 text-indigo-700',
  APPROVED: 'bg-green-100 text-green-700',
  SIGNED: 'bg-green-200 text-green-800',
  REJECTED: 'bg-red-100 text-red-700',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContractDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const {
    currentContract, cumulativeDelta, loading, error,
    fetchContractById, fetchCumulativeDelta, transitionStatus, clearCurrent, clearError,
  } = useContractStore();

  // Status transition modal
  const [pendingStatus, setPendingStatus] = useState<ContractStatus | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [signedAt, setSignedAt] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchContractById(id);
      fetchCumulativeDelta(id);
    }
    return () => clearCurrent();
  }, [id]);

  if (loading && !currentContract) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-sonatrach-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentContract) {
    return (
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
        {error || t('common.notFound')}
      </div>
    );
  }

  const c = currentContract;
  const availableTransitions = VALID_CONTRACT_TRANSITIONS[c.status] ?? [];

  async function handleTransition() {
    if (!pendingStatus || !id) return;
    setTransitioning(true);
    setStatusError(null);
    try {
      await transitionStatus(id, pendingStatus, statusReason || undefined, pendingStatus === 'SIGNED' && signedAt ? new Date(signedAt).toISOString() : undefined);
      await fetchCumulativeDelta(id);
      setPendingStatus(null);
      setStatusReason('');
      setSignedAt('');
    } catch (err: any) {
      setStatusError(err?.message || t('common.error'));
    } finally {
      setTransitioning(false);
    }
  }

  const deltaData = cumulativeDelta;
  const cumulativePct = deltaData ? parseFloat(deltaData.cumulativePct) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Back */}
      <button onClick={() => navigate('/contracts')} className="btn-secondary flex items-center gap-2 text-sm">
        <ArrowLeft size={16} />
        {t('common.back')}
      </button>

      {/* Header */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-sonatrach-navy/10 rounded-xl mt-0.5">
              <FileText size={22} className="text-sonatrach-navy" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-sonatrach-navy bg-sonatrach-navy/5 px-2 py-1 rounded">
                  {c.referenceNumber}
                </span>
                <StatusBadge status={c.status} />
              </div>
              <h1 className="text-xl font-bold text-sonatrach-navy mt-1">{c.titleFr}</h1>
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <Building2 size={13} />
                <span>{t('contracts.project')}:</span>
                <Link to={`/projects/${c.project.id}`} className="text-sonatrach-navy hover:underline font-medium">
                  {c.project.referenceNumber} — {c.project.titleFr}
                </Link>
              </div>
            </div>
          </div>

          {/* Transition buttons */}
          {availableTransitions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableTransitions.map((target) => {
                const perm = STATUS_PERMISSION[target];
                if (perm && !hasPermission(perm)) return null;
                return (
                  <button
                    key={target}
                    onClick={() => { setPendingStatus(target); setStatusReason(''); setSignedAt(''); setStatusError(null); }}
                    className="btn-secondary text-xs py-1.5"
                  >
                    → {t(`contracts.statuses.${target}`)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200 flex justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-500 hover:text-red-700 font-semibold ml-2">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Financial summary */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <Banknote size={15} />
              {t('contracts.financialSummary')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <InfoField label={t('contracts.totalAmount')} value={formatDZD(c.totalAmount, c.currency)} />
              <InfoField label={t('contracts.currency')} value={c.currency} />
              {c.retentionRate && <InfoField label={t('contracts.retentionRate')} value={`${c.retentionRate}%`} />}
              {c.advancePaymentRate && <InfoField label={t('contracts.advancePaymentRate')} value={`${c.advancePaymentRate}%`} />}
              {c.durationMonths != null && <InfoField label={t('contracts.durationMonths')} value={String(c.durationMonths)} />}
              <InfoField label={t('contracts.effectiveDate')} value={formatDate(c.effectiveDate)} />
              <InfoField label={t('contracts.expiryDate')} value={formatDate(c.expiryDate)} />
              {c.signedAt && <InfoField label={t('contracts.signedAt')} value={formatDate(c.signedAt)} />}
            </div>
            {c.paymentTerms && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{t('contracts.paymentTerms')}</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.paymentTerms}</p>
              </div>
            )}
          </div>

          {/* Avenants */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Scale size={15} />
                {t('contracts.avenants')} ({c.avenants?.length ?? 0})
              </h2>
              <PermissionGate permission="avenant:create">
                {['SIGNED', 'IN_EXECUTION'].includes(c.status) && (
                  <button
                    onClick={() => navigate(`/contracts/${c.id}/avenants/new`)}
                    className="btn-orange text-xs flex items-center gap-1 py-1.5"
                  >
                    <Plus size={13} />
                    {t('contracts.newAvenant')}
                  </button>
                )}
              </PermissionGate>
            </div>

            {!c.avenants?.length ? (
              <p className="text-sm text-gray-400 py-4 text-center">{t('common.noData')}</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {c.avenants.map((a) => (
                  <div key={a.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-sonatrach-navy bg-sonatrach-navy/5 px-1.5 py-0.5 rounded">
                          {a.referenceNumber}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AVENANT_BADGE[a.status]}`}>
                          {t(`contracts.avenantStatuses.${a.status}`)}
                        </span>
                        {a.exceedsThreshold && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1">
                            <AlertTriangle size={10} />
                            {t('contracts.thresholdWarning')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5">{a.titleFr}</p>
                      <p className="text-xs text-gray-400">{t(`contracts.avenantTypes.${a.type}`)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-mono font-semibold ${parseFloat(a.differenceAmount) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {parseFloat(a.differenceAmount) >= 0 ? '+' : ''}{formatDZD(a.differenceAmount)}
                      </p>
                      <p className="text-xs text-gray-400">{a.cumulativeAvenantPct}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">

          {/* Visa timeline */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 size={15} />
              {t('contracts.visaTimeline')}
            </h2>
            <div className="space-y-2 text-sm">
              <VisaStep
                label={t('contracts.legalVisa')}
                doneAt={c.legalVisaAt}
                active={c.status === 'PENDING_VISA_LEGAL'}
              />
              <VisaStep
                label={t('contracts.financialVisa')}
                doneAt={c.financialVisaAt}
                active={c.status === 'PENDING_VISA_FINANCIAL'}
              />
              <VisaStep
                label={t('contracts.dgApproval')}
                doneAt={c.approvedAt}
                active={c.status === 'PENDING_APPROVAL_DG'}
              />
              <VisaStep
                label={t('contracts.signed')}
                doneAt={c.signedAt}
                active={c.status === 'APPROVED'}
              />
            </div>
          </div>

          {/* Financial Impact Gauge */}
          {deltaData && (
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Gavel size={15} />
                {t('contracts.financialImpact')}
              </h2>
              <FinancialGauge
                pct={cumulativePct}
                remainingHeadroom={deltaData.remainingHeadroom}
                totalValue={deltaData.originalAmount}
              />
              {deltaData.breakdown.length > 0 && (
                <div className="divide-y divide-gray-100 text-xs">
                  {deltaData.breakdown.map((row) => (
                    <div key={row.avenantNumber} className="py-1.5 flex justify-between text-gray-600">
                      <span className="font-mono">{row.referenceNumber}</span>
                      <span className="font-semibold">{row.runningPct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SHA-256 seal */}
          {c.sha256Hash && (
            <div className="card space-y-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Shield size={15} className="text-green-600" />
                {t('contracts.sealedDocument')}
              </h2>
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                <Hash size={14} className="text-green-600 shrink-0" />
                <code className="text-[10px] text-green-800 break-all font-mono">{c.sha256Hash}</code>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status transition modal */}
      {pendingStatus && (
        <Modal
          title={`${t('contracts.transitionTo')}: ${t(`contracts.statuses.${pendingStatus}`)}`}
          onClose={() => setPendingStatus(null)}
        >
          <div className="space-y-4">
            {statusError && (
              <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm border border-red-200">{statusError}</div>
            )}

            {pendingStatus === 'SIGNED' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('contracts.signedAt')}</label>
                <input
                  type="date"
                  value={signedAt}
                  onChange={(e) => setSignedAt(e.target.value)}
                  className="input-field"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('contracts.transitionReason')}</label>
              <textarea
                rows={3}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder={t('contracts.reasonPlaceholder') || ''}
                className="input-field"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setPendingStatus(null)} className="btn-secondary" disabled={transitioning}>
                {t('common.cancel')}
              </button>
              <button onClick={handleTransition} className="btn-orange" disabled={transitioning}>
                {transitioning ? t('common.loading') : t('common.confirm')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

function VisaStep({ label, doneAt, active }: { label: string; doneAt?: string | null; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {doneAt ? (
        <CheckCircle2 size={15} className="text-green-500 shrink-0" />
      ) : active ? (
        <Clock size={15} className="text-amber-500 shrink-0" />
      ) : (
        <div className="w-[15px] h-[15px] rounded-full border-2 border-gray-300 shrink-0" />
      )}
      <div className="min-w-0">
        <p className={`text-sm ${doneAt ? 'text-green-700 font-medium' : active ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>
          {label}
        </p>
        {doneAt && <p className="text-xs text-gray-400">{new Date(doneAt).toLocaleDateString('fr-FR')}</p>}
      </div>
    </div>
  );
}
