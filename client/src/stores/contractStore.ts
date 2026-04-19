import { create } from 'zustand';
import * as api from '../api/contracts';
import type {
  ContractSummary,
  ContractDetail,
  ContractFilters,
  ContractStats,
  AvenantSummary,
  CumulativeDelta,
  ContractStatus,
  AvenantType,
  AvenantStatus,
} from '../api/contracts';

interface ContractState {
  contracts: ContractSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: ContractFilters;
  currentContract: ContractDetail | null;
  stats: ContractStats | null;
  cumulativeDelta: CumulativeDelta | null;
  loading: boolean;
  error: string | null;

  setFilters: (f: Partial<ContractFilters>) => void;
  fetchContracts: () => Promise<void>;
  fetchContractById: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchCumulativeDelta: (contractId: string) => Promise<void>;

  createContract: (data: Parameters<typeof api.createContract>[0]) => Promise<ContractSummary>;
  updateContract: (id: string, data: Parameters<typeof api.updateContract>[1]) => Promise<void>;
  transitionStatus: (id: string, status: ContractStatus, reason?: string, signedAt?: string) => Promise<void>;

  createAvenant: (data: Parameters<typeof api.createAvenant>[0]) => Promise<AvenantSummary>;
  updateAvenant: (contractId: string, avenantId: string, data: Parameters<typeof api.updateAvenant>[2]) => Promise<void>;
  transitionAvenantStatus: (contractId: string, avenantId: string, status: AvenantStatus, reason?: string) => Promise<void>;

  clearError: () => void;
  clearCurrent: () => void;
}

function extractError(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || err?.message || fallback;
}

export const useContractStore = create<ContractState>((set, get) => ({
  contracts: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  filters: { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
  currentContract: null,
  stats: null,
  cumulativeDelta: null,
  loading: false,
  error: null,

  setFilters: (newFilters) => {
    set((s) => ({ filters: { ...s.filters, ...newFilters } }));
  },

  fetchContracts: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.listContracts(get().filters);
      set({ contracts: result.data, pagination: result.pagination, loading: false });
    } catch (err: any) {
      set({ error: extractError(err, 'Erreur chargement contrats'), loading: false });
    }
  },

  fetchContractById: async (id) => {
    set({ loading: true, error: null, currentContract: null });
    try {
      const contract = await api.getContractById(id);
      set({ currentContract: contract, loading: false });
    } catch (err: any) {
      set({ error: extractError(err, 'Contrat introuvable'), loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await api.getContractStats();
      set({ stats });
    } catch {
      // silent
    }
  },

  fetchCumulativeDelta: async (contractId) => {
    try {
      const delta = await api.getCumulativeDelta(contractId);
      set({ cumulativeDelta: delta });
    } catch {
      set({ cumulativeDelta: null });
    }
  },

  createContract: async (data) => {
    set({ loading: true, error: null });
    try {
      const contract = await api.createContract(data);
      set({ loading: false });
      return contract;
    } catch (err: any) {
      const msg = extractError(err, 'Creation impossible');
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  updateContract: async (id, data) => {
    try {
      await api.updateContract(id, data);
      if (get().currentContract?.id === id) await get().fetchContractById(id);
    } catch (err: any) {
      const msg = extractError(err, 'Modification impossible');
      set({ error: msg });
      throw new Error(msg);
    }
  },

  transitionStatus: async (id, status, reason, signedAt) => {
    try {
      await api.transitionContractStatus(id, { status, reason, signedAt });
      if (get().currentContract?.id === id) await get().fetchContractById(id);
    } catch (err: any) {
      const msg = extractError(err, 'Transition impossible');
      set({ error: msg });
      throw new Error(msg);
    }
  },

  createAvenant: async (data) => {
    set({ loading: true, error: null });
    try {
      const avenant = await api.createAvenant(data);
      set({ loading: false });
      // Refresh contract to include new avenant
      if (get().currentContract?.id === data.contractId) {
        await get().fetchContractById(data.contractId);
        await get().fetchCumulativeDelta(data.contractId);
      }
      return avenant;
    } catch (err: any) {
      const msg = extractError(err, 'Creation avenant impossible');
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  updateAvenant: async (contractId, avenantId, data) => {
    try {
      await api.updateAvenant(contractId, avenantId, data);
      if (get().currentContract?.id === contractId) {
        await get().fetchContractById(contractId);
        await get().fetchCumulativeDelta(contractId);
      }
    } catch (err: any) {
      const msg = extractError(err, 'Modification avenant impossible');
      set({ error: msg });
      throw new Error(msg);
    }
  },

  transitionAvenantStatus: async (contractId, avenantId, status, reason) => {
    try {
      await api.transitionAvenantStatus(contractId, avenantId, { status, reason });
      if (get().currentContract?.id === contractId) {
        await get().fetchContractById(contractId);
        await get().fetchCumulativeDelta(contractId);
      }
    } catch (err: any) {
      const msg = extractError(err, 'Transition avenant impossible');
      set({ error: msg });
      throw new Error(msg);
    }
  },

  clearError: () => set({ error: null }),
  clearCurrent: () => set({ currentContract: null, cumulativeDelta: null }),
}));

// Re-export types for convenience
export type { ContractStatus, AvenantType, AvenantStatus };
