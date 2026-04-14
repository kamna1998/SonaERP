import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, FileStack, Plus, Lock, Unlock, Upload, CheckCircle2,
  XCircle, Shield, ShieldOff, Hash, AlertTriangle, FileText, Clock,
} from 'lucide-react';
import { useDtaoStore } from '../../stores/dtaoStore';
import { useAuthStore } from '../../stores/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import PermissionGate from '../../components/auth/PermissionGate';
import type { VaultType, DtaoStatus, DtaoDocument } from '../../api/dtao';

// Embedded transitions mirror server dtao.validation.VALID_DTAO_TRANSITIONS
const VALID_TRANSITIONS: Record<DtaoStatus, DtaoStatus[]> = {
  DRAFT: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['PUBLISHED', 'UNDER_REVIEW', 'CANCELLED'],
  PUBLISHED: ['AMENDED', 'CANCELLED'],
  AMENDED: ['PUBLISHED', 'CANCELLED'],
  CANCELLED: [],
};

const DOCUMENT_TYPES = [
  'CAHIER_DES_CHARGES',
  'REGLEMENT_CONSULTATION',
  'CAHIER_PRESCRIPTIONS_TECHNIQUES',
  'BORDEREAU_PRIX',
  'LETTRE_SOUMISSION',
  'DECLARATION_PROBITE',
  'DECLARATION_CANDIDATURE',
  'CAUTION_SOUMISSION',
  'MODELE_CONTRAT',
  'AUTRES',
] as const;

