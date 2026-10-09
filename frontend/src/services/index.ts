import { api } from "@/api/client";
import type {
  Adjustment, AuditLog, Category, Coach, Confirmation, DocPage, DocPageSummary, DocRevision, Field, Group, Guardian, ID, Lineup, LiveState, Match,
  Matchday, MatchEvent, MatchNote, MatchReport, Me, Notification, Official, Paginated, PartyStatus, Permission, PermissionCatalog,
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
export const tournaments = createResource<Tournament>("tournaments");
export const groups = createResource<Group>("groups");
export const registrations = createResource<Registration>("registrations");

// ---------------------------------------------------------------- Competición
export const matchdays = {
  ...createResource<Matchday>("matchdays"),
  remove: (id: ID) => api.delete(`/matchdays/${id}/`),
  completeness: async (id: ID) =>
    (await api.get<{ total: number; incomplete: Record<string, string[]>; ready: boolean }>(`/matchdays/${id}/completeness/`)).data,
  submit: async (id: ID) => (await api.post<Matchday>(`/matchdays/${id}/submit/`)).data,
  close: async (id: ID) => (await api.post<Matchday>(`/matchdays/${id}/close/`)).data,
};

export const matches = {
  ...createResource<Match>("matches"),
  remove: (id: ID) => api.delete(`/matches/${id}/`),
  generateFixture: async (data: { tournament: ID; category: ID; group?: ID | null; double?: boolean }) =>
    (await api.post<{ created: number }>("/matches/generate-fixture/", data)).data,
  confirmations: async (id: ID) =>
    (await api.get<{ summary: PartyStatus[]; my_parties: string[]; history: Confirmation[] }>(`/matches/${id}/confirmations/`)).data,
  respond: async (id: ID, data: { party: string; response: "accepted" | "rejected"; reason?: string }) =>
    (await api.post<Confirmation>(`/matches/${id}/respond/`, data)).data,
  adjust: async (id: ID, data: Record<string, unknown>) => (await api.post<Adjustment>(`/matches/${id}/adjust/`, data)).data,
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
  close: async (id: ID, notes = "") => (await api.post<Match>(`/matches/${id}/close/`, { notes })).data,
  notes: async (id: ID) => (await api.get<MatchNote[]>(`/matches/${id}/notes/`)).data,
  addNote: async (id: ID, data: Record<string, unknown>) => (await api.post<MatchNote>(`/matches/${id}/add-note/`, data)).data,
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
