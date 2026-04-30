import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Users, ListChecks, Play, Square, Gavel, FileText,
  Vote, UserPlus, Trash2, Check, X, Copy, Shield,
} from 'lucide-react';
import { useCCCStore } from '../../stores/cccStore';
import { useAuthStore } from '../../stores/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import apiClient from '../../api/client';
import type { CCCDecision, CCCVoteType } from '../../api/ccc';

function getSessionState(m: { startedAt: string | null; endedAt: string | null }) {
  if (m.endedAt) return 'closed';
  if (m.startedAt) return 'inSession';
  return 'scheduled';
}

export default function CCCDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const user = useAuthStore((s) => s.user);
  const {
    currentMeeting: meeting, loading, error,
    fetchMeetingById, addMember, removeMember, markAttendance,
    addAgendaItem, updateAgendaItem, startSession, recordVote,
    setDecision, generatePv, endSession, clearError, clearCurrent,
  } = useCCCStore();

  const [showAddMember, setShowAddMember] = useState(false);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; firstNameFr: string; lastNameFr: string; email: string }>>([]);

  const [agendaTitle, setAgendaTitle] = useState('');
  const [agendaDesc, setAgendaDesc] = useState('');

  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState<CCCDecision>('ADMIS');
  const [decisionRationale, setDecisionRationale] = useState('');
  const [awardedBidId, setAwardedBidId] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [projectBids, setProjectBids] = useState<Array<{ id: string; referenceNumber: string; supplier: { companyNameFr: string } }>>([]);

  const [showVoteModal, setShowVoteModal] = useState(false);
  const [voteSubjectType, setVoteSubjectType] = useState<string>('bid');
  const [voteSubjectId, setVoteSubjectId] = useState('');
  const [voteChoice, setVoteChoice] = useState<CCCVoteType>('POUR');
  const [voteReservation, setVoteReservation] = useState('');

  const [showPvModal, setShowPvModal] = useState(false);
  const [pvText, setPvText] = useState('');
  const [pvHash, setPvHash] = useState('');

  useEffect(() => {
    if (id) fetchMeetingById(id);
    return () => clearCurrent();
  }, [id]);

  useEffect(() => {
    if (showAddMember && users.length === 0) {
      apiClient.get('/users', { params: { limit: 200 } }).then((res) => {
        setUsers(res.data.data || []);
      });
    }
  }, [showAddMember]);

  useEffect(() => {
    if (showDecisionModal && decisionType === 'ADJUGE' && meeting) {
      apiClient.get(`/bids/by-project/${meeting.projectId}`).then((res) => {
        setProjectBids(res.data.data || []);
      });
    }
  }, [showDecisionModal, decisionType]);

  if (loading && !meeting) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-sonatrach-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">{error || t('common.noData')}</p>
        <button onClick={() => navigate('/ccc')} className="btn-secondary mt-4">{t('common.back')}</button>
      </div>
    );
  }

  const state = getSessionState(meeting);
  const presentCount = meeting.members.filter((m) => m.isPresent).length;
  const canSchedule = hasPermission('ccc:schedule');
  const canStartSession = hasPermission('ccc:start_session');
  const canVote = hasPermission('ccc:vote');
  const canGeneratePv = hasPermission('ccc:generate_pv');
  const isMember = meeting.members.some((m) => m.userId === user?.id && m.isPresent);

  const handleAddMember = async () => {
    if (!memberUserId || !memberRole) return;
    await addMember(meeting.id, { userId: memberUserId, roleFr: memberRole });
    setMemberUserId('');
    setMemberRole('');
    setShowAddMember(false);
  };

  const handleAddAgenda = async () => {
    if (!agendaTitle) return;
    await addAgendaItem(meeting.id, {
      titleFr: agendaTitle,
      description: agendaDesc || undefined,
      orderIndex: meeting.agendaItems.length,
    });
    setAgendaTitle('');
    setAgendaDesc('');
  };

  const handleSetDecision = async () => {
    await setDecision(meeting.id, {
      decision: decisionType,
      rationale: decisionRationale,
      awardedBidId: decisionType === 'ADJUGE' ? awardedBidId : undefined,
      additionalNotes: additionalNotes || undefined,
    });
    setShowDecisionModal(false);
  };

  const handleVote = async () => {
    await recordVote(meeting.id, {
      subjectType: voteSubjectType,
      subjectId: voteSubjectId,
      vote: voteChoice,
      reservation: voteChoice === 'RESERVE' ? voteReservation : undefined,
    });
    setShowVoteModal(false);
    setVoteSubjectId('');
    setVoteReservation('');
  };

  const handleGeneratePv = async () => {
    try {
      const result = await generatePv(meeting.id);
      setPvText(result.pvText);
      setPvHash(result.pvSha256Hash);
      setShowPvModal(true);
    } catch { /* error shown by store */ }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200 flex justify-between">
          {error}
          <button onClick={clearError} className="font-medium">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ccc')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-sonatrach-navy">
              {t('ccc.title', 'CCC')} #{meeting.meetingNumber} — {meeting.subject}
            </h1>
            <p className="text-gray-500 mt-1">
              <Link to={`/projects/${meeting.projectId}`} className="hover:underline">
                {meeting.project.referenceNumber}
              </Link>
              {' — '}{meeting.project.titleFr}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {meeting.phase && (
            <span className={`px-3 py-1 rounded text-sm font-medium ${meeting.phase === 'TECHNICAL' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
              {t(`ccc.phases.${meeting.phase}`, meeting.phase)}
            </span>
          )}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            state === 'closed' ? 'bg-gray-100 text-gray-600' :
            state === 'inSession' ? 'bg-green-100 text-green-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {t(`ccc.sessionStates.${state}`, state)}
          </span>
          {meeting.decision && <StatusBadge status={meeting.decision} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members & Attendance */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-sonatrach-navy flex items-center gap-2">
              <Users size={20} /> {t('ccc.members', 'Membres')}
            </h3>
            {state === 'scheduled' && canSchedule && (
              <button onClick={() => setShowAddMember(!showAddMember)} className="btn-secondary text-sm flex items-center gap-1">
                <UserPlus size={14} /> {t('ccc.addMember', 'Ajouter')}
              </button>
            )}
          </div>

          {showAddMember && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4 space-y-2">
              <select value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} className="input w-full text-sm">
                <option value="">— {t('ccc.selectMember', 'Sélectionner un utilisateur')} —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstNameFr} {u.lastNameFr} ({u.email})</option>
                ))}
              </select>
              <input
                type="text"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                placeholder={t('ccc.memberRole', 'Rôle (ex: Président, Membre, Rapporteur)')}
                className="input w-full text-sm"
              />
              <button onClick={handleAddMember} disabled={!memberUserId || !memberRole} className="btn-primary text-sm w-full disabled:opacity-50">
                {t('common.confirm', 'Confirmer')}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {meeting.members.length === 0 ? (
              <p className="text-gray-400 text-sm">{t('common.noData')}</p>
            ) : meeting.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{m.user.firstNameFr} {m.user.lastNameFr}</p>
                  <p className="text-xs text-gray-500">{m.roleFr}</p>
                </div>
                <div className="flex items-center gap-2">
                  {state !== 'closed' && (canSchedule || canStartSession) && (
                    <button
                      onClick={() => markAttendance(meeting.id, m.id, !m.isPresent)}
                      className={`px-2 py-1 rounded text-xs font-medium ${m.isPresent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {m.isPresent ? <><Check size={12} className="inline" /> {t('ccc.present', 'Présent')}</> : t('ccc.absent', 'Absent')}
                    </button>
                  )}
                  {state === 'closed' && (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${m.isPresent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.isPresent ? t('ccc.present', 'Présent') : t('ccc.absent', 'Absent')}
                    </span>
                  )}
                  {state === 'scheduled' && canSchedule && (
                    <button onClick={() => removeMember(meeting.id, m.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Session Control */}
        <div className="card">
          <h3 className="text-lg font-semibold text-sonatrach-navy flex items-center gap-2 mb-4">
            <Shield size={20} /> {t('ccc.sessionControl', 'Contrôle de session')}
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
              <span className="text-sm text-gray-600">{t('ccc.quorum', 'Quorum')}</span>
              <span className={`text-lg font-bold ${presentCount >= meeting.quorumRequired ? 'text-green-600' : 'text-red-600'}`}>
                {presentCount}/{meeting.quorumRequired}
              </span>
            </div>

            {state === 'scheduled' && canStartSession && (
              <button
                onClick={() => startSession(meeting.id)}
                disabled={presentCount < meeting.quorumRequired}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Play size={16} />
                {presentCount < meeting.quorumRequired
                  ? t('ccc.quorumNotMet', 'Quorum non atteint')
                  : t('ccc.startSession', 'Démarrer la session')}
              </button>
            )}

            {state === 'inSession' && !meeting.decision && canStartSession && (
              <button onClick={() => setShowDecisionModal(true)} className="btn-primary w-full flex items-center justify-center gap-2">
                <Gavel size={16} /> {t('ccc.setDecision', 'Rendre la décision')}
              </button>
            )}

            {state === 'inSession' && meeting.decision && !meeting.pvGeneratedAt && canGeneratePv && (
              <button onClick={handleGeneratePv} className="btn-primary w-full flex items-center justify-center gap-2">
                <FileText size={16} /> {t('ccc.generatePv', 'Générer le PV')}
              </button>
            )}

            {state === 'inSession' && meeting.decision && canStartSession && (
              <button onClick={() => endSession(meeting.id)} className="btn-secondary w-full flex items-center justify-center gap-2">
                <Square size={16} /> {t('ccc.endSession', 'Clôturer la session')}
              </button>
            )}

            {meeting.decision && (
              <div className="bg-indigo-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-indigo-700">{t('ccc.decision', 'Décision')}: <StatusBadge status={meeting.decision} /></p>
                {meeting.decisionRationale && <p className="text-xs text-indigo-600 mt-1">{meeting.decisionRationale}</p>}
              </div>
            )}

            {meeting.pvSha256Hash && (
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-green-700 flex items-center gap-1">
                  <Check size={14} /> {t('ccc.pvGenerated', 'PV généré et scellé')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs text-green-600 font-mono break-all">{meeting.pvSha256Hash}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(meeting.pvSha256Hash!); }}
                    className="text-green-600 hover:text-green-800"
                  >
                    <Copy size={12} />
                  </button>
                </div>
                {meeting.pvFilePath && (
                  <button
                    onClick={() => { setPvText(meeting.pvFilePath!); setPvHash(meeting.pvSha256Hash!); setShowPvModal(true); }}
                    className="text-xs text-green-700 underline mt-2"
                  >
                    {t('ccc.viewPv', 'Voir le PV')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Agenda */}
        <div className="card">
          <h3 className="text-lg font-semibold text-sonatrach-navy flex items-center gap-2 mb-4">
            <ListChecks size={20} /> {t('ccc.agenda', 'Ordre du jour')}
          </h3>

          <div className="space-y-3">
            {meeting.agendaItems.map((item, idx) => (
              <div key={item.id} className="border rounded-lg p-3">
                <p className="text-sm font-medium">{idx + 1}. {item.titleFr}</p>
                {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                {item.resolution ? (
                  <p className="text-xs text-green-700 mt-2 bg-green-50 p-2 rounded">{item.resolution}</p>
                ) : state === 'inSession' && (canSchedule || canStartSession) ? (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder={t('ccc.resolution', 'Résolution...')}
                      className="input w-full text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                          updateAgendaItem(meeting.id, item.id, { resolution: (e.target as HTMLInputElement).value });
                        }
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ))}

            {state !== 'closed' && (canSchedule || canStartSession) && (
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <input
                  type="text"
                  value={agendaTitle}
                  onChange={(e) => setAgendaTitle(e.target.value)}
                  placeholder={t('ccc.agendaTitle', 'Titre du point')}
                  className="input w-full text-sm"
                />
                <input
                  type="text"
                  value={agendaDesc}
                  onChange={(e) => setAgendaDesc(e.target.value)}
                  placeholder={t('ccc.agendaDescription', 'Description (optionnel)')}
                  className="input w-full text-sm"
                />
                <button onClick={handleAddAgenda} disabled={!agendaTitle} className="btn-secondary text-sm w-full disabled:opacity-50">
                  {t('ccc.addAgendaItem', 'Ajouter un point')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Votes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-sonatrach-navy flex items-center gap-2">
              <Vote size={20} /> {t('ccc.votes', 'Votes')}
            </h3>
            {state === 'inSession' && canVote && isMember && (
              <button onClick={() => setShowVoteModal(true)} className="btn-secondary text-sm">
                {t('ccc.castVote', 'Voter')}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {meeting.votes.length === 0 ? (
              <p className="text-gray-400 text-sm">{t('common.noData')}</p>
            ) : meeting.votes.map((v) => (
              <div key={v.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{v.voter.firstNameFr} {v.voter.lastNameFr}</p>
                  <p className="text-xs text-gray-500">{v.subjectType}:{v.subjectId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    v.vote === 'POUR' ? 'bg-green-100 text-green-700' :
                    v.vote === 'CONTRE' ? 'bg-red-100 text-red-700' :
                    v.vote === 'RESERVE' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {t(`ccc.votes.${v.vote}`, v.vote)}
                  </span>
                  {v.reservation && <span className="text-xs text-gray-400" title={v.reservation}>*</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Decision Modal */}
      {showDecisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 space-y-4">
            <h3 className="text-lg font-bold text-sonatrach-navy">{t('ccc.setDecision', 'Rendre la décision')}</h3>
            <select value={decisionType} onChange={(e) => setDecisionType(e.target.value as CCCDecision)} className="input w-full">
              {['ADMIS', 'NON_ADMIS', 'ADJUGE', 'INFRUCTUEUX', 'REPORT'].map((d) => (
                <option key={d} value={d}>{t(`ccc.decisions.${d}`, d)}</option>
              ))}
            </select>
            <textarea
              value={decisionRationale}
              onChange={(e) => setDecisionRationale(e.target.value)}
              placeholder={t('ccc.decisionRationale', 'Motif de la décision...')}
              className="input w-full h-24 resize-none"
              required
            />
            {decisionType === 'ADJUGE' && (
              <select value={awardedBidId} onChange={(e) => setAwardedBidId(e.target.value)} className="input w-full" required>
                <option value="">{t('ccc.selectAwardedBid', '— Sélectionner l\'offre adjugée —')}</option>
                {projectBids.map((b) => (
                  <option key={b.id} value={b.id}>{b.referenceNumber} — {b.supplier.companyNameFr}</option>
                ))}
              </select>
            )}
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder={t('ccc.additionalNotes', 'Notes supplémentaires (optionnel)')}
              className="input w-full h-16 resize-none"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDecisionModal(false)} className="btn-secondary">{t('common.cancel')}</button>
              <button onClick={handleSetDecision} disabled={!decisionRationale || (decisionType === 'ADJUGE' && !awardedBidId)} className="btn-primary disabled:opacity-50">
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vote Modal */}
      {showVoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-bold text-sonatrach-navy">{t('ccc.castVote', 'Voter')}</h3>
            <select value={voteSubjectType} onChange={(e) => setVoteSubjectType(e.target.value)} className="input w-full">
              <option value="bid">{t('ccc.voteSubjectTypes.bid', 'Offre')}</option>
              <option value="bid_opening">{t('ccc.voteSubjectTypes.bid_opening', 'Ouverture des plis')}</option>
              <option value="other">{t('ccc.voteSubjectTypes.other', 'Autre')}</option>
            </select>
            <input
              type="text"
              value={voteSubjectId}
              onChange={(e) => setVoteSubjectId(e.target.value)}
              placeholder={t('ccc.voteSubjectId', 'Identifiant du sujet')}
              className="input w-full"
              required
            />
            <select value={voteChoice} onChange={(e) => setVoteChoice(e.target.value as CCCVoteType)} className="input w-full">
              {['POUR', 'CONTRE', 'ABSTENTION', 'RESERVE'].map((v) => (
                <option key={v} value={v}>{t(`ccc.votes.${v}`, v)}</option>
              ))}
            </select>
            {voteChoice === 'RESERVE' && (
              <textarea
                value={voteReservation}
                onChange={(e) => setVoteReservation(e.target.value)}
                placeholder={t('ccc.reservationPlaceholder', 'Commentaire de réserve (obligatoire)...')}
                className="input w-full h-20 resize-none"
                required
              />
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowVoteModal(false)} className="btn-secondary">{t('common.cancel')}</button>
              <button onClick={handleVote} disabled={!voteSubjectId || (voteChoice === 'RESERVE' && !voteReservation)} className="btn-primary disabled:opacity-50">
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PV Modal */}
      {showPvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 space-y-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-sonatrach-navy">{t('ccc.pvGenerated', 'Procès-Verbal')}</h3>
            <div className="bg-green-50 p-2 rounded flex items-center gap-2">
              <span className="text-xs font-mono text-green-700 break-all">{pvHash}</span>
              <button onClick={() => navigator.clipboard.writeText(pvHash)} className="text-green-600"><Copy size={14} /></button>
            </div>
            <pre className="bg-gray-50 p-4 rounded-lg text-sm whitespace-pre-wrap font-mono text-gray-700 max-h-96 overflow-y-auto">
              {pvText}
            </pre>
            <div className="flex justify-end">
              <button onClick={() => setShowPvModal(false)} className="btn-secondary">{t('common.back', 'Fermer')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
