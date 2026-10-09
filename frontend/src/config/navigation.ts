import {
  Activity, BadgeCheck, BookOpen, CircleHelp, CalendarDays, ClipboardList, FileText, Flag, Gauge, History, KeyRound, LayoutGrid, MapPin,
  Scale, Shield, ShieldCheck, Trophy, UserCog, UserRound, Users, UsersRound, Megaphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  perm?: string | string[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    title: "General",
    items: [
      { to: "/app", label: "Panel", icon: Gauge },
      { to: "/app/mis-partidos", label: "Mis asignaciones", icon: BadgeCheck },
    ],
  },
  {
    title: "Competición",
    items: [
      { to: "/app/torneos", label: "Torneos", icon: Trophy, perm: "tournaments.view_tournament" },
      { to: "/app/jornadas", label: "Jornadas", icon: CalendarDays, perm: "competition.view_matchday" },
      { to: "/app/partidos", label: "Partidos", icon: Activity, perm: "competition.view_match" },
      { to: "/app/revisiones", label: "Revisiones", icon: Scale, perm: "competition.view_reviewcase" },
    ],
  },
  {
    title: "Registro",
    items: [
      { to: "/app/equipos", label: "Equipos", icon: Shield, perm: "registry.view_team" },
      { to: "/app/jugadores", label: "Jugadores", icon: UsersRound, perm: "registry.view_player" },
      { to: "/app/entrenadores", label: "Entrenadores", icon: ClipboardList, perm: "registry.view_coach" },
      { to: "/app/representantes", label: "Representantes", icon: UserRound, perm: "registry.view_guardian" },
      { to: "/app/delegados", label: "Delegados", icon: Flag, perm: "registry.view_delegate" },
      { to: "/app/arbitros", label: "Árbitros", icon: Megaphone, perm: "registry.view_referee" },
      { to: "/app/canchas", label: "Canchas", icon: MapPin, perm: "registry.view_field" },
      { to: "/app/categorias", label: "Categorías", icon: LayoutGrid, perm: "registry.view_category" },
    ],
  },
  {
    title: "Administración",
    items: [
      { to: "/app/usuarios", label: "Usuarios", icon: Users, perm: "accounts.view_user" },
      { to: "/app/roles", label: "Roles y permisos", icon: KeyRound, perm: "auth.view_group" },
      { to: "/app/auditoria", label: "Auditoría", icon: History, perm: "audit.view_auditlog" },
      { to: "/app/terminos", label: "Términos", icon: FileText, perm: "legal.add_termsversion" },
    ],
  },
  {
    title: "Ayuda",
    items: [
      { to: "/app/ayuda", label: "Documentación", icon: BookOpen },
      { to: "/app/ayuda/preguntas-frecuentes", label: "Preguntas frecuentes", icon: CircleHelp },
    ],
  },
];

export const ACCOUNT_ITEMS: NavItem[] = [
  { to: "/app/perfil", label: "Mi cuenta", icon: UserCog },
  { to: "/app/notificaciones", label: "Notificaciones", icon: ShieldCheck },
];
