import { create } from 'zustand';
import * as dtaoApi from '../api/dtao';
import type {
  DtaoSummary,
  DtaoDetail,
  DtaoFilters,
  DtaoStatus,
  DtaoDocument,
  DocumentVersion,
  VaultType,
} from '../api/dtao';

interface DtaoState {
  // List
  dtaos: DtaoSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: DtaoFilters;

  // Detail
  currentDtao: DtaoDetail | null;

  // UI state
  loading: boolean;
  error: string | null;

  // Actions
  setFilters: (filters: Partial<DtaoFilters>) => void;
  fetchDtaos: (filters?: DtaoFilters) => Promise<void>;
  fetchDtaoById: (id: string) => Promise<void>;
  createDtao: (projectId: string) => Promise<DtaoSummary>;
  changeStatus: (id: string, status: DtaoStatus, reason?: string) => Promise<void>;
  addDocument: (
    dtaoId: string,
    data: { documentType: string; titleFr: string; vault?: VaultType }
  ) => Promise<DtaoDocument>;
  uploadVersion: (
    docId: string,
    data: { content: string; fileName: string; mimeType?: string; isSealed?: boolean }
  ) => Promise<DocumentVersion>;
  sealDocument: (docId: string) => Promise<void>;
  clearError: () => void;
  clearCurrent: () => void;
}

export const useDtaoStore = create<DtaoState>((set, get) => ({
  dtaos: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  filters: { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
  currentDtao: null,
  loading: false,
  error: null,

  setFilters: (newFilters) => {
    set((state) => ({ filters: { ...state.filters, ...newFilters } }));
  },

  fetchDtaos: async (overrideFilters) => {
    set({ loading: true, error: null });
    try {
      const filters = overrideFilters || get().filters;
      const result = await dtaoApi.listDtaos(filters);
      set({ dtaos: result.data, pagination: result.pagination, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || 'Erreur lors du chargement des DTAO',
        loading: false,
      });
    }
  },

  fetchDtaoById: async (id) => {
    set({ loading: true, error: null, currentDtao: null });
    try {
      const dtao = await dtaoApi.getDtaoById(id);
      set({ currentDtao: dtao, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || 'DTAO introuvable',
        loading: false,
      });
    }
  },

  createDtao: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const dtao = await dtaoApi.createDtao(projectId);
      set({ loading: false });
      return dtao;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Erreur lors de la création du DTAO';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  changeStatus: async (id, status, reason) => {
    set({ loading: true, error: null });
    try {
      await dtaoApi.changeDtaoStatus(id, status, reason);
      // Refresh current DTAO detail to pick up cascaded state
      await get().fetchDtaoById(id);
      if (get().dtaos.length > 0) {
        get().fetchDtaos();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Transition de statut impossible';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  addDocument: async (dtaoId, data) => {
    set({ error: null });
    try {
      const doc = await dtaoApi.createDocument(dtaoId, data);
      await get().fetchDtaoById(dtaoId);
      return doc;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Impossible d'ajouter le document";
      set({ error: msg });
      throw new Error(msg);
    }
  },

  uploadVersion: async (docId, data) => {
    set({ error: null });
    try {
      const version = await dtaoApi.createDocumentVersion(docId, data);
      const current = get().currentDtao;
      if (current) await get().fetchDtaoById(current.id);
      return version;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Échec du téléversement";
      set({ error: msg });
      throw new Error(msg);
    }
  },

  sealDocument: async (docId) => {
    set({ error: null });
    try {
      await dtaoApi.sealDocument(docId);
      const current = get().currentDtao;
      if (current) await get().fetchDtaoById(current.id);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Scellement impossible';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  clearError: () => set({ error: null }),
  clearCurrent: () => set({ currentDtao: null }),
}));
