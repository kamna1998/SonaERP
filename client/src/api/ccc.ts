import apiClient from './client';

export type CCCDecision = 'ADMIS' | 'NON_ADMIS' | 'ADJUGE' | 'INFRUCTUEUX' | 'REPORT';
export type CCCVoteType = 'POUR' | 'CONTRE' | 'ABSTENTION' | 'RESERVE';
export type CCCPhase = 'TECHNICAL' | 'COMMERCIAL';

export interface CCCMember {
  id: string;
  meetingId: string;
  userId: string;
  roleFr: string;
  isPresent: boolean;
  attendedAt: string | null;
  user: { id: string; firstNameFr: string; lastNameFr: string; email: string };
}

export interface CCCVote {
  id: string;
  meetingId: string;
  voterId: string;
  subjectType: string;
  subjectId: string;
  vote: CCCVoteType;
  reservation: string | null;
  votedAt: string;
  voter: { id: string; firstNameFr: string; lastNameFr: string };
}

export interface CCCAgendaItem {
  id: string;
  meetingId: string;
  orderIndex: number;
  titleFr: string;
  description: string | null;
  resolution: string | null;
  createdAt: string;
}

export interface CCCMeeting {
  id: string;
  projectId: string;
  meetingNumber: number;
  subject: string;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  location: string | null;
  phase: CCCPhase | null;
  quorumRequired: number;
  quorumMet: boolean;
  decision: CCCDecision | null;
  decisionRationale: string | null;
  pvFilePath: string | null;
  pvGeneratedAt: string | null;
  pvSha256Hash: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; referenceNumber: string; titleFr: string; status: string };
  members: CCCMember[];
  votes: CCCVote[];
  agendaItems: CCCAgendaItem[];
}

export interface CCCStats {
  total: number;
  scheduled: number;
  inSession: number;
  decided: number;
  closed: number;
}

export interface PaginatedMeetings {
  data: CCCMeeting[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function listMeetings(params?: Record<string, any>): Promise<PaginatedMeetings> {
  const res = await apiClient.get('/ccc', { params });
  return res.data;
}

export async function getMeetingById(id: string): Promise<CCCMeeting> {
  const res = await apiClient.get(`/ccc/${id}`);
  return res.data;
}

export async function getMeetingStats(): Promise<CCCStats> {
  const res = await apiClient.get('/ccc/stats');
  return res.data;
}

export async function createMeeting(data: {
  projectId: string;
  subject: string;
  scheduledAt: string;
  location?: string;
  phase?: CCCPhase;
  quorumRequired?: number;
}): Promise<CCCMeeting> {
  const res = await apiClient.post('/ccc', data);
  return res.data;
}

export async function updateMeeting(id: string, data: Record<string, any>): Promise<CCCMeeting> {
  const res = await apiClient.patch(`/ccc/${id}`, data);
  return res.data;
}

export async function addMember(meetingId: string, data: { userId: string; roleFr: string }): Promise<CCCMember> {
  const res = await apiClient.post(`/ccc/${meetingId}/members`, data);
  return res.data;
}

export async function removeMember(meetingId: string, memberId: string): Promise<void> {
  await apiClient.delete(`/ccc/${meetingId}/members/${memberId}`);
}

export async function markAttendance(meetingId: string, data: { memberId: string; isPresent: boolean }): Promise<CCCMember> {
  const res = await apiClient.post(`/ccc/${meetingId}/attendance`, data);
  return res.data;
}

export async function addAgendaItem(meetingId: string, data: { titleFr: string; description?: string; orderIndex?: number }): Promise<CCCAgendaItem> {
  const res = await apiClient.post(`/ccc/${meetingId}/agenda`, data);
  return res.data;
}

export async function updateAgendaItem(meetingId: string, itemId: string, data: Record<string, any>): Promise<CCCAgendaItem> {
  const res = await apiClient.patch(`/ccc/${meetingId}/agenda/${itemId}`, data);
  return res.data;
}

export async function startSession(meetingId: string): Promise<CCCMeeting> {
  const res = await apiClient.post(`/ccc/${meetingId}/start`);
  return res.data;
}

export async function recordVote(meetingId: string, data: {
  subjectType: string;
  subjectId: string;
  vote: CCCVoteType;
  reservation?: string;
}): Promise<CCCVote> {
  const res = await apiClient.post(`/ccc/${meetingId}/votes`, data);
  return res.data;
}

export async function setDecision(meetingId: string, data: {
  decision: CCCDecision;
  rationale: string;
  awardedBidId?: string;
  additionalNotes?: string;
}): Promise<CCCMeeting> {
  const res = await apiClient.post(`/ccc/${meetingId}/decision`, data);
  return res.data;
}

export async function generatePv(meetingId: string): Promise<{ pvText: string; pvSha256Hash: string }> {
  const res = await apiClient.post(`/ccc/${meetingId}/pv`);
  return res.data;
}

export async function endSession(meetingId: string): Promise<CCCMeeting> {
  const res = await apiClient.post(`/ccc/${meetingId}/end`);
  return res.data;
}

export async function recordEvaluations(bidId: string, evaluations: Array<{
  criterionCode: string;
  criterionLabel: string;
  maxScore: number;
  givenScore: number;
  envelopeType: 'TECHNICAL' | 'COMMERCIAL';
  justification?: string;
}>) {
  const res = await apiClient.post(`/bids/${bidId}/evaluations`, { evaluations });
  return res.data;
}
