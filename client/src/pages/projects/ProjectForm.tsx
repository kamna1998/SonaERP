import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, FileText, DollarSign, Calendar, Tag, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';

const PROCUREMENT_MODES = [
  { value: 'COMMANDE_SANS_CONSULT', maxAmount: 1_000_000 },
  { value: 'GRE_A_GRE_SIMPLE', maxAmount: 6_000_000 },
  { value: 'CONSULTATION_DIRECTE', maxAmount: 12_000_000 },
  { value: 'APPEL_OFFRES_OUVERT', minAmount: 12_000_001 },
  { value: 'APPEL_OFFRES_RESTREINT', minAmount: 12_000_001 },
  { value: 'GRE_A_GRE_APRES_CONSULT' },
] as const;

const NATIONAL_THRESHOLD = 100_000_000;

function getValidModes(budget: number) {
  const modes: string[] = [];
  if (budget <= 1_000_000) modes.push('COMMANDE_SANS_CONSULT');
  if (budget <= 6_000_000) modes.push('GRE_A_GRE_SIMPLE');
  if (budget <= 12_000_000) modes.push('CONSULTATION_DIRECTE');
  if (budget > 12_000_000) {
    modes.push('APPEL_OFFRES_OUVERT');
    modes.push('APPEL_OFFRES_RESTREINT');
  }
  modes.push('GRE_A_GRE_APRES_CONSULT');
  return [...new Set(modes)];
}

