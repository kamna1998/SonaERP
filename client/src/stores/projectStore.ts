import { create } from 'zustand';
import * as projectsApi from '../api/projects';
import type { Project, ProjectStats, ProjectFilters, PaginatedResponse } from '../api/projects';

interface ProjectState {
  // List
  projects: Project[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: ProjectFilters;

  // Detail
  currentProject: Project | null;

  // Stats
  stats: ProjectStats | null;

  // UI state
  loading: boolean;
  error: string | null;

  // Actions
  setFilters: (filters: Partial<ProjectFilters>) => void;
  fetchProjects: (filters?: ProjectFilters) => Promise<void>;
  fetchProjectById: (id: string) => Promise<void>;
  createProject: (data: Record<string, any>) => Promise<Project>;
  updateProject: (id: string, data: Record<string, any>) => Promise<Project>;
  changeStatus: (id: string, status: string, reason?: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  clearError: () => void;
  clearCurrent: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  filters: { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
  currentProject: null,
  stats: null,
  loading: false,
  error: null,

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  fetchProjects: async (overrideFilters) => {
    set({ loading: true, error: null });
    try {
      const filters = overrideFilters || get().filters;
      const result = await projectsApi.listProjects(filters);
      set({ projects: result.data, pagination: result.pagination, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || 'Erreur lors du chargement des projets',
        loading: false,
      });
    }
  },

  fetchProjectById: async (id) => {
    set({ loading: true, error: null, currentProject: null });
    try {
      const project = await projectsApi.getProjectById(id);
      set({ currentProject: project, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || 'Projet introuvable',
        loading: false,
      });
    }
  },

  createProject: async (data) => {
    set({ loading: true, error: null });
    try {
      const project = await projectsApi.createProject(data);
      set({ loading: false });
      return project;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Erreur lors de la création du projet';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  updateProject: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const project = await projectsApi.updateProject(id, data);
      set({ currentProject: project, loading: false });
      return project;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Erreur lors de la modification';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  changeStatus: async (id, status, reason) => {
    set({ loading: true, error: null });
    try {
      const project = await projectsApi.changeProjectStatus(id, status, reason);
      set({ currentProject: project, loading: false });
      // Refresh list if we have projects loaded
      if (get().projects.length > 0) {
        get().fetchProjects();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Transition de statut impossible';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  fetchStats: async () => {
    try {
      const stats = await projectsApi.getProjectStats();
      set({ stats });
    } catch {
      // Silent fail for stats — dashboard still works
    }
  },

  clearError: () => set({ error: null }),
  clearCurrent: () => set({ currentProject: null }),
}));
