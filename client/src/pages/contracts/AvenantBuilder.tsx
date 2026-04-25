import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Scale, AlertTriangle, Banknote } from 'lucide-react';
import { useContractStore } from '../../stores/contractStore';
import type { AvenantType } from '../../api/contracts';

const AVENANT_TYPES: AvenantType[] = [
  'MODIFICATION_SCOPE',
  'EXTENSION_DELAY',
  'PRICE_REVISION',
  'ADDITIONAL_WORKS',
  'REDUCTION',
];

const LEGAL_THRESHOLD_PCT = 20;
const WARNING_PCT = 16; // 80% of threshold

function formatDZD(amount: number, currency = 'DZD'): string {
  if (Number.isNaN(amount)) return '—';
  if (currency === 'DZD') {
    return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(amount);
  }
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}

// ─── Financial Impact Gauge (live preview) ───────────────────────────────────

function LiveGauge({ projectedPct, currentPct, contractAmount }: {
  projectedPct: number;
  currentPct: number;
  contractAmount: number;
}) {
  const { t } = useTranslation();
  const isError = projectedPct > LEGAL_THRESHOLD_PCT;
  const isWarning = !isError && projectedPct >= WARNING_PCT;

  const barColor = isError ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-green-500';
  const textColor = isError ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-green-700';
  const clamped = Math.min(projectedPct, 100);
  const barWidth = Math.min(clamped * 5, 100); // 20% maps to full bar

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isError ? 'border-red-300 bg-red-50' : isWarning ? 'border-amber-300 bg-amber-50' : 'border-green-200 bg-green-50/50'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{t('contracts.financialImpact')}</span>
        <span className={`text-sm font-bold ${textColor}`}>
          {projectedPct.toFixed(2)}% / {LEGAL_THRESHOLD_PCT}%
        </span>
      </div>

      {/* bar */}
      <div className="relative w-full h-5 bg-white border border-gray-200 rounded-full overflow-hidden">
        {/* warning zone shading */}
        <div className="absolute inset-y-0 bg-amber-100" style={{ left: '80%', right: '0' }} />
        {/* current committed avenants */}
        <div
          className="absolute inset-y-0 bg-blue-300/50"
          style={{ width: `${Math.min(currentPct * 5, 100)}%` }}
        />
        {/* projected additional */}
        <div
          className={`absolute inset-y-0 ${barColor} opacity-80`}
          style={{ left: `${Math.min(currentPct * 5, 100)}%`, width: `${Math.min((projectedPct - currentPct) * 5, 100 - Math.min(currentPct * 5, 100))}%` }}
        />
        {/* threshold line */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 opacity-60" style={{ left: '100%' }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-amber-500 opacity-60" style={{ left: '80%' }} />
      </div>

      <div className="flex justify-between text-xs text-gray-400">
        <span>0%</span>
        <span className="text-amber-600">16%</span>
        <span className="text-red-600">20% {t('contracts.legalLimit')}</span>
      </div>

      {isError && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-100 rounded-lg px-3 py-2 mt-1">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{t('contracts.thresholdExceededError', { pct: projectedPct.toFixed(2) })}</span>
        </div>
      )}
      {isWarning && !isError && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-100 rounded-lg px-3 py-2 mt-1">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{t('contracts.thresholdApproachingWarning', { pct: projectedPct.toFixed(2) })}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AvenantBuilder() {
  const { t } = useTranslation();
  const { id: contractId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentContract, cumulativeDelta, error, clearError,
    fetchContractById, fetchCumulativeDelta, createAvenant,
  } = useContractStore();

  const [type, setType] = useState<AvenantType>('MODIFICATION_SCOPE');
  const [titleFr, setTitleFr] = useState('');
  const [justification, setJustification] = useState('');
  const [amendedAmount, setAmendedAmount] = useState<number | ''>('');
  const [newEndDate, setNewEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (contractId) {
      fetchContractById(contractId);
      fetchCumulativeDelta(contractId);
    }
  }, [contractId]);

  const contractAmount = currentContract ? parseFloat(currentContract.totalAmount) : 0;
  const currentPct = cumulativeDelta ? parseFloat(cumulativeDelta.cumulativePct) : 0;

  // Project the new cumulative pct including the amount the user is typing
  const projectedPct = useMemo(() => {
    if (!amendedAmount || !contractAmount) return currentPct;
    const diff = Number(amendedAmount) - contractAmount;
    // diff relative to contract
    const projectedDelta = (cumulativeDelta ? parseFloat(cumulativeDelta.cumulativeDelta) : 0) + diff;
    return contractAmount > 0 ? (Math.abs(projectedDelta) / contractAmount) * 100 : 0;
  }, [amendedAmount, contractAmount, currentPct, cumulativeDelta]);

  const diffAmount = amendedAmount !== '' ? Number(amendedAmount) - contractAmount : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractId || !titleFr.trim() || !justification.trim() || amendedAmount === '') return;
    if (projectedPct > LEGAL_THRESHOLD_PCT) return; // client-side guard
    setSubmitting(true);
    setSubmitError(null);
    clearError();
    try {
      const avenant = await createAvenant({
        contractId,
        type,
        titleFr: titleFr.trim(),
        justification: justification.trim(),
        amendedAmount: Number(amendedAmount),
        newEndDate: newEndDate ? new Date(newEndDate).toISOString() : undefined,
      });
      navigate(`/contracts/${contractId}`);
    } catch (err: any) {
      setSubmitError(err?.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!currentContract && !error) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-sonatrach-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button onClick={() => navigate(`/contracts/${contractId}`)} className="btn-secondary flex items-center gap-2 text-sm">
        <ArrowLeft size={16} />
        {t('common.back')}
      </button>

      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-sonatrach-navy/10 rounded-xl">
          <Scale size={24} className="text-sonatrach-navy" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sonatrach-navy">{t('contracts.newAvenant')}</h1>
          {currentContract && (
            <p className="text-sm text-gray-500">
              {currentContract.referenceNumber} — {currentContract.titleFr}
            </p>
          )}
        </div>
      </div>

      {(error || submitError) && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
          {submitError || error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Live gauge always visible at top so user sees impact while typing */}
        {currentContract && (
          <LiveGauge
            projectedPct={projectedPct}
            currentPct={currentPct}
            contractAmount={contractAmount}
          />
        )}

        <div className="card space-y-5">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('contracts.avenantType')} <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={type}
              onChange={(e) => setType(e.target.value as AvenantType)}
              className="input-field"
            >
              {AVENANT_TYPES.map((t_) => (
                <option key={t_} value={t_}>{t(`contracts.avenantTypes.${t_}`)}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('contracts.avenantTitle')} <span className="text-red-500">*</span>
            </label>
            <input
              required
              minLength={3}
              maxLength={500}
              value={titleFr}
              onChange={(e) => setTitleFr(e.target.value)}
              className="input-field"
              placeholder={t('contracts.avenantTitlePlaceholder') || ''}
            />
          </div>

          {/* Justification */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('contracts.avenantJustification')} <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              minLength={10}
              maxLength={5000}
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="input-field"
              placeholder={t('contracts.avenantJustificationPlaceholder') || ''}
            />
          </div>

          {/* Amended amount + diff preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Banknote size={14} />
              {t('contracts.amendedAmount')} <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="number"
              step="0.01"
              min={0}
              value={amendedAmount}
              onChange={(e) => setAmendedAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="input-field"
            />
            {diffAmount !== null && contractAmount > 0 && (
              <p className={`text-xs mt-1 font-mono font-semibold ${diffAmount >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {t('contracts.differenceAmount')}:{' '}
                {diffAmount >= 0 ? '+' : ''}{formatDZD(diffAmount, currentContract?.currency)}
                {' '}({((Math.abs(diffAmount) / contractAmount) * 100).toFixed(2)}%)
              </p>
            )}
          </div>

          {/* New end date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('contracts.newEndDate')}
            </label>
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="input-field"
            />
            <p className="text-xs text-gray-400 mt-1">{t('contracts.newEndDateHint')}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(`/contracts/${contractId}`)}
            className="btn-secondary"
            disabled={submitting}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="btn-orange"
            disabled={submitting || projectedPct > LEGAL_THRESHOLD_PCT}
          >
            {submitting ? t('common.loading') : t('contracts.createAvenant')}
          </button>
        </div>
      </form>
    </div>
  );
}
