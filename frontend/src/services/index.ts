import { api } from "@/api/client";
import type {
  Adjustment, AuditLog, CapabilityCatalog, Category, CategoryRules, Coach, Confirmation, DocPage, DocPageSummary, DocRevision, Field, Group, Guardian, ID, Lineup, LiveState, Match,
  KnockoutView, Matchday, MatchEvent, MatchNote, MatchReport, Me, Notification, Official, Paginated, PartyStatus, Permission, PermissionCatalog,
  Player, PlayerStat, PublicMatch, PublicTournament, Registration, ReportComparison, ReviewCase, Role,
  StandingRow, Team, TeamPlayer, Terms, Tournament, User,
} from "@/types";

import { createResource } from "./resource";

// ---------------------------------------------------------------- Registro
export const categories = createResource<Category>("categories");
export const fields = createResource<Field>("fields");
export const coaches = createResource<Coach>("coaches");
export const guardians = createResource<Guardian>("guardians");
export const players = createResource<Player>("players");
export const delegates = createResource<Official>("delegates");
export const referees = createResource<Official>("referees");
export const teams = createResource<Team>("teams");
export const roster = createResource<TeamPlayer>("roster");

// ---------------------------------------------------------------- Torneos
export const tournaments = {
  ...createResource<Tournament>("tournaments"),
  /** Solo en borrador: se borra definitivamente con todo lo que cuelga del torneo. */
  remove: (id: ID) => api.delete(`/tournaments/${id}/`),
};
export const categoryRules = createResource<CategoryRules>("category-rules");
export const groups = createResource<Group>("groups");
export const registrations = {
  ...createResource<Registration>("registrations"),
  /** Inscribe varios equipos a la vez; cada inscripción que falle se informa sin frenar a las demás. */
  bulk: async (data: { tournament: ID; teams: { team: ID; categories: ID[] }[] }) =>
    (await api.post<{ created: number; errors: { team: ID; category: ID; label: string; message: string }[] }>(
      "/registrations/bulk/", data)).data,
};

// ---------------------------------------------------------------- Competición
export const matchdays = {
  ...createResource<Matchday>("matchdays"),
  remove: (id: ID) => api.delete(`/matchdays/${id}/`),
  completeness: async (id: ID) =>
    (await api.get<{ total: number; incomplete: Record<string, string[]>; ready: boolean }>(`/matchdays/${id}/completeness/`)).data,
  /** Plan (o creación, con `commit`) de jornadas automáticas que cubren los partidos sin jornada. */
  autoSchedule: async (body: AutoScheduleRequest) => (await api.post<AutoSchedulePlan>("/matchdays/auto-schedule/", body)).data,
  /** Agrega varios partidos del fixture (opcionalmente ya en una cancha); los no elegibles se omiten. */
  addMatches: async (id: ID, ids: ID[], field?: ID | null) =>
    (await api.post<{ added: number; skipped: number }>(`/matchdays/${id}/add-matches/`, { ids, field: field ?? null })).data,
  /** Borra varias jornadas en borrador del torneo; sus partidos vuelven al fixture sin programar. */
  bulkDelete: async (tournament: ID, ids: ID[]) =>
    (await api.post<{ deleted: number; skipped: number }>("/matchdays/bulk-delete/", { tournament, ids })).data,
  submit: async (id: ID) => (await api.post<Matchday>(`/matchdays/${id}/submit/`)).data,
  close: async (id: ID) => (await api.post<Matchday>(`/matchdays/${id}/close/`)).data,
};

