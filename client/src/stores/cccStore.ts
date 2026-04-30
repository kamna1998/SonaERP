import { create } from 'zustand';
import * as cccApi from '../api/ccc';
import type { CCCMeeting, CCCStats, PaginatedMeetings } from '../api/ccc';

interface CCCState {
  meetings: CCCMeeting[];
  currentMeeting: CCCMeeting | null;
  stats: CCCStats | null;
  pagination: PaginatedMeetings['pagination'] | null;
  loading: boolean;
  error: string | null;

  fetchMeetings: (params?: Record<string, any>) => Promise<void>;
  fetchMeetingById: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  createMeeting: (data: Parameters<typeof cccApi.createMeeting>[0]) => Promise<CCCMeeting>;
  addMember: (meetingId: string, data: { userId: string; roleFr: string }) => Promise<void>;
  removeMember: (meetingId: string, memberId: string) => Promise<void>;
  markAttendance: (meetingId: string, memberId: string, isPresent: boolean) => Promise<void>;
  addAgendaItem: (meetingId: string, data: { titleFr: string; description?: string; orderIndex?: number }) => Promise<void>;
  updateAgendaItem: (meetingId: string, itemId: string, data: Record<string, any>) => Promise<void>;
  startSession: (meetingId: string) => Promise<void>;
  recordVote: (meetingId: string, data: Parameters<typeof cccApi.recordVote>[1]) => Promise<void>;
  setDecision: (meetingId: string, data: Parameters<typeof cccApi.setDecision>[1]) => Promise<void>;
  generatePv: (meetingId: string) => Promise<{ pvText: string; pvSha256Hash: string }>;
  endSession: (meetingId: string) => Promise<void>;
  clearError: () => void;
  clearCurrent: () => void;
}

export const useCCCStore = create<CCCState>((set, get) => ({
  meetings: [],
  currentMeeting: null,
  stats: null,
  pagination: null,
  loading: false,
  error: null,

  fetchMeetings: async (params) => {
    set({ loading: true, error: null });
    try {
      const result = await cccApi.listMeetings(params);
      set({ meetings: result.data, pagination: result.pagination, loading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message, loading: false });
    }
  },

  fetchMeetingById: async (id) => {
    set({ loading: true, error: null });
    try {
      const meeting = await cccApi.getMeetingById(id);
      set({ currentMeeting: meeting, loading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message, loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await cccApi.getMeetingStats();
      set({ stats });
    } catch { /* silent */ }
  },

  createMeeting: async (data) => {
    set({ loading: true, error: null });
    try {
      const meeting = await cccApi.createMeeting(data);
      set({ loading: false });
      return meeting;
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message, loading: false });
      throw err;
    }
  },

  addMember: async (meetingId, data) => {
    try {
      await cccApi.addMember(meetingId, data);
      await get().fetchMeetingById(meetingId);
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message });
    }
  },

  removeMember: async (meetingId, memberId) => {
    try {
      await cccApi.removeMember(meetingId, memberId);
      await get().fetchMeetingById(meetingId);
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message });
    }
  },

  markAttendance: async (meetingId, memberId, isPresent) => {
    try {
      await cccApi.markAttendance(meetingId, { memberId, isPresent });
      await get().fetchMeetingById(meetingId);
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message });
    }
  },

  addAgendaItem: async (meetingId, data) => {
    try {
      await cccApi.addAgendaItem(meetingId, data);
      await get().fetchMeetingById(meetingId);
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message });
    }
  },

  updateAgendaItem: async (meetingId, itemId, data) => {
    try {
      await cccApi.updateAgendaItem(meetingId, itemId, data);
      await get().fetchMeetingById(meetingId);
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message });
    }
  },

  startSession: async (meetingId) => {
    try {
      await cccApi.startSession(meetingId);
      await get().fetchMeetingById(meetingId);
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message });
    }
  },

  recordVote: async (meetingId, data) => {
    try {
      await cccApi.recordVote(meetingId, data);
      await get().fetchMeetingById(meetingId);
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message });
    }
  },

  setDecision: async (meetingId, data) => {
    try {
      await cccApi.setDecision(meetingId, data);
      await get().fetchMeetingById(meetingId);
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message });
    }
  },

  generatePv: async (meetingId) => {
    try {
      const result = await cccApi.generatePv(meetingId);
      await get().fetchMeetingById(meetingId);
      return result;
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message });
      throw err;
    }
  },

  endSession: async (meetingId) => {
    try {
      await cccApi.endSession(meetingId);
      await get().fetchMeetingById(meetingId);
    } catch (err: any) {
      set({ error: err.response?.data?.error?.message ?? err.message });
    }
  },

  clearError: () => set({ error: null }),
  clearCurrent: () => set({ currentMeeting: null }),
}));
