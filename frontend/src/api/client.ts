/**
 * Cliente HTTP de FutOwl.
 * - El access token vive solo en memoria (nunca en localStorage → mitiga XSS).
 * - El refresh token viaja en una cookie httpOnly gestionada por el servidor.
 * - Ante un 401 se renueva el token una sola vez y se reintentan las peticiones en cola.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "/api";

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
  onExpired: (callback: () => void) => {
    onSessionExpired = callback;
  },
};

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = axios
      .post(`${API_URL}/auth/refresh/`, null, { withCredentials: true })
      .then((res) => {
        accessToken = res.data.access as string;
        return accessToken;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthCall = config?.url?.includes("/auth/");
    if (error.response?.status === 401 && config && !config._retry && !isAuthCall) {
      config._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      }
      onSessionExpired?.();
    }
    return Promise.reject(error);
  },
);

/** Convierte un objeto en FormData si contiene archivos; si no, lo envía como JSON. */
export function toPayload(data: Record<string, unknown>): FormData | Record<string, unknown> {
  const hasFile = Object.values(data).some((v) => v instanceof File);
  if (!hasFile) {
    // Los campos de archivo sin cambios (URLs existentes) no se reenvían
    return Object.fromEntries(
      Object.entries(data).filter(([, v]) => !(typeof v === "string" && /^(https?:)?\/.*\/media\//.test(v))),
    );
  }
  const form = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value instanceof File) form.append(key, value);
    else if (Array.isArray(value)) value.forEach((item) => form.append(key, String(item)));
    else if (value === null) form.append(key, "");
    else if (typeof value === "string" && /\/media\//.test(value)) return;
    else form.append(key, String(value));
  });
  return form;
}

/** Descarga un archivo binario autenticado (PDF/DOCX). */
export async function downloadFile(url: string, params: Record<string, unknown>, fallbackName: string) {
  const res = await api.get(url, { params, responseType: "blob" });
  const disposition = res.headers["content-disposition"] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const href = URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = match?.[1] ?? fallbackName;
  link.click();
  URL.revokeObjectURL(href);
}