export const matches = {
  ...createResource<Match>("matches"),
  remove: (id: ID) => api.delete(`/matches/${id}/`),
  generateFixture: async (data: { tournament: ID; category: ID; group?: ID | null; double?: boolean; replace?: boolean }) =>
    (await api.post<{ created: number }>("/matches/generate-fixture/", data)).data,
  /** Borra varios partidos en borrador de la fase regular; los demás se omiten. */
  bulkDelete: async (tournament: ID, ids: ID[]) =>
    (await api.post<{ deleted: number; skipped: number }>("/matches/bulk-delete/", { tournament, ids })).data,
  confirmations: async (id: ID) =>
    (await api.get<{ summary: PartyStatus[]; my_parties: string[]; history: Confirmation[] }>(`/matches/${id}/confirmations/`)).data,
  respond: async (id: ID, data: { party: string; response: "accepted" | "rejected"; reason?: string }) =>
    (await api.post<Confirmation>(`/matches/${id}/respond/`, data)).data,
  adjust: async (id: ID, data: Record<string, unknown>) => (await api.post<Adjustment>(`/matches/${id}/adjust/`, data)).data,
  /** Asignación de oficiales en partidos enviados y pendientes (jefes de delegados / árbitros). */
  assignOfficials: async (id: ID, data: Record<string, unknown>) => (await api.post<Match>(`/matches/${id}/assign-officials/`, data)).data,
  adjustments: async (id: ID) => (await api.get<Adjustment[]>(`/matches/${id}/adjustments/`)).data,
  suspend: async (id: ID, reason: string) => (await api.post<Match>(`/matches/${id}/suspend/`, { reason })).data,
  lineups: async (id: ID) => (await api.get<Lineup[]>(`/matches/${id}/lineups/`)).data,
  submitLineup: async (id: ID, data: FormData | Record<string, unknown>) =>
    (await api.post<Lineup>(`/matches/${id}/submit-lineup/`, data)).data,
  importLineup: async (id: ID, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return (await api.post<{ players: { team_player: ID; shirt_number: number; is_starter: boolean; is_captain: boolean }[] }>(
      `/matches/${id}/import-lineup/`, form)).data;
  },
  events: async (id: ID) => (await api.get<MatchEvent[]>(`/matches/${id}/events/`)).data,
  recordEvent: async (id: ID, data: Record<string, unknown>) =>
    (await api.post<MatchEvent[]>(`/matches/${id}/record-event/`, data)).data,
  state: async (id: ID) => (await api.get<LiveState>(`/matches/${id}/state/`)).data,
  reports: async (id: ID) =>
    (await api.get<{ reports: MatchReport[]; comparison: ReportComparison }>(`/matches/${id}/reports/`)).data,
  submitReport: async (id: ID, data: Record<string, unknown>) =>
    (await api.post<MatchReport>(`/matches/${id}/submit-report/`, data)).data,
  returnReport: async (id: ID, report: ID, reason: string) =>
    (await api.post(`/matches/${id}/return-report/`, { report, reason })).data,
  /** `winner`: en la eliminación directa, ganador por penales si terminó empatado. */
  close: async (id: ID, notes = "", winner?: "home" | "away") => (await api.post<Match>(`/matches/${id}/close/`, { notes, winner })).data,
  notes: async (id: ID) => (await api.get<MatchNote[]>(`/matches/${id}/notes/`)).data,
  addNote: async (id: ID, data: Record<string, unknown>) => (await api.post<MatchNote>(`/matches/${id}/add-note/`, data)).data,
};

/** Fase de grupos y eliminación directa de una categoría. */
export const knockout = {
  view: async (tournament: ID, category: ID) => (await api.get<KnockoutView>("/knockout/", { params: { tournament, category } })).data,
  drawGroups: async (tournament: ID, category: ID, groups: number) =>
    (await api.post<{ groups: number; matches: number }>("/knockout/draw-groups/", { tournament, category, groups })).data,
  groupFixtures: async (tournament: ID, category: ID) =>
    (await api.post<{ created: number }>("/knockout/group-fixtures/", { tournament, category })).data,
  createBracket: async (tournament: ID, category: ID, start_stage: string) =>
    (await api.post<KnockoutView>("/knockout/create-bracket/", { tournament, category, start_stage })).data,
};

export const reviewCases = {
  list: async (params?: Record<string, unknown>) => (await api.get<Paginated<ReviewCase>>("/review-cases/", { params })).data,
  resolve: async (id: ID, data: { status: "resolved" | "dismissed"; resolution: string }) =>
    (await api.post<ReviewCase>(`/review-cases/${id}/resolve/`, data)).data,
};

export const standingsService = {
  get: async (params: { tournament: ID; category: ID; group?: ID | null; live?: boolean }) =>
    (await api.get<StandingRow[]>("/standings/", { params: { ...params, live: params.live ? 1 : undefined } })).data,
};