function formatDZD(amount: number): string {
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface FormErrors {
  titleFr?: string;
  objectFr?: string;
  procurementMode?: string;
  estimatedBudget?: string;
  fiscalYear?: string;
}

export default function ProjectForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createProject, loading, error, clearError } = useProjectStore();

  const [form, setForm] = useState({
    titleFr: '',
    titleAr: '',
    titleEn: '',
    descriptionFr: '',
    descriptionAr: '',
    objectFr: '',
    procurementMode: '',
    estimatedBudget: '',
    budgetLineRef: '',
    fiscalYear: new Date().getFullYear(),
    publicationDate: '',
    bidDeadline: '',
    tags: '' as string,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const budgetNum = parseFloat(form.estimatedBudget) || 0;
  const validModes = budgetNum > 0 ? getValidModes(budgetNum) : PROCUREMENT_MODES.map((m) => m.value);
  const isAboveThreshold = budgetNum > NATIONAL_THRESHOLD;

  function updateField(field: string, value: string | number) {
    clearError();
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!form.titleFr || form.titleFr.length < 3) {
      errs.titleFr = t('projects.form.errors.titleRequired');
    }
    if (!form.objectFr || form.objectFr.length < 5) {
      errs.objectFr = t('projects.form.errors.objectRequired');
    }
    if (!form.procurementMode) {
      errs.procurementMode = t('projects.form.errors.modeRequired');
    }
    if (!form.estimatedBudget || budgetNum <= 0) {
      errs.estimatedBudget = t('projects.form.errors.budgetRequired');
    }
    if (form.procurementMode && budgetNum > 0 && !validModes.includes(form.procurementMode)) {
      errs.procurementMode = t('projects.form.errors.modeInvalidForBudget');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: Record<string, any> = {
      titleFr: form.titleFr,
      objectFr: form.objectFr,
      procurementMode: form.procurementMode,
      estimatedBudget: form.estimatedBudget,
      fiscalYear: form.fiscalYear,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };
    if (form.titleAr) payload.titleAr = form.titleAr;
    if (form.titleEn) payload.titleEn = form.titleEn;
    if (form.descriptionFr) payload.descriptionFr = form.descriptionFr;
    if (form.descriptionAr) payload.descriptionAr = form.descriptionAr;
    if (form.budgetLineRef) payload.budgetLineRef = form.budgetLineRef;
    if (form.publicationDate) payload.publicationDate = new Date(form.publicationDate).toISOString();
    if (form.bidDeadline) payload.bidDeadline = new Date(form.bidDeadline).toISOString();

    try {
      const project = await createProject(payload);
      navigate(`/projects/${project.id}`);
    } catch {
      // error is set in store
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/projects')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-sonatrach-navy">
            {t('projects.form.createTitle')}
          </h1>
          <p className="text-sm text-gray-500">{t('projects.form.createSubtitle')}</p>
        </div>
      </div>

      {/* Server error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Identification */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={18} className="text-sonatrach-navy" />
            <h2 className="text-lg font-semibold text-sonatrach-navy">
              {t('projects.form.sectionIdentification')}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('projects.form.titleFr')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.titleFr}
                onChange={(e) => updateField('titleFr', e.target.value)}
                placeholder={t('projects.form.titleFrPlaceholder')}
                className={`input-field ${errors.titleFr ? 'border-red-400 focus:ring-red-400' : ''}`}
              />
              {errors.titleFr && <p className="text-red-500 text-xs mt-1">{errors.titleFr}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('projects.form.titleAr')}
                </label>
                <input
                  type="text"
                  value={form.titleAr}
                  onChange={(e) => updateField('titleAr', e.target.value)}
                  dir="rtl"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('projects.form.titleEn')}
                </label>
                <input
                  type="text"
                  value={form.titleEn}
                  onChange={(e) => updateField('titleEn', e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('projects.form.objectFr')} <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={form.objectFr}
                onChange={(e) => updateField('objectFr', e.target.value)}
                placeholder={t('projects.form.objectFrPlaceholder')}
                className={`input-field resize-none ${errors.objectFr ? 'border-red-400 focus:ring-red-400' : ''}`}
              />
              {errors.objectFr && <p className="text-red-500 text-xs mt-1">{errors.objectFr}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('projects.form.descriptionFr')}
                </label>
                <textarea
                  rows={2}
                  value={form.descriptionFr}
                  onChange={(e) => updateField('descriptionFr', e.target.value)}
                  className="input-field resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('projects.form.descriptionAr')}
                </label>
                <textarea
                  rows={2}
                  value={form.descriptionAr}
                  onChange={(e) => updateField('descriptionAr', e.target.value)}
                  dir="rtl"
                  className="input-field resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Mode & Budget */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-sonatrach-navy" />
            <h2 className="text-lg font-semibold text-sonatrach-navy">
              {t('projects.form.sectionBudget')}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('projects.form.estimatedBudget')} (DZD) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.estimatedBudget}
                onChange={(e) => updateField('estimatedBudget', e.target.value)}
                placeholder="0.00"
                className={`input-field font-mono ${errors.estimatedBudget ? 'border-red-400 focus:ring-red-400' : ''}`}
              />
              {errors.estimatedBudget && <p className="text-red-500 text-xs mt-1">{errors.estimatedBudget}</p>}
              {budgetNum > 0 && (
                <p className="text-xs text-gray-500 mt-1">{formatDZD(budgetNum)}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('projects.procurementMode')} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.procurementMode}
                onChange={(e) => updateField('procurementMode', e.target.value)}
                className={`input-field ${errors.procurementMode ? 'border-red-400 focus:ring-red-400' : ''}`}
              >
                <option value="">{t('projects.form.selectMode')}</option>
                {PROCUREMENT_MODES.map((m) => (
                  <option
                    key={m.value}
                    value={m.value}
                    disabled={budgetNum > 0 && !validModes.includes(m.value)}
                  >
                    {t(`projects.modes.${m.value}`)}
                    {budgetNum > 0 && !validModes.includes(m.value) ? ` (${t('projects.form.notAllowed')})` : ''}
                  </option>
                ))}
              </select>
              {errors.procurementMode && <p className="text-red-500 text-xs mt-1">{errors.procurementMode}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('projects.fiscalYear')} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.fiscalYear}
                onChange={(e) => updateField('fiscalYear', Number(e.target.value))}
                className="input-field"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('projects.form.budgetLineRef')}
              </label>
              <input
                type="text"
                value={form.budgetLineRef}
                onChange={(e) => updateField('budgetLineRef', e.target.value)}
                placeholder="BL-2026-XXX"
                className="input-field font-mono"
              />
            </div>
          </div>

          {/* Threshold warnings */}
          {isAboveThreshold && (
            <div className="mt-4 flex items-start gap-2 bg-amber-50 text-amber-800 px-4 py-3 rounded-lg text-sm border border-amber-200">
              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">{t('projects.form.thresholdWarningTitle')}</p>
                <p className="text-xs mt-1">{t('projects.form.thresholdWarningDesc')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Timeline */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-sonatrach-navy" />
            <h2 className="text-lg font-semibold text-sonatrach-navy">
              {t('projects.form.sectionTimeline')}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('projects.form.publicationDate')}
              </label>
              <input
                type="date"
                value={form.publicationDate}
                onChange={(e) => updateField('publicationDate', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('projects.form.bidDeadline')}
              </label>
              <input
                type="date"
                value={form.bidDeadline}
                onChange={(e) => updateField('bidDeadline', e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Tags */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Tag size={18} className="text-sonatrach-navy" />
            <h2 className="text-lg font-semibold text-sonatrach-navy">
              {t('projects.form.sectionTags')}
            </h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('projects.form.tagsLabel')}
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => updateField('tags', e.target.value)}
              placeholder={t('projects.form.tagsPlaceholder')}
              className="input-field"
            />
            <p className="text-xs text-gray-400 mt-1">{t('projects.form.tagsHint')}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="btn-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-orange flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {t('projects.form.submitCreate')}
          </button>
        </div>
      </form>
    </div>
  );
}
