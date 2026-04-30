import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useCCCStore } from '../../stores/cccStore';
import apiClient from '../../api/client';

interface ProjectOption {
  id: string;
  referenceNumber: string;
  titleFr: string;
  status: string;
}

const ELIGIBLE_STATUSES = [
  'BID_OPENING', 'TECHNICAL_EVALUATION', 'COMMERCIAL_EVALUATION',
  'BID_RECEPTION', 'ADJUDICATION',
];

export default function CCCForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createMeeting, loading, error, clearError } = useCCCStore();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [form, setForm] = useState({
    projectId: '',
    subject: '',
    scheduledAt: '',
    location: '',
    phase: '' as '' | 'TECHNICAL' | 'COMMERCIAL',
    quorumRequired: 3,
  });

  useEffect(() => {
    apiClient.get('/projects', { params: { limit: 100 } }).then((res) => {
      const eligible = (res.data.data || []).filter((p: ProjectOption) =>
        ELIGIBLE_STATUSES.includes(p.status)
      );
      setProjects(eligible);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      const meeting = await createMeeting({
        projectId: form.projectId,
        subject: form.subject,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        location: form.location || undefined,
        phase: form.phase || undefined,
        quorumRequired: form.quorumRequired,
      });
      navigate(`/ccc/${meeting.id}`);
    } catch { /* error displayed via store */ }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/ccc')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-sonatrach-navy">{t('ccc.scheduleMeeting', 'Programmer une réunion CCC')}</h1>
          <p className="text-gray-500 mt-1">{t('ccc.scheduleSubtitle', 'Planifier une session de la Commission de Contrôle des Commandes')}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('ccc.project', 'Projet')} *</label>
          <select
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            required
            className="input w-full"
          >
            <option value="">{t('ccc.selectProject', '— Sélectionner un projet —')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.referenceNumber} — {p.titleFr}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">{t('ccc.eligibleStatusesHint', 'Projets éligibles: en phase de réception, ouverture ou évaluation.')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('ccc.subject', 'Sujet')} *</label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            required
            minLength={3}
            placeholder={t('ccc.subjectPlaceholder', 'Évaluation technique — Marché XYZ')}
            className="input w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('ccc.scheduledAt', 'Date et heure')} *</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              required
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('ccc.location', 'Lieu')}</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder={t('ccc.locationPlaceholder', 'Salle de réunion B3')}
              className="input w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('ccc.phase', 'Phase')}</label>
            <select
              value={form.phase}
              onChange={(e) => setForm({ ...form, phase: e.target.value as any })}
              className="input w-full"
            >
              <option value="">—</option>
              <option value="TECHNICAL">{t('ccc.phases.TECHNICAL', 'Technique')}</option>
              <option value="COMMERCIAL">{t('ccc.phases.COMMERCIAL', 'Commerciale')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('ccc.quorumRequired', 'Quorum requis')}</label>
            <input
              type="number"
              value={form.quorumRequired}
              onChange={(e) => setForm({ ...form, quorumRequired: Math.max(3, parseInt(e.target.value) || 3) })}
              min={3}
              className="input w-full"
            />
            <p className="text-xs text-gray-400 mt-1">{t('ccc.quorumHint', 'Minimum 3 membres présents pour ouvrir la session.')}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={() => navigate('/ccc')} className="btn-secondary">
            {t('common.cancel', 'Annuler')}
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? t('common.loading', 'Chargement...') : t('ccc.scheduleMeeting', 'Programmer la réunion')}
          </button>
        </div>
      </form>
    </div>
  );
}
