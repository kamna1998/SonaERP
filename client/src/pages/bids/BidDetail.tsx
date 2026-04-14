import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, FileBox, Shield, ShieldOff, Lock, Unlock, Hash,
  Building2, FileText, AlertTriangle, XCircle, Award,
  Trophy, CalendarDays, User, EyeOff,
} from 'lucide-react';
import { useBidStore } from '../../stores/bidStore';
import { useAuthStore } from '../../stores/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import type { BidStatus, EnvelopeType, BidEnvelope } from '../../api/bids';

// Mirror server bids.validation.VALID_BID_TRANSITIONS
const VALID_TRANSITIONS: Record<BidStatus, BidStatus[]> = {
  RECEIVED: ['OPENED', 'WITHDRAWN'],
  OPENED: ['UNDER_EVALUATION'],
  UNDER_EVALUATION: ['TECHNICALLY_COMPLIANT', 'TECHNICALLY_NON_COMPLIANT'],
  TECHNICALLY_COMPLIANT: ['COMMERCIALLY_EVALUATED', 'REJECTED'],
  TECHNICALLY_NON_COMPLIANT: ['REJECTED'],
  COMMERCIALLY_EVALUATED: ['AWARDED', 'REJECTED'],
  AWARDED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

function formatDZD(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export default function BidDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const {
    currentBid, loading, error,
    fetchBidById, openEnvelope, changeStatus, clearCurrent, clearError,
  } = useBidStore();

  const [activeVault, setActiveVault] = useState<EnvelopeType>('TECHNICAL');

  // Open-envelope modal
  const [openTarget, setOpenTarget] = useState<EnvelopeType | null>(null);
  const [witnessNote, setWitnessNote] = useState('');
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  // Status transition modal
  const [pendingStatus, setPendingStatus] = useState<BidStatus | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchBidById(id);
    return () => clearCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading && !currentBid) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-sonatrach-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !currentBid) {
    return (
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
        {error}
      </div>
    );
  }

  if (!currentBid) return null;

  const allowedVaults = currentBid.meta?.allowedVaults || [];
  const hiddenEnvelopes = currentBid.meta?.hiddenEnvelopes || 0;
  const nextStates = VALID_TRANSITIONS[currentBid.status] || [];

  const technicalEnvelope = currentBid.envelopes.find((e) => e.envelopeType === 'TECHNICAL');
  const commercialEnvelope = currentBid.envelopes.find((e) => e.envelopeType === 'COMMERCIAL');
  const canSeeTechnical = allowedVaults.includes('TECHNICAL');
  const canSeeCommercial = allowedVaults.includes('COMMERCIAL');

  const canOpenEnvelope = hasPermission('bid:open');
  const canEvaluate = hasPermission('bid:evaluate');
  const canAward = hasPermission('bid:award');
  const canChangeStatus = hasPermission('bid:update') || canEvaluate || canAward;

  // Technical-before-commercial firewall
  const technicalOpened = !!technicalEnvelope && !technicalEnvelope.isSealed;
  const technicallyCompliant = currentBid.status === 'TECHNICALLY_COMPLIANT'
    || currentBid.status === 'COMMERCIALLY_EVALUATED'
    || currentBid.status === 'AWARDED';

  function canTransitionTo(target: BidStatus): boolean {
    if (target === 'AWARDED') return canAward;
    if (target === 'TECHNICALLY_COMPLIANT' || target === 'TECHNICALLY_NON_COMPLIANT' || target === 'COMMERCIALLY_EVALUATED') {
      return canEvaluate;
    }
    if (target === 'OPENED') return canOpenEnvelope;
    return canChangeStatus;
  }

  async function handleOpenEnvelope() {
    if (!openTarget || !currentBid) return;
    setOpening(true);
    setOpenError(null);
    try {
      await openEnvelope(currentBid.id, openTarget, witnessNote.trim() || undefined);
      setOpenTarget(null);
      setWitnessNote('');
    } catch (e: any) {
      setOpenError(e.message || "Échec de l'ouverture");
    } finally {
      setOpening(false);
    }
  }

  async function handleStatusChange() {
    if (!pendingStatus || !currentBid) return;
    setTransitioning(true);
    setStatusError(null);
    clearError();
    try {
      await changeStatus(currentBid.id, pendingStatus, statusReason.trim() || undefined);
      setPendingStatus(null);
      setStatusReason('');
    } catch (e: any) {
      setStatusError(e.message || 'Échec de la transition');
    } finally {
      setTransitioning(false);
    }
  }

  const technicalEvaluations = currentBid.evaluations.filter((e) => e.envelopeType === 'TECHNICAL');
  const commercialEvaluations = currentBid.evaluations.filter((e) => e.envelopeType === 'COMMERCIAL');
  const visibleEvaluations = activeVault === 'TECHNICAL' ? technicalEvaluations : commercialEvaluations;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button
            onClick={() => navigate('/bids')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="p-2.5 bg-sonatrach-navy/10 rounded-xl">
            <FileBox size={24} className="text-sonatrach-navy" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-sonatrach-navy bg-sonatrach-navy/5 px-2 py-1 rounded">
                {currentBid.referenceNumber}
              </span>
              <StatusBadge status={currentBid.status} />
              {currentBid.rank && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-amber-100 text-amber-800">
                  <Trophy size={12} />
                  {t('bids.rank')} #{currentBid.rank}
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mt-2 truncate">
              {currentBid.supplier.companyNameFr}
            </h1>
            <Link
              to={`/projects/${currentBid.project.id}`}
              className="text-xs text-sonatrach-orange hover:underline font-mono"
            >
              {currentBid.project.referenceNumber} — {currentBid.project.titleFr}
            </Link>
          </div>
        </div>

        {/* Transition buttons */}
        {nextStates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {nextStates.map((s) => (
              <button
                key={s}
                disabled={!canTransitionTo(s)}
                onClick={() => {
                  setPendingStatus(s);
                  setStatusReason('');
                  setStatusError(null);
                }}
                className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
                  canTransitionTo(s)
                    ? 'bg-white border-sonatrach-navy text-sonatrach-navy hover:bg-sonatrach-navy hover:text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                → {t(`bids.statuses.${s}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* Vault access notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
        <Shield size={14} />
        <span>
          <strong>{t('bids.vaultAccess')}:</strong>{' '}
          {allowedVaults.length === 0 ? t('bids.noVaultAccess') : allowedVaults.join(' + ')}
        </span>
        {hiddenEnvelopes > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-amber-700">
            <EyeOff size={12} />
            {hiddenEnvelopes} {t('bids.hiddenEnvelopes')}
          </span>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <InfoCard
          icon={<Building2 size={18} className="text-sonatrach-navy" />}
          label={t('bids.supplier')}
          value={currentBid.supplier.companyNameFr}
          sub={currentBid.supplier.registrationNumber}
        />
        <InfoCard
          icon={<CalendarDays size={18} className="text-blue-600" />}
          label={t('bids.receivedAt')}
          value={new Date(currentBid.receivedAt).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
          sub={currentBid.receivedByName}
        />
        <InfoCard
          icon={<Award size={18} className="text-violet-600" />}
          label={t('bids.compositeScore')}
          value={currentBid.compositeScore ? parseFloat(currentBid.compositeScore).toFixed(2) : '—'}
          sub={
            currentBid.technicalScore || currentBid.commercialScore
              ? `T: ${currentBid.technicalScore || '—'} / C: ${currentBid.commercialScore || '—'}`
              : undefined
          }
        />
        <InfoCard
          icon={<Shield size={18} className="text-amber-600" />}
          label={t('bids.bidBond')}
          value={currentBid.hasBidBond ? formatDZD(currentBid.bidBondAmount) : t('common.none')}
          sub={
            currentBid.hasBidBond && currentBid.bidBondExpiryDate
              ? `${t('bids.expiresOn')}: ${new Date(currentBid.bidBondExpiryDate).toLocaleDateString('fr-FR')}`
              : undefined
          }
        />
      </div>

      {/* Blacklist warning */}
      {currentBid.supplier.isBlacklisted && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {t('bids.supplierBlacklistedWarning')}
        </div>
      )}

      {/* Technical-before-commercial firewall warning */}
      {commercialEnvelope && commercialEnvelope.isSealed && !technicallyCompliant && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <Lock size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong>{t('bids.firewall.title')}</strong>
            <p className="mt-1 text-xs">{t('bids.firewall.description')}</p>
          </div>
        </div>
      )}

      {/* Vault tabs */}
      <div className="card p-0 overflow-hidden">
        <div className="border-b border-gray-200 flex">
          <VaultTab
            active={activeVault === 'TECHNICAL'}
            onClick={() => setActiveVault('TECHNICAL')}
            icon={<Shield size={14} />}
            label={t('bids.vaults.TECHNICAL')}
            restricted={!canSeeTechnical}
          />
          <VaultTab
            active={activeVault === 'COMMERCIAL'}
            onClick={() => setActiveVault('COMMERCIAL')}
            icon={<ShieldOff size={14} />}
            label={t('bids.vaults.COMMERCIAL')}
            restricted={!canSeeCommercial}
          />
        </div>

        {/* Envelope for active vault */}
        <div className="p-4">
          {activeVault === 'TECHNICAL' && (
            canSeeTechnical ? (
              <EnvelopePanel
                envelope={technicalEnvelope}
                envelopeType="TECHNICAL"
                canOpen={canOpenEnvelope && currentBid.status === 'OPENED'}
                openDisabledReason={
                  currentBid.status === 'RECEIVED'
                    ? t('bids.firewall.notYetOpened')
                    : currentBid.status !== 'OPENED'
                      ? t('bids.firewall.bidNotInOpenedState')
                      : null
                }
                onOpen={() => {
                  setOpenTarget('TECHNICAL');
                  setWitnessNote('');
                  setOpenError(null);
                }}
              />
            ) : (
              <RestrictedPanel />
            )
          )}

          {activeVault === 'COMMERCIAL' && (
            canSeeCommercial ? (
              <EnvelopePanel
                envelope={commercialEnvelope}
                envelopeType="COMMERCIAL"
                canOpen={canOpenEnvelope && technicalOpened && technicallyCompliant}
                openDisabledReason={
                  !technicalOpened
                    ? t('bids.firewall.technicalMustOpenFirst')
                    : !technicallyCompliant
                      ? t('bids.firewall.mustBeTechnicallyCompliant')
                      : null
                }
                onOpen={() => {
                  setOpenTarget('COMMERCIAL');
                  setWitnessNote('');
                  setOpenError(null);
                }}
              />
            ) : (
              <RestrictedPanel />
            )
          )}
        </div>

        {/* Evaluations for active vault */}
        {((activeVault === 'TECHNICAL' && canSeeTechnical) ||
          (activeVault === 'COMMERCIAL' && canSeeCommercial)) && (
          <div className="border-t border-gray-100 p-4">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
              {t('bids.evaluations')}
            </h3>
            {visibleEvaluations.length === 0 ? (
              <p className="text-sm text-gray-400 italic">{t('bids.noEvaluations')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-2 px-2">{t('bids.criterion')}</th>
                      <th className="text-left py-2 px-2">{t('bids.score')}</th>
                      <th className="text-left py-2 px-2">{t('bids.evaluator')}</th>
                      <th className="text-left py-2 px-2">{t('common.date')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleEvaluations.map((ev) => (
                      <tr key={ev.id}>
                        <td className="py-2 px-2">
                          <div className="font-mono text-gray-500">{ev.criterionCode}</div>
                          <div className="text-gray-700">{ev.criterionLabel}</div>
                        </td>
                        <td className="py-2 px-2 font-mono">
                          <strong>{parseFloat(ev.givenScore).toFixed(2)}</strong>
                          {' / '}
                          {parseFloat(ev.maxScore).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-gray-600">
                          {ev.evaluator
                            ? `${ev.evaluator.firstNameFr} ${ev.evaluator.lastNameFr}`
                            : '—'}
                        </td>
                        <td className="py-2 px-2 text-gray-500">
                          {new Date(ev.evaluatedAt).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reception info */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <User size={16} /> {t('bids.receptionInfo')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              {t('bids.receivedBy')}
            </div>
            <div className="text-gray-900">{currentBid.receivedByName}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              {t('bids.registeredOn')}
            </div>
            <div className="text-gray-900 font-mono text-xs">
              {new Date(currentBid.createdAt).toLocaleString('fr-FR')}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              {t('bids.lastUpdate')}
            </div>
            <div className="text-gray-900 font-mono text-xs">
              {new Date(currentBid.updatedAt).toLocaleString('fr-FR')}
            </div>
          </div>
        </div>
      </div>

      {/* Open envelope modal */}
      {openTarget && (
        <Modal
          onClose={() => setOpenTarget(null)}
          title={`${t('bids.openEnvelope')}: ${t(`bids.vaults.${openTarget}`)}`}
        >
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-xs mb-3 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{t('bids.openEnvelopeWarning')}</span>
          </div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('bids.witnessNote')} ({t('common.optional')})
          </label>
          <textarea
            value={witnessNote}
            onChange={(e) => setWitnessNote(e.target.value)}
            rows={3}
            className="input-field text-sm mb-3"
            placeholder={t('bids.witnessNotePlaceholder')}
          />
          {openError && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-xs mb-3">
              {openError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpenTarget(null)}
              className="btn-secondary text-sm"
              disabled={opening}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleOpenEnvelope}
              className="btn-orange text-sm flex items-center gap-2"
              disabled={opening}
            >
              {opening ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('bids.opening')}
                </>
              ) : (
                <>
                  <Unlock size={14} />
                  {t('bids.confirmOpen')}
                </>
              )}
            </button>
          </div>
        </Modal>
      )}

      {/* Status transition modal */}
      {pendingStatus && (
        <Modal
          onClose={() => setPendingStatus(null)}
          title={t('bids.confirmTransition')}
        >
          <p className="text-sm text-gray-600 mb-3">
            {t('bids.transitionTo')}{' '}
            <strong>{t(`bids.statuses.${pendingStatus}`)}</strong>
          </p>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('bids.reason')} ({t('common.optional')})
          </label>
          <textarea
            value={statusReason}
            onChange={(e) => setStatusReason(e.target.value)}
            rows={3}
            className="input-field text-sm mb-3"
            placeholder={t('bids.reasonPlaceholder')}
          />
          {statusError && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-xs mb-3">
              {statusError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPendingStatus(null)}
              className="btn-secondary text-sm"
              disabled={transitioning}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleStatusChange}
              className="btn-orange text-sm"
              disabled={transitioning}
            >
              {transitioning ? t('common.loading') : t('common.confirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function InfoCard({
  icon, label, value, sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        {icon}
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-base font-semibold text-gray-900 truncate">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function VaultTab({
  active, onClick, icon, label, restricted,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  restricted: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
        active
          ? 'border-sonatrach-orange text-sonatrach-navy'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
      {restricted && (
        <EyeOff size={12} className="text-gray-400" />
      )}
    </button>
  );
}

function EnvelopePanel({
  envelope, envelopeType, canOpen, openDisabledReason, onOpen,
}: {
  envelope: BidEnvelope | undefined;
  envelopeType: EnvelopeType;
  canOpen: boolean;
  openDisabledReason: string | null;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  if (!envelope) {
    return (
      <div className="py-8 text-center text-gray-400">
        <FileText size={32} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm">{t('bids.noEnvelope')}</p>
        <p className="text-xs mt-1">{t('bids.noEnvelopeHelp', { type: t(`bids.vaults.${envelopeType}`) })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`p-2.5 rounded-lg ${
            envelope.isSealed ? 'bg-gray-100' : 'bg-green-50'
          }`}>
            {envelope.isSealed
              ? <Lock size={20} className="text-gray-600" />
              : <Unlock size={20} className="text-green-700" />
            }
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900">{envelope.fileName}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                envelope.isSealed
                  ? 'bg-gray-100 text-gray-700 border border-gray-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {envelope.isSealed ? t('bids.envelopeSealed') : t('bids.envelopeOpened')}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
              <div>
                {(envelope.fileSize / 1024).toFixed(1)} KB
                {' · '}
                {t('bids.uploadedOn')}: {new Date(envelope.createdAt).toLocaleString('fr-FR')}
              </div>
              {envelope.openedAt && (
                <div className="text-green-700">
                  {t('bids.openedOn')}: {new Date(envelope.openedAt).toLocaleString('fr-FR')}
                </div>
              )}
              <div className="flex items-center gap-1 font-mono text-gray-400">
                <Hash size={10} />
                {envelope.sha256Hash.slice(0, 24)}…
              </div>
            </div>
          </div>
        </div>
        {envelope.isSealed && (
          <button
            onClick={canOpen ? onOpen : undefined}
            disabled={!canOpen}
            title={!canOpen ? openDisabledReason || '' : ''}
            className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors flex items-center gap-1.5 ${
              canOpen
                ? 'bg-sonatrach-orange text-white border-sonatrach-orange hover:bg-orange-600'
                : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Unlock size={12} />
            {t('bids.openEnvelope')}
          </button>
        )}
      </div>
      {envelope.isSealed && !canOpen && openDisabledReason && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2 rounded flex items-center gap-2">
          <Lock size={12} />
          {openDisabledReason}
        </div>
      )}
    </div>
  );
}

function RestrictedPanel() {
  const { t } = useTranslation();
  return (
    <div className="py-10 text-center">
      <div className="inline-flex items-center gap-2 text-gray-400 mb-2">
        <EyeOff size={32} className="text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-600">{t('bids.restrictedVault')}</p>
      <p className="text-xs text-gray-500 mt-1">{t('bids.restrictedVaultHelp')}</p>
    </div>
  );
}

function Modal({
  children, onClose, title,
}: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
