import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileBox, Search, Building2, Shield, ShieldOff, Upload, Lock } from 'lucide-react';
import apiClient from '../../api/client';
import { useBidStore } from '../../stores/bidStore';
import { useSupplierStore } from '../../stores/supplierStore';
import type { Supplier } from '../../api/suppliers';

interface ProjectOption {
  id: string;
  referenceNumber: string;
  titleFr: string;
  status: string;
  bidDeadline?: string | null;
}

export default function BidReceptionForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { registerBid, uploadEnvelope, error, clearError } = useBidStore();
  const { fetchSuppliers, suppliers } = useSupplierStore();

  // Step 1: select project
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);

  // Step 2: select supplier
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Step 3: reception info
  const [receivedByName, setReceivedByName] = useState('');
  const [hasBidBond, setHasBidBond] = useState(false);
  const [bidBondAmount, setBidBondAmount] = useState('');
  const [bidBondExpiryDate, setBidBondExpiryDate] = useState('');

  // Step 4: envelope upload
  const [technicalFile, setTechnicalFile] = useState<File | null>(null);
  const [commercialFile, setCommercialFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [createdBidId, setCreatedBidId] = useState<string | null>(null);
  const [createdBidRef, setCreatedBidRef] = useState<string | null>(null);

  useEffect(() => {
    fetchSuppliers({ page: 1, limit: 100, isBlacklisted: false });
    // Load published/bid_reception projects
    apiClient.get('/projects', {
      params: { status: 'PUBLISHED', limit: 50 },
    }).then((r) => {
      const published: ProjectOption[] = r.data.data;
      apiClient.get('/projects', {
        params: { status: 'BID_RECEPTION', limit: 50 },
      }).then((r2) => {
        setProjects([...published, ...r2.data.data]);
      });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProjects = projects.filter((p) =>
    !projectSearch ||
    p.referenceNumber.toLowerCase().includes(projectSearch.toLowerCase()) ||
    p.titleFr.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter((s) =>
    !supplierSearch ||
    s.companyNameFr.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.registrationNumber.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  async function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Strip "data:*/*;base64," prefix
        const b64 = dataUrl.split(',')[1] || '';
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit() {
    if (!selectedProject || !selectedSupplier || !receivedByName.trim() || !technicalFile || !commercialFile) {
      return;
    }
    setSubmitting(true);
    clearError();
    try {
      // Register bid
      const bid = await registerBid({
        projectId: selectedProject.id,
        supplierId: selectedSupplier.id,
        receivedByName: receivedByName.trim(),
        receivedAt: new Date().toISOString(),
        hasBidBond,
        bidBondAmount: hasBidBond && bidBondAmount ? parseFloat(bidBondAmount) : undefined,
        bidBondExpiryDate: hasBidBond && bidBondExpiryDate ? new Date(bidBondExpiryDate).toISOString() : undefined,
      });
      setCreatedBidId(bid.id);
      setCreatedBidRef(bid.referenceNumber);

      // Upload technical envelope
      const techB64 = await readFileAsBase64(technicalFile);
      await uploadEnvelope(bid.id, 'TECHNICAL', technicalFile.name, techB64);

      // Upload commercial envelope
      const commB64 = await readFileAsBase64(commercialFile);
      await uploadEnvelope(bid.id, 'COMMERCIAL', commercialFile.name, commB64);

      // Navigate to detail page
      navigate(`/bids/${bid.id}`);
    } catch {
      // Errors surface via store
    } finally {
      setSubmitting(false);
    }
  }

  const canAdvance1 = !!selectedProject;
  const canAdvance2 = !!selectedSupplier;
  const canAdvance3 = receivedByName.trim().length >= 2 && (!hasBidBond || (bidBondAmount && bidBondExpiryDate));
  const canSubmit = canAdvance1 && canAdvance2 && canAdvance3 && technicalFile && commercialFile;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/bids')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="p-2.5 bg-sonatrach-navy/10 rounded-xl">
          <FileBox size={24} className="text-sonatrach-navy" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sonatrach-navy">
            {t('bids.reception.title')}
          </h1>
          <p className="text-sm text-gray-500">{t('bids.reception.subtitle')}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between px-2">
        {[
          { n: 1, label: t('bids.reception.step1') },
          { n: 2, label: t('bids.reception.step2') },
          { n: 3, label: t('bids.reception.step3') },
          { n: 4, label: t('bids.reception.step4') },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step === s.n
                  ? 'bg-sonatrach-orange text-white'
                  : step > s.n
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}>
                {s.n}
              </div>
              <span className="text-xs mt-1 text-gray-600 text-center">{s.label}</span>
            </div>
            {i < 3 && <div className={`flex-1 h-0.5 mx-2 ${step > s.n ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* Step 1: Project */}
      {step === 1 && (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{t('bids.reception.selectProject')}</h2>
          <p className="text-sm text-gray-500">{t('bids.reception.selectProjectHelp')}</p>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder={t('bids.reception.searchProject')}
              className="input-field pl-10"
            />
          </div>
          <div className="divide-y divide-gray-100 border rounded-lg max-h-80 overflow-y-auto">
            {filteredProjects.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                {t('bids.reception.noEligibleProjects')}
              </div>
            ) : (
              filteredProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between gap-3 ${
                    selectedProject?.id === p.id ? 'bg-sonatrach-orange/10' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-sonatrach-navy">
                        {p.referenceNumber}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">{p.status}</span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 truncate">{p.titleFr}</div>
                    {p.bidDeadline && (
                      <div className="text-xs text-gray-400">
                        {t('bids.reception.deadline')}: {new Date(p.bidDeadline).toLocaleString('fr-FR')}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="flex justify-end">
            <button
              disabled={!canAdvance1}
              onClick={() => setStep(2)}
              className="btn-orange disabled:opacity-50"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Supplier */}
      {step === 2 && (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{t('bids.reception.selectSupplier')}</h2>
          <p className="text-sm text-gray-500">{t('bids.reception.selectSupplierHelp')}</p>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              placeholder={t('bids.reception.searchSupplier')}
              className="input-field pl-10"
            />
          </div>
          <div className="divide-y divide-gray-100 border rounded-lg max-h-80 overflow-y-auto">
            {filteredSuppliers.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                {t('common.noData')}
              </div>
            ) : (
              filteredSuppliers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSupplier(s)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 ${
                    selectedSupplier?.id === s.id ? 'bg-sonatrach-orange/10' : ''
                  }`}
                >
                  <Building2 size={20} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{s.companyNameFr}</div>
                    <div className="text-xs font-mono text-gray-500">{s.registrationNumber}</div>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary">{t('common.back')}</button>
            <button
              disabled={!canAdvance2}
              onClick={() => setStep(3)}
              className="btn-orange disabled:opacity-50"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Reception info */}
      {step === 3 && (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{t('bids.reception.receptionInfo')}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('bids.reception.receivedByName')} *
            </label>
            <input
              type="text"
              required
              value={receivedByName}
              onChange={(e) => setReceivedByName(e.target.value)}
              placeholder={t('bids.reception.receivedByPlaceholder')}
              className="input-field"
            />
            <p className="text-xs text-gray-500 mt-1">{t('bids.reception.receivedByHelp')}</p>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasBidBond}
                onChange={(e) => setHasBidBond(e.target.checked)}
              />
              <span className="font-medium">{t('bids.reception.hasBidBond')}</span>
            </label>
            {hasBidBond && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pl-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {t('bids.reception.bidBondAmount')} (DZD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bidBondAmount}
                    onChange={(e) => setBidBondAmount(e.target.value)}
                    className="input-field text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {t('bids.reception.bidBondExpiry')}
                  </label>
                  <input
                    type="date"
                    value={bidBondExpiryDate}
                    onChange={(e) => setBidBondExpiryDate(e.target.value)}
                    className="input-field text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn-secondary">{t('common.back')}</button>
            <button
              disabled={!canAdvance3}
              onClick={() => setStep(4)}
              className="btn-orange disabled:opacity-50"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Envelopes */}
      {step === 4 && (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{t('bids.reception.uploadEnvelopes')}</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>{t('bids.reception.sealNote')}</strong>
          </div>

          <EnvelopeUpload
            vault="TECHNICAL"
            icon={<Shield size={16} className="text-blue-600" />}
            label={t('bids.reception.technicalEnvelope')}
            description={t('bids.reception.technicalEnvelopeHelp')}
            file={technicalFile}
            onFile={setTechnicalFile}
          />

          <EnvelopeUpload
            vault="COMMERCIAL"
            icon={<ShieldOff size={16} className="text-amber-600" />}
            label={t('bids.reception.commercialEnvelope')}
            description={t('bids.reception.commercialEnvelopeHelp')}
            file={commercialFile}
            onFile={setCommercialFile}
          />

          <div className="pt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1 border">
            <div><strong>{t('bids.reception.summary')}:</strong></div>
            <div>• {t('bids.reception.project')}: <span className="font-mono">{selectedProject?.referenceNumber}</span></div>
            <div>• {t('bids.reception.supplier')}: {selectedSupplier?.companyNameFr}</div>
            <div>• {t('bids.reception.receivedBy')}: {receivedByName}</div>
            {hasBidBond && <div>• {t('bids.reception.bidBond')}: {bidBondAmount} DZD</div>}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="btn-secondary" disabled={submitting}>
              {t('common.back')}
            </button>
            <button
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
              className="btn-orange disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('bids.reception.registering')}
                </>
              ) : (
                <>
                  <Lock size={14} />
                  {t('bids.reception.finalizeAndSeal')}
                </>
              )}
            </button>
          </div>

          {createdBidRef && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm">
              {t('bids.reception.registered')}: <strong>{createdBidRef}</strong>
            </div>
          )}
          {createdBidId && !createdBidRef && (
            <div className="text-xs text-gray-500">Bid ID: {createdBidId}</div>
          )}
        </div>
      )}
    </div>
  );
}

function EnvelopeUpload({
  icon, label, description, file, onFile,
}: {
  vault: 'TECHNICAL' | 'COMMERCIAL';
  icon: React.ReactNode;
  label: string;
  description: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-medium text-sm">{label}</span>
      </div>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <label className="block cursor-pointer">
        <input
          type="file"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <div className={`border-2 border-dashed rounded-lg p-4 text-center text-sm transition-colors ${
          file ? 'border-green-400 bg-green-50 text-green-800' : 'border-gray-300 text-gray-500 hover:border-gray-400'
        }`}>
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <Upload size={14} />
              <span className="font-mono">{file.name}</span>
              <span className="text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Upload size={14} />
              Cliquer pour sélectionner un fichier
            </div>
          )}
        </div>
      </label>
    </div>
  );
}