export default function DtaoDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const {
    currentDtao, loading, error,
    fetchDtaoById, changeStatus, addDocument, uploadVersion, sealDocument,
    clearCurrent,
  } = useDtaoStore();

  const [activeVault, setActiveVault] = useState<VaultType>('TECHNICAL');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<DtaoStatus | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);

  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDocType, setNewDocType] = useState<string>(DOCUMENT_TYPES[0]);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [addDocError, setAddDocError] = useState<string | null>(null);

  const [uploadTargetDocId, setUploadTargetDocId] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadSeal, setUploadSeal] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchDtaoById(id);
    return () => clearCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading && !currentDtao) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-sonatrach-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !currentDtao) {
    return (
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
        {error}
      </div>
    );
  }

  if (!currentDtao) return null;

  const nextStates = VALID_TRANSITIONS[currentDtao.status] || [];
  const visibleDocs = currentDtao.documents.filter((d) => d.vault === activeVault);
  const technicalChecklist = currentDtao.checklist.filter((c) => c.vault === 'TECHNICAL');
  const commercialChecklist = currentDtao.checklist.filter((c) => c.vault === 'COMMERCIAL');
  const allRequiredProvided = currentDtao.checklist
    .filter((c) => c.required)
    .every((c) => c.provided && c.sealed);

  const canUpdate = hasPermission('dtao:update');
  const canApprove = hasPermission('dtao:approve');
  const canPublish = hasPermission('dtao:publish');

  function canTransitionTo(target: DtaoStatus): boolean {
    if (target === 'PUBLISHED') return canPublish;
    if (target === 'APPROVED') return canApprove;
    return canUpdate;
  }

  async function handleStatusChange() {
    if (!pendingStatus || !currentDtao) return;
    setStatusError(null);
    try {
      await changeStatus(currentDtao.id, pendingStatus, statusReason || undefined);
      setShowStatusModal(false);
      setPendingStatus(null);
      setStatusReason('');
    } catch (e: any) {
      setStatusError(e.message || 'Échec de la transition');
    }
  }

  async function handleAddDoc() {
    if (!currentDtao || !newDocTitle.trim()) return;
    setAddDocError(null);
    try {
      await addDocument(currentDtao.id, {
        documentType: newDocType,
        titleFr: newDocTitle.trim(),
      });
      setShowAddDoc(false);
      setNewDocTitle('');
      setNewDocType(DOCUMENT_TYPES[0]);
    } catch (e: any) {
      setAddDocError(e.message || "Échec de l'ajout");
    }
  }

  async function handleUpload() {
    if (!uploadTargetDocId || !uploadContent || !uploadFileName.trim()) return;
    setUploadError(null);
    try {
      // Encode as base64 for transport
      const base64 = btoa(unescape(encodeURIComponent(uploadContent)));
      await uploadVersion(uploadTargetDocId, {
        content: base64,
        fileName: uploadFileName.trim(),
        mimeType: 'text/plain',
        isSealed: uploadSeal,
      });
      setUploadTargetDocId(null);
      setUploadContent('');
      setUploadFileName('');
      setUploadSeal(false);
    } catch (e: any) {
      setUploadError(e.message || 'Échec du téléversement');
    }
  }

  async function handleSeal(docId: string) {
    try {
      await sealDocument(docId);
    } catch {
      /* error shown via store */
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button
            onClick={() => navigate('/dtao')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="p-2.5 bg-sonatrach-navy/10 rounded-xl">
            <FileStack size={24} className="text-sonatrach-navy" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-sonatrach-navy bg-sonatrach-navy/5 px-2 py-1 rounded">
                {currentDtao.referenceNumber}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                v{currentDtao.versionMajor}.{currentDtao.versionMinor}
              </span>
              <StatusBadge status={currentDtao.status} />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mt-2 truncate">
              {currentDtao.project.titleFr}
            </h1>
            <Link
              to={`/projects/${currentDtao.project.id}`}
              className="text-xs text-sonatrach-orange hover:underline font-mono"
            >
              {currentDtao.project.referenceNumber}
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
                  setShowStatusModal(true);
                }}
                className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
                  canTransitionTo(s)
                    ? 'bg-white border-sonatrach-navy text-sonatrach-navy hover:bg-sonatrach-navy hover:text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                → {t(`dtao.statuses.${s}`)}
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

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <InfoCard
          icon={<FileText size={18} className="text-sonatrach-navy" />}
          label={t('dtao.docCount')}
          value={String(currentDtao.documents.length)}
        />
        <InfoCard
          icon={<Shield size={18} className="text-blue-600" />}
          label={t('dtao.vaults.TECHNICAL')}
          value={String(technicalChecklist.filter((c) => c.provided).length) + ' / ' + String(technicalChecklist.filter((c) => c.required).length)}
        />
        <InfoCard
          icon={<ShieldOff size={18} className="text-amber-600" />}
          label={t('dtao.vaults.COMMERCIAL')}
          value={String(commercialChecklist.filter((c) => c.provided).length) + ' / ' + String(commercialChecklist.filter((c) => c.required).length)}
        />
        <InfoCard
          icon={<Hash size={18} className="text-violet-600" />}
          label={t('dtao.specHash')}
          value={currentDtao.technicalSpecHash
            ? currentDtao.technicalSpecHash.slice(0, 10) + '…'
            : '—'}
          mono
        />
      </div>

      {/* Readiness warning */}
      {currentDtao.status === 'UNDER_REVIEW' && !allRequiredProvided && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {t('dtao.readinessWarning')}
        </div>
      )}

      {/* Vault tabs */}
      <div className="card p-0 overflow-hidden">
        <div className="border-b border-gray-200 flex items-center justify-between">
          <div className="flex">
            <VaultTab
              active={activeVault === 'TECHNICAL'}
              onClick={() => setActiveVault('TECHNICAL')}
              icon={<Shield size={14} />}
              label={t('dtao.vaults.TECHNICAL')}
              count={currentDtao.documents.filter((d) => d.vault === 'TECHNICAL').length}
            />
            <VaultTab
              active={activeVault === 'COMMERCIAL'}
              onClick={() => setActiveVault('COMMERCIAL')}
              icon={<ShieldOff size={14} />}
              label={t('dtao.vaults.COMMERCIAL')}
              count={currentDtao.documents.filter((d) => d.vault === 'COMMERCIAL').length}
            />
          </div>
          <PermissionGate permission="dtao:update">
            {currentDtao.status === 'DRAFT' && (
              <button
                onClick={() => setShowAddDoc(true)}
                className="m-2 btn-orange text-xs flex items-center gap-1.5 px-3 py-1.5"
              >
                <Plus size={14} />
                {t('dtao.addDocument')}
              </button>
            )}
          </PermissionGate>
        </div>

        {/* Checklist for current vault */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            {t('dtao.checklist')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {(activeVault === 'TECHNICAL' ? technicalChecklist : commercialChecklist).map((c) => (
              <div
                key={c.documentType}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${
                  c.sealed
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : c.provided
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : c.required
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}
              >
                {c.sealed ? <Lock size={12} /> : c.provided ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {t(`dtao.docTypes.${c.documentType}`)}
                {c.required && !c.provided && <span className="ml-1 font-bold">*</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Documents list */}
        <div className="divide-y divide-gray-100">
          {visibleDocs.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <FileText size={32} className="mx-auto mb-2 text-gray-300" />
              {t('dtao.noDocuments')}
            </div>
          ) : (
            visibleDocs.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                canUpdate={canUpdate}
                canApprove={canApprove}
                onUpload={() => {
                  setUploadTargetDocId(doc.id);
                  setUploadFileName('');
                  setUploadContent('');
                  setUploadSeal(false);
                  setUploadError(null);
                }}
                onSeal={() => handleSeal(doc.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Status history */}
      {currentDtao.statusHistory && currentDtao.statusHistory.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock size={16} /> {t('dtao.statusHistory')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="text-left py-2 px-2">{t('common.date')}</th>
                  <th className="text-left py-2 px-2">{t('dtao.transition')}</th>
                  <th className="text-left py-2 px-2">{t('dtao.reason')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentDtao.statusHistory.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2 px-2 text-gray-500">
                      {new Date(h.changedAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-2 px-2">
                      <span className="font-mono">
                        {h.fromStatus} → <strong>{h.toStatus}</strong>
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-600 italic">{h.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status transition modal */}
      {showStatusModal && pendingStatus && (
        <Modal onClose={() => setShowStatusModal(false)} title={t('dtao.confirmTransition')}>
          <p className="text-sm text-gray-600 mb-3">
            {t('dtao.transitionTo')}{' '}
            <strong>{t(`dtao.statuses.${pendingStatus}`)}</strong>
          </p>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('dtao.reason')} ({t('common.optional')})
          </label>
          <textarea
            value={statusReason}
            onChange={(e) => setStatusReason(e.target.value)}
            rows={3}
            className="input-field text-sm mb-3"
            placeholder={t('dtao.reasonPlaceholder')}
          />
          {statusError && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-xs mb-3">{statusError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowStatusModal(false)} className="btn-secondary text-sm">
              {t('common.cancel')}
            </button>
            <button onClick={handleStatusChange} className="btn-orange text-sm">
              {t('common.confirm')}
            </button>
          </div>
        </Modal>
      )}

      {/* Add document modal */}
      {showAddDoc && (
        <Modal onClose={() => setShowAddDoc(false)} title={t('dtao.addDocument')}>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('dtao.documentType')}
          </label>
          <select
            value={newDocType}
            onChange={(e) => setNewDocType(e.target.value)}
            className="input-field text-sm mb-3"
          >
            {DOCUMENT_TYPES.map((dt) => (
              <option key={dt} value={dt}>{t(`dtao.docTypes.${dt}`)}</option>
            ))}
          </select>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('dtao.docTitle')}
          </label>
          <input
            type="text"
            value={newDocTitle}
            onChange={(e) => setNewDocTitle(e.target.value)}
            className="input-field text-sm mb-3"
            placeholder={t('dtao.docTitlePlaceholder')}
          />
          {addDocError && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-xs mb-3">{addDocError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAddDoc(false)} className="btn-secondary text-sm">
              {t('common.cancel')}
            </button>
            <button onClick={handleAddDoc} className="btn-orange text-sm" disabled={!newDocTitle.trim()}>
              {t('common.create')}
            </button>
          </div>
        </Modal>
      )}

      {/* Upload version modal */}
      {uploadTargetDocId && (
        <Modal onClose={() => setUploadTargetDocId(null)} title={t('dtao.uploadVersion')}>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('dtao.fileName')}
          </label>
          <input
            type="text"
            value={uploadFileName}
            onChange={(e) => setUploadFileName(e.target.value)}
            className="input-field text-sm mb-3"
            placeholder="cahier-charges-v1.txt"
          />
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('dtao.content')}
          </label>
          <textarea
            value={uploadContent}
            onChange={(e) => setUploadContent(e.target.value)}
            rows={8}
            className="input-field text-sm mb-3 font-mono"
            placeholder={t('dtao.contentPlaceholder')}
          />
          <label className="flex items-center gap-2 text-sm mb-3">
            <input
              type="checkbox"
              checked={uploadSeal}
              onChange={(e) => setUploadSeal(e.target.checked)}
            />
            {t('dtao.sealOnUpload')}
          </label>
          {uploadError && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-xs mb-3">{uploadError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setUploadTargetDocId(null)} className="btn-secondary text-sm">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleUpload}
              className="btn-orange text-sm"
              disabled={!uploadContent || !uploadFileName.trim()}
            >
              <Upload size={14} className="inline mr-1" />
              {t('dtao.upload')}
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
  icon, label, value, mono,
}: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        {icon}
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-lg font-semibold text-gray-900 ${mono ? 'font-mono text-sm' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function VaultTab({
  active, onClick, icon, label, count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
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
      <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded">{count}</span>
    </button>
  );
}

function DocumentRow({
  doc, canUpdate, canApprove, onUpload, onSeal,
}: {
  doc: DtaoDocument;
  canUpdate: boolean;
  canApprove: boolean;
  onUpload: () => void;
  onSeal: () => void;
}) {
  const { t } = useTranslation();
  const latest = doc.latestVersion;

  return (
    <div className="p-4 hover:bg-gray-50 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className={`p-2 rounded ${doc.isSealed ? 'bg-green-50' : 'bg-gray-100'}`}>
          {doc.isSealed ? (
            <Lock size={16} className="text-green-700" />
          ) : (
            <Unlock size={16} className="text-gray-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 truncate">{doc.titleFr}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {t(`dtao.docTypes.${doc.documentType}`)}
            {latest && (
              <>
                {' · '}v{latest.versionNumber}
                {' · '}
                <span className="font-mono">{latest.sha256Hash.slice(0, 10)}…</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!doc.isSealed && canUpdate && (
          <button
            onClick={onUpload}
            className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
          >
            <Upload size={12} />
            {latest ? t('dtao.newVersion') : t('dtao.upload')}
          </button>
        )}
        {!doc.isSealed && latest && (canApprove || canUpdate) && (
          <button
            onClick={onSeal}
            className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
          >
            <Lock size={12} />
            {t('dtao.seal')}
          </button>
        )}
      </div>
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
