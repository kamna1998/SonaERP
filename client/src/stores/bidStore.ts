import { create } from 'zustand';
import * as bidsApi from '../api/bids';
import type {
  BidSummary, BidDetail, BidFilters, BidStatus, EnvelopeType, BidEnvelope,
} from '../api/bids';

interface BidState {
  bids: BidSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: BidFilters;
  allowedVaults: EnvelopeType[];
  currentBid: BidDetail | null;
  loading: boolean;
  error: string | null;

  setFilters: (filters: Partial<BidFilters>) => void;
  fetchBids: (filters?: BidFilters) => Promise<void>;
  fetchBidById: (id: string) => Promise<void>;
  registerBid: (data: any) => Promise<BidSummary>;
  uploadEnvelope: (
    bidId: string,
    envelopeType: EnvelopeType,
    fileName: string,
    content: string
  ) => Promise<BidEnvelope>;
  openEnvelope: (
    bidId: string,
    envelopeType: EnvelopeType,
    witnessNote?: string
  ) => Promise<void>;
  changeStatus: (id: string, status: BidStatus, reason?: string) => Promise<void>;
  clearError: () => void;
  clearCurrent: () => void;
}

export const useBidStore = create<BidState>((set, get) => ({
  bids: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  filters: { page: 1, limit: 20, sortBy: 'receivedAt', sortOrder: 'desc' },
  allowedVaults: [],
  currentBid: null,
  loading: false,
  error: null,

  setFilters: (newFilters) => {
    set((state) => ({ filters: { ...state.filters, ...newFilters } }));
  },

  fetchBids: async (overrideFilters) => {
    set({ loading: true, error: null });
    try {
      const filters = overrideFilters || get().filters;
      const result = await bidsApi.listBids(filters);
      set({
        bids: result.data,
        pagination: result.pagination,
        allowedVaults: result.meta?.allowedVaults || [],
        loading: false,
      });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || 'Erreur lors du chargement des soumissions',
        loading: false,
      });
    }
  },

  fetchBidById: async (id) => {
    set({ loading: true, error: null, currentBid: null });
    try {
      const bid = await bidsApi.getBidById(id);
      set({
        currentBid: bid,
        allowedVaults: bid.meta?.allowedVaults || [],
        loading: false,
      });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || 'Soumission introuvable',
        loading: false,
      });
    }
  },

  registerBid: async (data) => {
    set({ loading: true, error: null });
    try {
      const bid = await bidsApi.registerBid(data);
      set({ loading: false });
      return bid;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Échec de l'enregistrement de la soumission";
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  uploadEnvelope: async (bidId, envelopeType, fileName, content) => {
    set({ error: null });
    try {
      const env = await bidsApi.uploadEnvelope(bidId, { envelopeType, fileName, content });
      if (get().currentBid?.id === bidId) {
        await get().fetchBidById(bidId);
      }
      return env;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Téléversement impossible';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  openEnvelope: async (bidId, envelopeType, witnessNote) => {
    set({ error: null });
    try {
      await bidsApi.openEnvelope(bidId, { envelopeType, witnessNote });
      if (get().currentBid?.id === bidId) {
        await get().fetchBidById(bidId);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Ouverture d'enveloppe impossible";
      set({ error: msg });
      throw new Error(msg);
    }
  },

  changeStatus: async (id, status, reason) => {
    set({ error: null });
    try {
      await bidsApi.changeBidStatus(id, status, reason);
      if (get().currentBid?.id === id) {
        await get().fetchBidById(id);
      }
      if (get().bids.length > 0) await get().fetchBids();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Transition impossible';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  clearError: () => set({ error: null }),
  clearCurrent: () => set({ currentBid: null }),
}));
