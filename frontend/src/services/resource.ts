/** Fábrica de servicios CRUD para cualquier recurso REST de FutOwl (sin borrado: activar/desactivar). */
import { api, toPayload } from "@/api/client";
import type { ID, Paginated } from "@/types";

export type Query = Record<string, string | number | boolean | undefined | null>;

export interface ResourceService<T> {
  path: string;
  list: (params?: Query) => Promise<Paginated<T>>;
  all: (params?: Query) => Promise<T[]>;
  get: (id: ID) => Promise<T>;
  create: (data: Record<string, unknown>) => Promise<T>;
  update: (id: ID, data: Record<string, unknown>) => Promise<T>;
  activate: (id: ID) => Promise<T>;
  deactivate: (id: ID) => Promise<T>;
}

const clean = (params?: Query) =>
  Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export function createResource<T>(path: string): ResourceService<T> {
  const base = `/${path}/`;
  return {
    path,
    list: async (params) => (await api.get<Paginated<T>>(base, { params: clean(params) })).data,
    all: async (params) => {
      const data = (await api.get<Paginated<T> | T[]>(base, { params: { page_size: 200, ...clean(params) } })).data;
      return Array.isArray(data) ? data : data.results;
    },
    get: async (id) => (await api.get<T>(`${base}${id}/`)).data,
    create: async (data) => (await api.post<T>(base, toPayload(data))).data,
    update: async (id, data) => (await api.patch<T>(`${base}${id}/`, toPayload(data))).data,
    activate: async (id) => (await api.post<T>(`${base}${id}/activate/`)).data,
    deactivate: async (id) => (await api.post<T>(`${base}${id}/deactivate/`)).data,
  };
}
