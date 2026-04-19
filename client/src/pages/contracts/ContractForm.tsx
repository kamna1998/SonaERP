import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileText, Banknote, Calendar, Building2 } from 'lucide-react';
import apiClient from '../../api/client';
import { useContractStore } from '../../stores/contractStore';

interface ProjectOption {
  id: string;
  referenceNumber: string;
  titleFr: string;
  status: string;
}

interface SupplierOption {
  id: string;
  registrationNumber: string;
  companyNameFr: string;
  isBlacklisted: boolean;
}

interface BidOption {
  id: string;
  referenceNumber: string;
  supplier: { id: string; companyNameFr: string };
  status: string;
}

export default function ContractForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createContract, error, clearError } = useContractStore();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [awardedBids, setAwardedBids] = useState<BidOption[]>([]);

  const [projectId, setProjectId] = useState('');
  const [awardedBidId, setAwardedBidId] = useState('');
  const [titleFr, setTitleFr] = useState('');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [supplierId, setSupplierId] = useState('');
  const [currency, setCurrency] = useState('DZD');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [retentionRate, setRetentionRate] = useState<number | ''>('');
  const [advancePaymentRate, setAdvancePaymentRate] = useState<number | ''>('');
  const [durationMonths, setDurationMonths] = useState<number | ''>('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Load projects in ADJUDICATION / CONTRACT_DRAFTING status
  useEffect(() => {
    Promise.all([
      apiClient.get('/projects', { params: { status: 'ADJUDICATION', limit: 50 } }).catch(() => ({ data: { data: [] } })),
      apiClient.get('/projects', { params: { status: 'CONTRACT_DRAFTING', limit: 50 } }).catch(() => ({ data: { data: [] } })),
    ]).then((results) => {
      const merged: ProjectOption[] = [];
      for (const r of results) {
        if (r.data?.data) merged.push(...r.data.data);
      }
      setProjects(merged);
    });
  }, []);

  // Load suppliers (non-blacklisted)
  useEffect(() => {
    apiClient
      .get('/suppliers', { params: { isBlacklisted: false, limit: 100 } })
      .then((r) => setSuppliers(r.data?.data || []))
      .catch(() => setSuppliers([]));
  }, []);

  // Load AWARDED bids for the selected project
  useEffect(() => {
    if (!projectId) {
      setAwardedBids([]);
      setAwardedBidId('');
      return;
    }
    apiClient
      .get(`/bids/by-project/${projectId}`)
      .then((r) => {
        const bids = (r.data?.data || []).filter((b: any) => b.status === 'AWARDED');
        setAwardedBids(bids);
        // Auto-select if there's only one
        if (bids.length === 1) {
          setAwardedBidId(bids[0].id);
          setSupplierId(bids[0].supplier.id);
        }
      })
      .catch(() => setAwardedBids([]));
  }, [projectId]);

  // When awarded bid changes, auto-select its supplier
  useEffect(() => {
    if (!awardedBidId) return;
    const bid = awardedBids.find((b) => b.id === awardedBidId);
    if (bid?.supplier?.id) setSupplierId(bid.supplier.id);
  }, [awardedBidId, awardedBids]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !titleFr.trim() || !totalAmount || !supplierId) return;
    setSubmitting(true);
    clearError();
    try {
      const contract = await createContract({
        projectId,
        awardedBidId: awardedBidId || undefined,
        titleFr: titleFr.trim(),
        totalAmount: Number(totalAmount),
        currency,
        supplierId,
        paymentTerms: paymentTerms.trim() || undefined,
        retentionRate: retentionRate !== '' ? Number(retentionRate) : undefined,
        advancePaymentRate: advancePaymentRate !== '' ? Number(advancePaymentRate) : undefined,
        durationMonths: durationMonths !== '' ? Number(durationMonths) : undefined,
        effectiveDate: effectiveDate ? new Date(effectiveDate).toISOString() : undefined,
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      });
      navigate(`/contracts/${contract.id}`);
    } catch {
      // handled by store
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button onClick={() => navigate('/contracts')} className="btn-secondary flex items-center gap-2 text-sm">
        <ArrowLeft size={16} />
        {t('common.back')}
      </button>

      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-sonatrach-navy/10 rounded-xl">
          <FileText size={24} className="text-sonatrach-navy" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sonatrach-navy">{t('contracts.createContract')}</h1>
          <p className="text-sm text-gray-500">{t('contracts.createSubtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5">
        {/* Project */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('contracts.project')} <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="input-field"
          >
            <option value="">{t('contracts.selectProject')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.referenceNumber} — {p.titleFr} [{p.status}]
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">{t('contracts.eligibleStatusesHint')}</p>
        </div>

        {/* Awarded bid */}
        {projectId && awardedBids.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('contracts.awardedBid')}
            </label>
            <select
              value={awardedBidId}
              onChange={(e) => setAwardedBidId(e.target.value)}
              className="input-field"
            >
              <option value="">—</option>
              {awardedBids.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.referenceNumber} — {b.supplier.companyNameFr}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('contracts.contractTitle')} <span className="text-red-500">*</span>
          </label>
          <input
            required
            minLength={3}
            maxLength={500}
            value={titleFr}
            onChange={(e) => setTitleFr(e.target.value)}
            className="input-field"
            placeholder={t('contracts.titlePlaceholder') || ''}
          />
        </div>

        {/* Amount + currency */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Banknote size={14} />
              {t('contracts.totalAmount')} <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="number"
              step="0.01"
              min={0}
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('contracts.currency')}</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field">
              <option value="DZD">DZD</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Supplier */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Building2 size={14} />
            {t('contracts.supplier')} <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="input-field"
          >
            <option value="">{t('contracts.selectSupplier')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.registrationNumber} — {s.companyNameFr}
              </option>
            ))}
          </select>
        </div>

        {/* Payment terms */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('contracts.paymentTerms')}</label>
          <textarea
            rows={2}
            maxLength={2000}
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            className="input-field"
          />
        </div>

        {/* Rates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('contracts.retentionRate')} (%)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              value={retentionRate}
              onChange={(e) => setRetentionRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('contracts.advancePaymentRate')} (%)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              value={advancePaymentRate}
              onChange={(e) => setAdvancePaymentRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('contracts.durationMonths')}
            </label>
            <input
              type="number"
              min={0}
              value={durationMonths}
              onChange={(e) => setDurationMonths(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              className="input-field"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Calendar size={14} />
              {t('contracts.effectiveDate')}
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Calendar size={14} />
              {t('contracts.expiryDate')}
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <button type="button" onClick={() => navigate('/contracts')} className="btn-secondary" disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-orange" disabled={submitting}>
            {submitting ? t('common.loading') : t('contracts.createContract')}
          </button>
        </div>
      </form>
    </div>
  );
}
