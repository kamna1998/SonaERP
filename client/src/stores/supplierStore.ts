import { create } from 'zustand';
import * as suppliersApi from '../api/suppliers';
import type { Supplier, SupplierWithBids, SupplierFilters } from '../api/suppliers';

interface SupplierState {
  suppliers: Supplier[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: SupplierFilters;
  currentSupplier: SupplierWithBids | null;
  loading: boolean;
  error: string | null;

  setFilters: (filters: Partial<SupplierFilters>) => void;
  fetchSuppliers: (filters?: SupplierFilters) => Promise<void>;
  fetchSupplierById: (id: string) => Promise<void>;
  createSupplier: (data: Record<string, any>) => Promise<Supplier>;
  updateSupplier: (id: string, data: Record<string, any>) => Promise<Supplier>;
  setBlacklist: (id: string, isBlacklisted: boolean, reason?: string) => Promise<void>;
  clearError: () => void;
  clearCurrent: () => void;
}

export const useSupplierStore = create<SupplierState>((set, get) => ({
  suppliers: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  filters: { page: 1, limit: 20, sortBy: 'companyNameFr', sortOrder: 'asc' },
  currentSupplier: null,
  loading: false,
  error: null,

  setFilters: (newFilters) => {
    set((state) => ({ filters: { ...state.filters, ...newFilters } }));
  },

  fetchSuppliers: async (overrideFilters) => {
    set({ loading: true, error: null });
    try {
      const filters = overrideFilters || get().filters;
      const result = await suppliersApi.listSuppliers(filters);
      set({ suppliers: result.data, pagination: result.pagination, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || 'Erreur lors du chargement des fournisseurs',
        loading: false,
      });
    }
  },

  fetchSupplierById: async (id) => {
    set({ loading: true, error: null, currentSupplier: null });
    try {
      const supplier = await suppliersApi.getSupplierById(id);
      set({ currentSupplier: supplier, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || 'Fournisseur introuvable',
        loading: false,
      });
    }
  },

  createSupplier: async (data) => {
    set({ loading: true, error: null });
    try {
      const supplier = await suppliersApi.createSupplier(data);
      set({ loading: false });
      return supplier;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Échec de la création du fournisseur";
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  updateSupplier: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const supplier = await suppliersApi.updateSupplier(id, data);
      set({ loading: false });
      return supplier;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Échec de la modification';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  setBlacklist: async (id, isBlacklisted, reason) => {
    set({ error: null });
    try {
      await suppliersApi.setBlacklistStatus(id, isBlacklisted, reason);
      if (get().currentSupplier?.id === id) {
        await get().fetchSupplierById(id);
      }
      if (get().suppliers.length > 0) await get().fetchSuppliers();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Opération impossible';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  clearError: () => set({ error: null }),
  clearCurrent: () => set({ currentSupplier: null }),
}));
