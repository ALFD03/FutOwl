/** Tipos de dominio compartidos con la API de FutOwl. */

export type ID = number;

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface BaseEntity {
  id: ID;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type VatId = "V" | "E" | "J" | "G";

export interface Identity {
  vat_id: VatId;
  vat_number: string;
  vat_display: string;
  document_photo: string | null;
}

export interface Address {
  country: string;
  state: string;
  municipality: string;
  address: string;
  full_address: string;
}

export interface Person {
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  photo: string | null;
}

export interface Me {
  id: ID;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
  groups: string[];
  permissions: string[];
  profiles: { delegate_id: ID | null; referee_id: ID | null; coach_id: ID | null; team_ids: ID[] };
  terms_accepted: boolean;
  must_change_password: boolean;
}

export interface Category extends BaseEntity {
  name: string;
  max_age: number;
  birth_year_limit: number;
}

export interface Field extends BaseEntity, Omit<Address, never> {
  name: string;
  manager_name: string;
  manager_phone: string;
  length_m: string;
  width_m: string;
  is_divisible: boolean;
  mini_fields_count: number;
  capacity: number;
}

/** Ficha con usuario de acceso (delegado, árbitro, entrenador). */
export interface WithAccount {
  user: ID | null;
  username: string | null;
}

export interface Coach extends BaseEntity, Person, Identity, WithAccount {
  license_number: string;
  license_photo: string | null;
  license_expiry_year: number;
  license_valid: boolean;
  team: ID | null;
  team_name: string | null;
}

export interface Guardian extends BaseEntity, Identity {
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  relationship: string;
}

/** Paso del jugador por un equipo en un torneo. */
export interface PlayerHistory {
  id: ID;
  tournament: ID;
  tournament_name: string;
  team: ID;
  team_name: string;
  category_name: string;
  shirt_number: number | null;
  is_active: boolean;
  created_at: string;
}

export interface PlayerStats {
  goals: number;
  yellow_cards: number;
  red_cards: number;
  matches: number;
  tournaments: number;
  teams: number;
}

export interface Player extends BaseEntity, Person, Identity {
  document_kind: "id_card" | "birth_certificate";
  birth_date: string;
  age: number;
  is_minor: boolean;
  guardian: ID | null;
  guardian_detail: Guardian | null;
  current_team: ID | null;
  current_team_name: string | null;
  history: PlayerHistory[];
  stats: PlayerStats;
}

export type LicenseStatus = "endorsed" | "not_endorsed";

export interface Official extends BaseEntity, Person, Identity, WithAccount {
  license_status: LicenseStatus;
}

export interface Team extends BaseEntity, Identity, Address {
  name: string;
  logo: string | null;
  categories: ID[];
  category_names: string[];
  coach_names: string[];
  managers: ID[];
  manager_usernames: string[];
  manager_details: { id: ID; username: string; full_name: string }[];
  player_count: number;
}

/** Jugador inscrito en la nómina de un equipo para un torneo. */
export interface TeamPlayer extends BaseEntity {
  registration: ID;
  tournament: ID;
  tournament_name: string;
  team: ID;
  team_name: string;
  category: ID;
  category_name: string;
  player: ID;
  player_detail: {
    id: ID; full_name: string; photo: string | null; vat_display: string; birth_date: string; age: number;
    is_minor: boolean; guardian_name: string | null;
  };
  shirt_number: number | null;
}

export type TournamentStatus = "draft" | "registration" | "in_progress" | "finished";

export interface Tournament extends BaseEntity {
  name: string;
  logo: string | null;
  modality: string;
  modality_display: string;
  status: TournamentStatus;
  status_display: string;
  categories: ID[];
  category_names: string[];
  fields: ID[];
  field_names: string[];
  start_date: string | null;
  end_date: string | null;
  match_duration_minutes: number;
  periods: number;
  break_minutes: number;
  max_substitutions: number | null;
  max_lineup_players: number;
  starters_count: number;
  referees_required: number;
  points_win: number;
  points_draw: number;
  points_loss: number;
  regulation_text: string;
  regulation_file: string | null;
  lineup_sheet_file: string | null;
  substitution_card_file: string | null;
  team_count: number;
}

export interface Group extends BaseEntity {
  tournament: ID;
  category: ID;
  category_name: string;
  name: string;
  team_ids: ID[];
}

export interface Registration extends BaseEntity {
  tournament: ID;
  tournament_name: string;
  tournament_status: TournamentStatus;
  roster_count: number;
  team: ID;
  team_name: string;
  team_logo: string | null;
  category: ID;
  category_name: string;
  group: ID | null;
  group_name: string | null;
}

export type MatchdayStatus = "draft" | "submitted" | "confirmed" | "closed";

export interface Matchday {
  id: ID;
  tournament: ID;
  tournament_name: string;
  number: number;
  name: string;
  date: string;
  status: MatchdayStatus;
  status_display: string;
  submitted_at: string | null;
  confirmed_at: string | null;
  closed_at: string | null;
  match_count: number;
  created_at: string;
}

export type MatchStatus = "draft" | "pending" | "confirmed" | "in_progress" | "finished" | "closed" | "suspended";
export type MatchPhase = "not_started" | "playing" | "break" | "ended";

export interface Match {
  id: ID;
  tournament: ID;
  tournament_name: string;
  category: ID;
  category_name: string;
  group: ID | null;
  group_name: string | null;
  round_number: number;
  home: ID;
  home_name: string;
  home_team_id: ID;
  home_logo: string | null;
  away: ID;
  away_name: string;
  away_team_id: ID;
  away_logo: string | null;
  matchday: ID | null;
  matchday_label: string | null;
  field: ID | null;
  field_name: string | null;
  sub_field: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  delegate: ID | null;
  delegate_name: string | null;
  referee: ID | null;
  referee_name: string | null;
  assistant_referee_1: ID | null;
  assistant_referee_1_name: string | null;
  assistant_referee_2: ID | null;
  assistant_referee_2_name: string | null;
  status: MatchStatus;
  status_display: string;
  phase: MatchPhase;
  phase_display: string;
  current_period: number;
  period_started_at: string | null;
  assignment_version: number;
  home_score: number | null;
  away_score: number | null;
  is_locked: boolean;
  missing_fields: string[];
}

export type Party = "delegate" | "referee" | "assistant_1" | "assistant_2" | "home" | "away";

export interface PartyStatus {
  party: Party;
  label: string;
  required_version: number;
  response: "accepted" | "rejected" | null;
  reason: string;
  responded_at: string | null;
  under_review: boolean;
}

export interface Confirmation {
  id: ID;
  assignment_version: number;
  party: Party;
  party_display: string;
  response: "accepted" | "rejected";
  response_display: string;
  reason: string;
  username: string;
  created_at: string;
}

export interface Adjustment {
  id: ID;
  version_from: number;
  version_to: number;
  changes: Record<string, { antes: unknown; despues: unknown }>;
  affected_parties: Party[];
  reason: string;
  username: string;
  created_at: string;
}

export interface LineupPlayer {
  id: ID;
  team_player: ID;
  player_name: string;
  player_photo: string | null;
  shirt_number: number;
  is_starter: boolean;
  is_captain: boolean;
}

export interface Lineup {
  id: ID;
  match: ID;
  team: ID;
  team_name: string;
  status: "submitted" | "verified";
  status_display: string;
  coach: ID | null;
  coach_name: string | null;
  sheet_file: string | null;
  players: LineupPlayer[];
  verified_at: string | null;
}

export type EventType =
  | "delegate_arrival" | "team_arrival" | "documents_verified" | "kickoff" | "period_start" | "goal"
  | "penalty_goal" | "own_goal" | "yellow_card" | "red_card" | "substitution" | "incident" | "period_end"
  | "match_end" | "annulment" | "note";

export interface MatchEvent {
  id: ID;
  sequence: number;
  type: EventType;
  type_display: string;
  period: number;
  minute: number | null;
  team: ID | null;
  team_name: string | null;
  player?: ID | null;
  player_name: string | null;
  player_in?: ID | null;
  player_in_name: string | null;
  annuls: ID | null;
  annulled: boolean;
  notes?: string;
  is_public?: boolean;
  recorded_by_name?: string;
  created_at: string;
}

export interface TeamLiveState {
  goals: number;
  yellow: number;
  red: number;
  substitutions: number;
  arrived: boolean;
  documents_verified: boolean;
  on_field: ID[];
  bench: ID[];
  sent_off: ID[];
}

export interface LiveState {
  home_score: number;
  away_score: number;
  home: TeamLiveState;
  away: TeamLiveState;
  delegate_arrived: boolean;
  kicked_off: boolean;
  ended: boolean;
  phase: MatchPhase;
  current_period: number;
  period_started_at: string | null;
  minute: number | null;
  can_operate?: boolean;
  status?: MatchStatus;
}

export interface MatchReport {
  id: ID;
  role: "delegate" | "referee";
  role_display: string;
  version: number;
  home_score: number;
  away_score: number;
  home_yellow: number;
  away_yellow: number;
  home_red: number;
  away_red: number;
  observations: string;
  attachment: string | null;
  submitted_by_name: string;
  returned: { reason: string; by: string; at: string } | null;
  created_at: string;
}

export interface ReportComparison {
  delegate_report_id: ID | null;
  referee_report_id: ID | null;
  both_submitted: boolean;
  coincide: boolean;
  differences: { field: string; delegate: number; referee: number }[];
  events_tally: Record<string, number>;
  warnings: string[];
}

export interface MatchNote {
  id: ID;
  kind: "note" | "appeal";
  kind_display: string;
  body: string;
  attachment: string | null;
  author_name: string;
  created_at: string;
}

export interface ReviewCase {
  id: ID;
  kind: "rejection" | "appeal";
  kind_display: string;
  status: "open" | "resolved" | "dismissed";
  status_display: string;
  match: ID;
  match_label: string;
  party: Party | null;
  reason: string;
  raised_by_name: string;
  resolution: string;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface StandingRow {
  position: number;
  team_id: ID;
  team: string;
  logo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: ("G" | "E" | "P")[];
}

export interface PlayerStat {
  team_player: ID;
  name: string;
  team: string;
  goals: number;
  yellow: number;
  red: number;
}

export interface Notification {
  id: ID;
  title: string;
  message: string;
  level: "info" | "success" | "warning" | "danger";
  link: string;
  created_at: string;
  read_at: string | null;
}

export interface User {
  id: ID;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
  is_staff: boolean;
  groups: ID[];
  user_permissions: ID[];
  last_login: string | null;
  date_joined: string;
  must_change_password: boolean;
}

export interface Role {
  id: ID;
  name: string;
  permissions: ID[];
  user_count: number;
}

export interface Permission {
  id: ID;
  name: string;
  /** Nombre en español ("Crear equipos", "Cerrar partidos"). */
  label: string;
  codename: string;
  code: string;
  app_label: string;
  model: string;
  model_label: string;
}

export interface AuditLog {
  id: ID;
  created_at: string;
  user: ID | null;
  username: string;
  action: string;
  app_label: string;
  model: string;
  object_id: string;
  object_repr: string;
  changes: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string;
  path: string;
  method: string;
  prev_hash: string;
  hash: string;
}

export interface Terms {
  id: ID;
  version: string;
  title: string;
  content: string;
  created_at: string;
}

export interface PublicTournament {
  id: ID;
  name: string;
  logo: string | null;
  modality: string;
  modality_display: string;
  status: TournamentStatus;
  status_display: string;
  start_date: string | null;
  end_date: string | null;
  categories: { id: ID; name: string }[];
  groups?: { id: ID; name: string; category: ID }[];
  regulation_text?: string;
}

export interface PublicMatch {
  id: ID;
  tournament: ID;
  tournament_name: string;
  category: ID;
  category_name: string;
  group_name: string | null;
  round_number: number;
  home_name: string;
  away_name: string;
  home_logo: string | null;
  away_logo: string | null;
  field_name: string | null;
  sub_field: number | null;
  scheduled_start: string | null;
  matchday_label: string | null;
  status: MatchStatus;
  status_display: string;
  phase: MatchPhase;
  current_period: number;
  score: { home: number; away: number; minute: number | null; official: boolean } | null;
  events?: MatchEvent[];
  stats?: { home: { yellow: number; red: number; substitutions: number }; away: { yellow: number; red: number; substitutions: number } };
}

// ---------------------------------------------------------------- Documentación
export type DocSection = "manual" | "faq" | "permissions" | "reference";

export interface DocPageSummary {
  id: ID;
  slug: string;
  title: string;
  summary: string;
  section: DocSection;
  section_display: string;
  order: number;
  /** Publicada (visible para todos). Las no publicadas solo las ve el superusuario. */
  is_active: boolean;
  updated_at: string;
}

export interface DocPage extends DocPageSummary {
  content: string;
  updated_by_name: string | null;
}

export interface DocRevision {
  id: ID;
  title: string;
  content: string;
  created_at: string;
  edited_by_name: string;
}

export interface PermissionCatalog {
  permissions: Permission[];
  roles: { id: ID; name: string; user_count: number; permissions: string[] }[];
}
