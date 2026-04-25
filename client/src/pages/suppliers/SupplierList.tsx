import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Search, Building2, ShieldOff, Check, X, AlertTriangle,
} from 'lucide-react';
import { useSupplierStore } from '../../stores/supplierStore';
import PermissionGate from '../../components/auth/PermissionGate';

export default function SupplierList() {
  const { t } = useTranslation();
  const {
    suppliers, pagination, filters, loading, error,
    fetchSuppliers, setFilters, createSupplier, setBlacklist, clearError,
  } = useSupplierStore();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [blacklistTarget, setBlacklistTarget] = useState<{ id: string; name: string; isBlacklisted: boolean } | null>(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    registrationNumber: '',
    companyNameFr: '',
    companyNameAr: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    wilaya: '',
  });

  useEffect(() => {
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function handleSearch() {
    setFilters({ search: search || undefined, page: 1 });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await createSupplier({
        registrationNumber: form.registrationNumber.trim().toUpperCase(),
        companyNameFr: form.companyNameFr.trim(),
        companyNameAr: form.companyNameAr.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        address: form.address.trim() || undefined,
        wilaya: form.wilaya.trim() || undefined,
      });
      setShowForm(false);
      setForm({
        registrationNumber: '', companyNameFr: '', companyNameAr: '',
        contactEmail: '', contactPhone: '', address: '', wilaya: '',
      });
      fetchSuppliers();
    } catch (err: any) {
      setFormError(err.message);
    }
  }

  async function confirmBlacklist() {
    if (!blacklistTarget) return;
    try {
      await setBlacklist(
        blacklistTarget.id,
        !blacklistTarget.isBlacklisted,
        !blacklistTarget.isBlacklisted ? blacklistReason : undefined
      );
      setBlacklistTarget(null);
      setBlacklistReason('');
    } catch {
      /* handled via store */
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sonatrach-navy/10 rounded-xl">
            <Building2 size={24} className="text-sonatrach-navy" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sonatrach-navy">
              {t('suppliers.title')}
            </h1>
            <p className="text-sm text-gray-500">{t('suppliers.subtitle')}</p>
          </div>
        </div>
        <PermissionGate permission="bid:register">
          <button onClick={() => setShowForm(true)} className="btn-orange flex items-center gap-2">
            <Plus size={18} />
            {t('suppliers.register')}
          </button>
        </PermissionGate>
      </div>

      <div className="card">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('suppliers.searchPlaceholder')}
              className="input-field pl-10"
            />
          </div>
          <button onClick={handleSearch} className="btn-primary">{t('common.search')}</button>
          <select
            value={filters.isBlacklisted === true ? 'true' : filters.isBlacklisted === false ? 'false' : ''}
            onChange={(e) => {
              const v = e.target.value;
              setFilters({
                isBlacklisted: v === '' ? undefined : v === 'true',
                page: 1,
              });
            }}
            className="input-field text-sm max-w-[200px]"
          >
            <option value="">{t('suppliers.allStatuses')}</option>
            <option value="false">{t('suppliers.activeOnly')}</option>
            <option value="true">{t('suppliers.blacklistedOnly')}</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-900"><X size={16} /></button>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('suppliers.registrationNumber')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('suppliers.companyName')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('suppliers.wilaya')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('suppliers.contact')}
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('suppliers.bidsCount')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('common.status')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {t('common.actions')}
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
            ) : !suppliers.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Building2 size={32} className="text-gray-300" />
                    {t('common.noData')}
                  </div>
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className={s.isBlacklisted ? 'bg-red-50/40' : 'hover:bg-blue-50/50'}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-sonatrach-navy bg-sonatrach-navy/5 px-2 py-1 rounded">
                      {s.registrationNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{s.companyNameFr}</div>
                    {s.companyNameAr && (
                      <div className="text-xs text-gray-400" dir="rtl">{s.companyNameAr}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {s.wilaya || '—'}{s.country !== 'DZ' && ` (${s.country})`}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {s.contactEmail && <div>{s.contactEmail}</div>}
                    {s.contactPhone && <div className="font-mono">{s.contactPhone}</div>}
                    {!s.contactEmail && !s.contactPhone && '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {s._count?.bids ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    {s.isBlacklisted ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
                        <ShieldOff size={12} /> {t('suppliers.blacklisted')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                        <Check size={12} /> {t('suppliers.active')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PermissionGate permission="bid:register">
                      <button
                        onClick={() => {
                          setBlacklistTarget({ id: s.id, name: s.companyNameFr, isBlacklisted: s.isBlacklisted });
                          setBlacklistReason(s.blacklistReason || '');
                        }}
                        className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${
                          s.isBlacklisted
                            ? 'border-green-300 text-green-700 hover:bg-green-50'
                            : 'border-red-300 text-red-700 hover:bg-red-50'
                        }`}
                      >
                        {s.isBlacklisted ? t('suppliers.unblacklist') : t('suppliers.blacklist')}
                      </button>
                    </PermissionGate>
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
              {t('suppliers.suppliersCount')}
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

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-xl max-w-xl w-full p-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{t('suppliers.register')}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('suppliers.registrationNumber') + ' *'}>
                <input
                  required
                  value={form.registrationNumber}
                  onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                  className="input-field text-sm font-mono uppercase"
                  placeholder="RC12345/NIF..."
                />
              </Field>
              <Field label={t('suppliers.wilaya')}>
                <input
                  value={form.wilaya}
                  onChange={(e) => setForm({ ...form, wilaya: e.target.value })}
                  className="input-field text-sm"
                  placeholder="Alger"
                />
              </Field>
              <Field label={t('suppliers.companyNameFr') + ' *'} full>
                <input
                  required
                  value={form.companyNameFr}
                  onChange={(e) => setForm({ ...form, companyNameFr: e.target.value })}
                  className="input-field text-sm"
                />
              </Field>
              <Field label={t('suppliers.companyNameAr')} full>
                <input
                  value={form.companyNameAr}
                  onChange={(e) => setForm({ ...form, companyNameAr: e.target.value })}
                  className="input-field text-sm"
                  dir="rtl"
                />
              </Field>
              <Field label={t('suppliers.contactEmail')}>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  className="input-field text-sm"
                />
              </Field>
              <Field label={t('suppliers.contactPhone')}>
                <input
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  className="input-field text-sm font-mono"
                />
              </Field>
              <Field label={t('suppliers.address')} full>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="input-field text-sm"
                />
              </Field>
            </div>

            {formError && (
              <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-xs">{formError}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-orange">
                {t('common.create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Blacklist modal */}
      {blacklistTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={20} className="text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                {blacklistTarget.isBlacklisted ? t('suppliers.unblacklistTitle') : t('suppliers.blacklistTitle')}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              <strong>{blacklistTarget.name}</strong>
            </p>
            {!blacklistTarget.isBlacklisted && (
              <>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t('suppliers.blacklistReason')} *
                </label>
                <textarea
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                  rows={3}
                  required
                  className="input-field text-sm mb-3"
                  placeholder={t('suppliers.blacklistReasonPlaceholder')}
                />
              </>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setBlacklistTarget(null)} className="btn-secondary text-sm">
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmBlacklist}
                disabled={!blacklistTarget.isBlacklisted && !blacklistReason.trim()}
                className="btn-orange text-sm disabled:opacity-50"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
