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

/** Lote al traer colecciones completas (máximo que admite el backend). */
const BATCH_SIZE = 200;

const clean = (params?: Query) =>
  Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export function createResource<T>(path: string): ResourceService<T> {
  const base = `/${path}/`;
  return {
    path,
    list: async (params) => (await api.get<Paginated<T>>(base, { params: clean(params) })).data,
    // Recorre todas las páginas: quedarse con la primera (200) dejaba listas incompletas, p. ej. con
    // 50 equipos × 8 categorías solo llegaban 4 categorías por equipo y el resto parecía sin inscribir.
    all: async (params) => {
      const items: T[] = [];
      for (let page = 1; ; page++) {
        const data = (await api.get<Paginated<T> | T[]>(base, { params: { ...clean(params), page_size: BATCH_SIZE, page } })).data;
        if (Array.isArray(data)) return data;
        items.push(...data.results);
        if (!data.next) return items;
      }
    },
    get: async (id) => (await api.get<T>(`${base}${id}/`)).data,
    create: async (data) => (await api.post<T>(base, toPayload(data))).data,
    update: async (id, data) => (await api.patch<T>(`${base}${id}/`, toPayload(data))).data,
    activate: async (id) => (await api.post<T>(`${base}${id}/activate/`)).data,
    deactivate: async (id) => (await api.post<T>(`${base}${id}/deactivate/`)).data,
  };
}
