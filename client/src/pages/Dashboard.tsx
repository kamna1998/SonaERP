import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderKanban,
  Clock,
  FileText,
  FileSignature,
  TrendingUp,
  BarChart3,
  PieChart,
  Shield,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import {
  fetchOverview,
  fetchProjectStatusBreakdown,
  fetchBudgetConsumption,
  fetchLeadTime,
  fetchProcurementDistribution,
  fetchSavings,
  type OverviewKpis,
  type StatusBreakdown,
  type BudgetConsumption,
  type LeadTimeData,
  type ProcurementDistribution,
  type SavingsData,
} from '../api/dashboard';
import { verifyAuditChain } from '../api/reports';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  subtitle?: string;
}

function StatCard({ icon, label, value, color, subtitle }: StatCardProps) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-sonatrach-navy">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function formatDZD(amount: string): string {
  const n = parseFloat(amount);
  if (Number.isNaN(n)) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Mrd DA`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M DA`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} K DA`;
  return `${n.toFixed(0)} DA`;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  NEEDS_IDENTIFICATION: 'bg-yellow-100 text-yellow-700',
  DTAO_PREPARATION: 'bg-blue-100 text-blue-600',
  DTAO_REVIEW: 'bg-blue-100 text-blue-600',
  PUBLISHED: 'bg-indigo-100 text-indigo-600',
  BID_RECEPTION: 'bg-purple-100 text-purple-600',
  BID_OPENING: 'bg-purple-100 text-purple-600',
  TECHNICAL_EVALUATION: 'bg-orange-100 text-orange-600',
  COMMERCIAL_EVALUATION: 'bg-orange-100 text-orange-600',
  ADJUDICATION: 'bg-amber-100 text-amber-700',
  CONTRACT_DRAFTING: 'bg-cyan-100 text-cyan-600',
  CONTRACT_SIGNED: 'bg-green-100 text-green-600',
  IN_EXECUTION: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-200 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-600',
  DECLARED_INFRUCTUEUX: 'bg-red-100 text-red-600',
};

export default function Dashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [overview, setOverview] = useState<OverviewKpis | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [budget, setBudget] = useState<BudgetConsumption | null>(null);
  const [leadTime, setLeadTime] = useState<LeadTimeData | null>(null);
  const [procurement, setProcurement] = useState<ProcurementDistribution[]>([]);
  const [savings, setSavings] = useState<SavingsData | null>(null);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [ov, sb, bc, lt, pd, sv] = await Promise.all([
          fetchOverview(),
          fetchProjectStatusBreakdown(),
          fetchBudgetConsumption(),
          fetchLeadTime(),
          fetchProcurementDistribution(),
          fetchSavings(),
        ]);
        setOverview(ov);
        setStatusBreakdown(sb);
        setBudget(bc);
        setLeadTime(lt);
        setProcurement(pd);
        setSavings(sv);

        try {
          const chain = await verifyAuditChain();
          setChainValid(chain.valid);
        } catch {
          setChainValid(null);
        }
      } catch {
        // silently fail — cards will show 0
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalStatusCount = statusBreakdown.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sonatrach-navy">
            {t('dashboard.welcome')}, {user?.firstNameFr} {user?.lastNameFr}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('app.subtitle')} &mdash; {new Date().toLocaleDateString(
              user?.preferredLang === 'AR' ? 'ar-DZ' : user?.preferredLang === 'EN' ? 'en-US' : 'fr-FR',
              { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
            )}
          </p>
        </div>
        {chainValid !== null && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
            chainValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {chainValid
              ? <><CheckCircle size={16} /> {t('dashboard.chainIntact', 'Chaîne d\'audit intègre')}</>
              : <><AlertTriangle size={16} /> {t('dashboard.chainBroken', 'Chaîne d\'audit compromise')}</>
            }
          </div>
        )}
      </div>

      {/* Top-level KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FolderKanban size={24} className="text-blue-600" />}
          label={t('dashboard.activeProjects')}
          value={loading ? '…' : overview?.projects.active ?? 0}
          color="bg-blue-50"
          subtitle={loading ? '' : `${overview?.projects.total ?? 0} ${t('dashboard.total', 'total')}`}
        />
        <StatCard
          icon={<Clock size={24} className="text-yellow-600" />}
          label={t('dashboard.avgLeadTime', 'Délai moyen')}
          value={loading ? '…' : `${leadTime?.averageDays ?? 0}j`}
          color="bg-yellow-50"
          subtitle={loading ? '' : `${leadTime?.sampleSize ?? 0} ${t('dashboard.projectsSampled', 'projets mesurés')}`}
        />
        <StatCard
          icon={<FileText size={24} className="text-purple-600" />}
          label={t('dashboard.totalBids', 'Offres reçues')}
          value={loading ? '…' : overview?.bids.total ?? 0}
          color="bg-purple-50"
          subtitle={loading ? '' : `${overview?.bids.awarded ?? 0} ${t('dashboard.awarded', 'adjugées')}`}
        />
        <StatCard
          icon={<FileSignature size={24} className="text-green-600" />}
          label={t('dashboard.activeContracts')}
          value={loading ? '…' : overview?.contracts.active ?? 0}
          color="bg-green-50"
          subtitle={loading ? '' : `${overview?.contracts.total ?? 0} ${t('dashboard.total', 'total')}`}
        />
      </div>

      {/* Budget consumption + Savings row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Consumption */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={20} className="text-sonatrach-orange" />
            <h3 className="text-lg font-semibold text-sonatrach-navy">
              {t('dashboard.budgetConsumption', 'Consommation budgétaire')}
            </h3>
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm">{t('common.loading', 'Chargement...')}</p>
          ) : budget ? (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('dashboard.committed', 'Engagé')}</span>
                <span className="font-semibold">{formatDZD(budget.totalCommitted)} / {formatDZD(budget.totalBudget)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all ${
                    budget.overallConsumptionPct > 90 ? 'bg-red-500'
                    : budget.overallConsumptionPct > 70 ? 'bg-amber-500'
                    : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(budget.overallConsumptionPct, 100)}%` }}
                />
              </div>
              <p className="text-center text-sm font-medium text-sonatrach-navy">
                {budget.overallConsumptionPct}%
              </p>
              {budget.projects.slice(0, 5).map((p) => (
                <div key={p.projectId} className="flex justify-between text-xs text-gray-500">
                  <span className="truncate max-w-[60%]">{p.reference}</span>
                  <span className={`font-medium ${p.consumptionPct > 90 ? 'text-red-600' : 'text-gray-700'}`}>
                    {p.consumptionPct}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">{t('common.noData')}</p>
          )}
        </div>

        {/* Savings Analysis */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-green-600" />
            <h3 className="text-lg font-semibold text-sonatrach-navy">
              {t('dashboard.savings', 'Économies réalisées')}
            </h3>
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm">{t('common.loading', 'Chargement...')}</p>
          ) : savings ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-gray-500">{t('dashboard.estimated', 'Estimé')}</p>
                  <p className="text-sm font-bold text-sonatrach-navy">{formatDZD(savings.totalEstimated)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('dashboard.contracted', 'Contracté')}</p>
                  <p className="text-sm font-bold text-sonatrach-navy">{formatDZD(savings.totalContracted)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('dashboard.savingsAmount', 'Économie')}</p>
                  <p className={`text-sm font-bold ${savings.savingsPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {savings.savingsPct >= 0 ? '+' : ''}{savings.savingsPct}%
                  </p>
                </div>
              </div>
              {savings.projects.slice(0, 5).map((p) => (
                <div key={p.projectId} className="flex justify-between text-xs text-gray-500">
                  <span className="truncate max-w-[60%]">{p.reference}</span>
                  <span className={`font-medium ${p.savingsPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {p.savingsPct >= 0 ? '+' : ''}{p.savingsPct}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">{t('common.noData')}</p>
          )}
        </div>
      </div>

      {/* Status breakdown + Procurement distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Status Breakdown */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <PieChart size={20} className="text-indigo-600" />
            <h3 className="text-lg font-semibold text-sonatrach-navy">
              {t('dashboard.statusBreakdown', 'Répartition par statut')}
            </h3>
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm">{t('common.loading', 'Chargement...')}</p>
          ) : statusBreakdown.length > 0 ? (
            <div className="space-y-2">
              {statusBreakdown
                .sort((a, b) => b.count - a.count)
                .map((s) => (
                  <div key={s.status} className="flex items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t(`projectStatuses.${s.status}`, s.status)}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-sonatrach-navy h-2 rounded-full"
                        style={{ width: `${totalStatusCount > 0 ? (s.count / totalStatusCount) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600 w-8 text-right">{s.count}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">{t('common.noData')}</p>
          )}
        </div>

        {/* Procurement Mode Distribution */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={20} className="text-cyan-600" />
            <h3 className="text-lg font-semibold text-sonatrach-navy">
              {t('dashboard.procurementModes', 'Modes de passation')}
            </h3>
          </div>
          {loading ? (
            <p className="text-gray-400 text-sm">{t('common.loading', 'Chargement...')}</p>
          ) : procurement.length > 0 ? (
            <div className="space-y-3">
              {procurement.map((p) => (
                <div key={p.mode} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {t(`procurementModes.${p.mode}`, p.mode.replace(/_/g, ' '))}
                    </p>
                    <p className="text-xs text-gray-400">{formatDZD(p.totalBudget)}</p>
                  </div>
                  <span className="text-lg font-bold text-sonatrach-navy">{p.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">{t('common.noData')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