// ---------------------------------------------------------------- Administración
export const users = createResource<User>("users");
export const usersExtra = { unlock: (id: ID) => api.post(`/users/${id}/unlock/`) };
export const roles = createResource<Role>("roles");
export const permissions = {
  all: async () => (await api.get<Permission[]>("/permissions/")).data,
  /** Capacidades: lo que se asigna a roles y usuarios (cada una con sus permisos técnicos). */
  capabilities: async () => (await api.get<CapabilityCatalog>("/capabilities/")).data,
};
export const auditLogs = {
  list: async (params?: Record<string, unknown>) => (await api.get<Paginated<AuditLog>>("/audit-logs/", { params })).data,
  verify: async () => (await api.get<{ valid: boolean; checked: number; broken_at: ID | null }>("/audit-logs/verify/")).data,
};

// ---------------------------------------------------------------- Cuenta, legal y notificaciones
export const auth = {
  login: async (username: string, password: string) =>
    (await api.post<{ access: string; user: Me }>("/auth/login/", { username, password })).data,
  logout: () => api.post("/auth/logout/"),
  me: async () => (await api.get<Me>("/auth/me/")).data,
  changePassword: (current_password: string, new_password: string) =>
    api.post("/auth/change-password/", { current_password, new_password }),
};

export const legal = {
  current: async () => (await api.get<Terms>("/legal/terms/current/")).data,
  accept: () => api.post("/legal/terms/accept/"),
  publish: async (data: { version: string; title: string; content: string }) =>
    (await api.post<Terms>("/legal/terms/publish/", data)).data,
};

export const notifications = {
  list: async (params?: Record<string, unknown>) => (await api.get<Paginated<Notification>>("/notifications/", { params })).data,
  unreadCount: async () => (await api.get<{ count: number }>("/notifications/unread_count/")).data.count,
  read: (id: ID) => api.post(`/notifications/${id}/read/`),
  readAll: () => api.post("/notifications/read_all/"),
};

// ---------------------------------------------------------------- Documentación
export const docs = {
  list: async (params?: { search?: string; section?: string }) => (await api.get<DocPageSummary[]>("/docs/", { params })).data,
  get: async (slug: string) => (await api.get<DocPage>(`/docs/${slug}/`)).data,
  create: async (data: Partial<DocPage>) => (await api.post<DocPage>("/docs/", data)).data,
  update: async (slug: string, data: Partial<DocPage>) => (await api.patch<DocPage>(`/docs/${slug}/`, data)).data,
  revisions: async (slug: string) => (await api.get<DocRevision[]>(`/docs/${slug}/revisions/`)).data,
  permissionCatalog: async () => (await api.get<PermissionCatalog>("/docs/permission-catalog/")).data,
};

export const serverTime = async () =>
  (await api.get<{ utc: string; local: string; timezone: string; utc_offset: string; epoch_ms: number }>("/time/")).data;

// ---------------------------------------------------------------- Público
export const publicApi = {
  tournaments: async () => (await api.get<PublicTournament[]>("/public/tournaments/")).data,
  tournament: async (id: ID) => (await api.get<PublicTournament>(`/public/tournaments/${id}/`)).data,
  standings: async (id: ID, params: { category?: ID; group?: ID | null; live?: boolean }) =>
    (await api.get<StandingRow[]>(`/public/tournaments/${id}/standings/`, { params: { ...params, live: params.live ? 1 : undefined } })).data,
  stats: async (id: ID, category?: ID) =>
    (await api.get<{ scorers: PlayerStat[]; discipline: PlayerStat[] }>(`/public/tournaments/${id}/stats/`, { params: { category } })).data,
  matches: async (id: ID, params?: { category?: ID; matchday?: ID }) =>
    (await api.get<PublicMatch[]>(`/public/tournaments/${id}/matches/`, { params })).data,
  live: async () => (await api.get<{ today: PublicMatch[]; upcoming: PublicMatch[] }>("/public/matches/live/")).data,
  match: async (id: ID) => (await api.get<PublicMatch>(`/public/matches/${id}/`)).data,
};

export interface AutoScheduleRequest {
  tournament: ID;
  start_date: string;
  /** Días de la semana en que se juega (lunes = 0). */
  days: number[];
  /** Horario de cada cancha a usar (inicio y hora límite, HH:MM). */
  fields?: { id: ID; start: string; end: string }[];
  categories?: ID[];
  commit?: boolean;
}

export interface AutoSchedulePlan {
  days: {
    id: ID | null; number: number; date: string; weekday: string; start: string; end: string;
    matches: { id: ID; home: string; away: string; category: string; phase: string; field: string; sub_field: number | null; start: string; end: string }[];
  }[];
  total: number;
  scheduled: number;
  unscheduled: number;
  warnings: string[];
}

