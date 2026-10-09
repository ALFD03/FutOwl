/** Páginas de registros maestros, construidas sobre ResourcePage + definiciones de campos. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Flag, LayoutGrid, MapPin, Megaphone, Shield, UserRound, UsersRound } from "lucide-react";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { accountField, DOCUMENT_ACCEPT, guardianField, IMAGE_ACCEPT, LICENSE_OPTIONS, type FieldDef } from "@/components/forms";
import { TeamCrest } from "@/components/match/TeamCrest";
import { Avatar, Badge, StatusBadge } from "@/components/ui";
import { categories, coaches, delegates, fields as fieldsService, guardians, players, referees, teams } from "@/services";
import type { Category, Coach, Field, Guardian, Official, Player, Team, WithAccount } from "@/types";
import { formatDate } from "@/utils/datetime";

import { PlayerProfile, teamsOf } from "./PlayerProfile";

const BY_NAME_OR_ID = "Buscar por nombre o cédula…";

const userColumn = <T extends WithAccount>() => ({
  key: "user",
  header: "Usuario",
  render: (r: T) => r.username ? <Badge tone="navy">@{r.username}</Badge> : <span className="text-slate-400">Sin usuario</span>,
});

const ADDRESS: FieldDef[] = [
  { name: "country", label: "País", type: "text", required: true, defaultValue: "Venezuela", section: "Ubicación" },
  { name: "state", label: "Estado", type: "state", required: true, section: "Ubicación" },
  { name: "municipality", label: "Municipio", type: "text", required: true, section: "Ubicación" },
  { name: "address", label: "Dirección", type: "text", required: true, section: "Ubicación" },
];

const PERSON: FieldDef[] = [
  { name: "first_name", label: "Nombres", type: "text", required: true },
  { name: "last_name", label: "Apellidos", type: "text", required: true },
  { name: "vat", label: "Cédula", type: "vat", required: true },
  { name: "phone", label: "Teléfono", type: "phone" },
  { name: "photo", label: "Foto", type: "image", accept: IMAGE_ACCEPT },
  { name: "document_photo", label: "Foto de la cédula", type: "file", accept: DOCUMENT_ACCEPT },
];

const personColumn = <T extends { photo: string | null; full_name: string; vat_display: string }>() => ({
  key: "name",
  header: "Nombre",
  render: (r: T) => (
    <span className="flex items-center gap-3">
      <Avatar src={r.photo} name={r.full_name} size="sm" />
      <span><b className="text-slate-800 dark:text-slate-100">{r.full_name}</b><span className="block text-xs text-slate-500">{r.vat_display || "Sin documento"}</span></span>
    </span>
  ),
});

// ------------------------------------------------------------------- Categorías
export function CategoriesPage() {
  return (
    <ResourcePage<Category> title="Categorías" subtitle="Rangos de edad por año de nacimiento" icon={<LayoutGrid className="h-6 w-6" />}
      service={categories} model="registry.category" createLabel="Nueva categoría" formSize="sm"
      fields={[
        { name: "name", label: "Nombre", type: "text", required: true, placeholder: "Sub 12", wide: true },
        { name: "max_age", label: "Tope de edad", type: "number", required: true, min: 1, max: 99, placeholder: "11", wide: true,
          help: (v) => typeof v.max_age === "number" && v.max_age > 0
            ? `Este año (${new Date().getFullYear()}) admite nacidos desde ${new Date().getFullYear() - v.max_age}. El año tope se recalcula solo cada año.`
            : "El año de nacimiento tope se calcula contra el año en curso." },
      ]}
      columns={[
        { key: "name", header: "Nombre", render: (r) => <b>{r.name}</b> },
        { key: "max_age", header: "Tope de edad", render: (r) => `${r.max_age} años` },
        { key: "birth_year_limit", header: `Nacidos desde (${new Date().getFullYear()})`, render: (r) => <Badge tone="gold">{r.birth_year_limit}</Badge> },
      ]} />
  );
}

// ------------------------------------------------------------------- Canchas
export function FieldsPage() {
  return (
    <ResourcePage<Field> title="Canchas" subtitle="Sedes, medidas y capacidad simultánea" icon={<MapPin className="h-6 w-6" />}
      service={fieldsService} model="registry.field" createLabel="Nueva cancha"
      fields={[
        { name: "name", label: "Nombre", type: "text", required: true, wide: true },
        ...ADDRESS,
        { name: "manager_name", label: "Responsable", type: "text", required: true, section: "Responsable" },
        { name: "manager_phone", label: "Teléfono del responsable", type: "phone", required: true, section: "Responsable" },
        { name: "length_m", label: "Largo / alto (m)", type: "number", step: "0.01", required: true, section: "Medidas y capacidad" },
        { name: "width_m", label: "Ancho (m)", type: "number", step: "0.01", required: true, section: "Medidas y capacidad" },
        { name: "is_divisible", label: "Cancha divisible", type: "checkbox", placeholder: "Se puede dividir en mini canchas para jugar partidos en simultáneo", section: "Medidas y capacidad", wide: true },
        { name: "mini_fields_count", label: "Cantidad de mini canchas", type: "number", min: 2, max: 16, defaultValue: 2, section: "Medidas y capacidad",
          hidden: (v) => !v.is_divisible, help: "Determina cuántos partidos simultáneos soporta" },
      ]}
      columns={[
        { key: "name", header: "Cancha", render: (r) => <span><b>{r.name}</b><span className="block text-xs text-slate-500">{r.municipality}, {r.state}</span></span> },
        { key: "manager", header: "Responsable", render: (r) => <span>{r.manager_name}<span className="block text-xs text-slate-500">{r.manager_phone}</span></span> },
        { key: "size", header: "Medidas", render: (r) => `${Number(r.length_m)} × ${Number(r.width_m)} m` },
        { key: "capacity", header: "Simultáneos", render: (r) => <Badge tone={r.is_divisible ? "gold" : "slate"}>{r.capacity} {r.is_divisible ? "(divisible)" : ""}</Badge> },
      ]} />
  );
}

// ------------------------------------------------------------------- Entrenadores
export function CoachesPage() {
  const year = new Date().getFullYear();
  return (
    <ResourcePage<Coach> title="Entrenadores" subtitle="Cuerpo técnico y licencias" icon={<ClipboardList className="h-6 w-6" />}
      service={coaches} model="registry.coach" createLabel="Nuevo entrenador" searchPlaceholder={BY_NAME_OR_ID}
      fields={[
        ...PERSON,
        { name: "license_number", label: "N.º de licencia", type: "text", required: true, section: "Licencia" },
        { name: "license_expiry_year", label: "Año de vencimiento", type: "year", required: true, min: 2000, max: 2100, defaultValue: year + 1, section: "Licencia" },
        { name: "license_photo", label: "Foto de la licencia", type: "file", accept: DOCUMENT_ACCEPT, section: "Licencia" },
        accountField({ roleLabel: "Entrenador" }),
      ]}
      columns={[
        personColumn<Coach>(),
        { key: "team", header: "Equipo", render: (r) => r.team_name ? <Badge tone="navy">{r.team_name}</Badge> : <span className="text-slate-400">Libre</span> },
        { key: "license", header: "Licencia", render: (r) => <span>{r.license_number} <StatusBadge status={r.license_valid ? "confirmed" : "rejected"} label={r.license_valid ? `Vigente ${r.license_expiry_year}` : `Vencida ${r.license_expiry_year}`} /></span> },
        userColumn<Coach>(),
      ]} />
  );
}

// ------------------------------------------------------------------- Representantes
export function GuardiansPage() {
  return (
    <ResourcePage<Guardian> title="Representantes" subtitle="Responsables legales de jugadores menores de edad" icon={<UserRound className="h-6 w-6" />}
      service={guardians} model="registry.guardian" createLabel="Nuevo representante" searchPlaceholder={BY_NAME_OR_ID}
      fields={[
        { name: "first_name", label: "Nombres", type: "text", required: true },
        { name: "last_name", label: "Apellidos", type: "text", required: true },
        { name: "vat", label: "Cédula", type: "vat", required: true },
        { name: "phone", label: "Teléfono", type: "phone", required: true },
        { name: "relationship", label: "Parentesco", type: "text", placeholder: "Madre, padre, tutor…" },
        { name: "document_photo", label: "Foto de la cédula", type: "file", accept: DOCUMENT_ACCEPT },
      ]}
      columns={[
        { key: "name", header: "Nombre", render: (r) => <span><b>{r.first_name} {r.last_name}</b><span className="block text-xs text-slate-500">{r.vat_display}</span></span> },
        { key: "phone", header: "Teléfono" },
        { key: "relationship", header: "Parentesco", render: (r) => r.relationship || "—" },
      ]} />
  );
}

// ------------------------------------------------------------------- Jugadores
export const PLAYER_FIELDS: FieldDef[] = [
  { name: "first_name", label: "Nombres", type: "text", required: true },
  { name: "last_name", label: "Apellidos", type: "text", required: true },
  { name: "birth_date", label: "Fecha de nacimiento", type: "date", required: true, help: "La edad se calcula automáticamente" },
  { name: "document_kind", label: "Soporte de identidad", type: "select", required: true, defaultValue: "id_card",
    options: [{ value: "id_card", label: "Cédula de identidad" }, { value: "birth_certificate", label: "Partida de nacimiento" }] },
  { name: "vat", label: "Cédula", type: "vat", help: "Opcional si el soporte es partida de nacimiento" },
  { name: "phone", label: "Teléfono (propio o del representante)", type: "phone" },
  { name: "photo", label: "Foto", type: "image", accept: IMAGE_ACCEPT },
  { name: "document_photo", label: "Foto de cédula o partida", type: "file", accept: DOCUMENT_ACCEPT },
  guardianField,
];

export function PlayersPage() {
  const [profile, setProfile] = useState<number | null>(null);
  return (
    <>
      <ResourcePage<Player> title="Jugadores" subtitle="Fichas únicas: un jugador se crea una vez y se inscribe en cada torneo con su equipo"
        icon={<UsersRound className="h-6 w-6" />} service={players} model="registry.player" createLabel="Nuevo jugador"
        fields={PLAYER_FIELDS} formSize="lg" searchPlaceholder={BY_NAME_OR_ID} onRowClick={(r) => setProfile(r.id)}
        columns={[
          personColumn<Player>(),
          { key: "age", header: "Edad", render: (r) => <span>{r.age} años <span className="block text-xs text-slate-500">{formatDate(r.birth_date)}</span></span> },
          { key: "team", header: "Equipo actual", render: (r) => r.current_team_name ? <Badge tone="navy">{r.current_team_name}</Badge> : <span className="text-slate-400">Libre</span> },
          { key: "history", header: "Ha jugado en", render: (r) => {
            const past = teamsOf(r).filter((t) => t.id !== r.current_team);
            return past.length ? past.map((t) => <Badge key={t.id} className="mr-1">{t.name}</Badge>) : <span className="text-slate-400">—</span>;
          } },
          { key: "stats", header: "G · PJ · TA · TR", render: (r) => (
            <span className="whitespace-nowrap font-mono text-xs">
              <b className="text-gold-600 dark:text-gold-400">{r.stats.goals}</b> · {r.stats.matches} · <span className="text-gold-600">{r.stats.yellow_cards}</span> · <span className="text-crimson-600">{r.stats.red_cards}</span>
            </span>
          ) },
          { key: "guardian", header: "Representante", render: (r) => r.guardian_detail ? `${r.guardian_detail.first_name} ${r.guardian_detail.last_name}` : r.is_minor ? <Badge tone="crimson">Falta</Badge> : "No aplica" },
        ]} />
      <PlayerProfile playerId={profile} onClose={() => setProfile(null)} />
    </>
  );
}

// ------------------------------------------------------------------- Delegados y árbitros
const officialFields = (roleLabel: string): FieldDef[] => [
  ...PERSON,
  { name: "license_status", label: "Licencia", type: "select", required: true, options: LICENSE_OPTIONS, defaultValue: "not_endorsed" },
  accountField({ roleLabel }),
];

const officialColumns = [
  personColumn<Official>(),
  { key: "phone", header: "Teléfono", render: (r: Official) => r.phone || "—" },
  { key: "license", header: "Licencia", render: (r: Official) => <StatusBadge status={r.license_status} label={r.license_status === "endorsed" ? "Avalado" : "No avalado"} /> },
  userColumn<Official>(),
];

export function DelegatesPage() {
  return <ResourcePage<Official> title="Delegados" subtitle="Responsables de mesa técnica" icon={<Flag className="h-6 w-6" />} searchPlaceholder={BY_NAME_OR_ID}
    service={delegates} model="registry.delegate" createLabel="Nuevo delegado" fields={officialFields("Delegado")} columns={officialColumns} />;
}

export function RefereesPage() {
  return <ResourcePage<Official> title="Árbitros" subtitle="Ternas arbitrales" icon={<Megaphone className="h-6 w-6" />} searchPlaceholder={BY_NAME_OR_ID}
    service={referees} model="registry.referee" createLabel="Nuevo árbitro" fields={officialFields("Árbitro")} columns={officialColumns} />;
}

// ------------------------------------------------------------------- Equipos
/** Al crear: datos del club y su usuario de acceso. Categorías, entrenadores y nómina se gestionan en la ficha del equipo. */
export const TEAM_FIELDS: FieldDef[] = [
  { name: "name", label: "Nombre", type: "text", required: true },
  { name: "vat", label: "RIF", type: "vat", required: true },
  { name: "logo", label: "Logo", type: "image", accept: IMAGE_ACCEPT },
  { name: "document_photo", label: "Documento RIF", type: "file", accept: DOCUMENT_ACCEPT },
  ...ADDRESS,
  accountField({ roleLabel: "Gestor de equipo", required: true, multiple: true }),
];

export function TeamsPage() {
  const navigate = useNavigate();
  return (
    <ResourcePage<Team> title="Equipos" subtitle="Clubes, categorías, cuerpo técnico, jugadores y nómina por torneo" icon={<Shield className="h-6 w-6" />}
      service={teams} model="registry.team" createLabel="Nuevo equipo" fields={TEAM_FIELDS} formSize="lg" searchPlaceholder="Buscar por nombre o RIF…"
      onRowClick={(r) => navigate(`/app/equipos/${r.id}`)}
      columns={[
        { key: "name", header: "Equipo", render: (r) => <span className="flex items-center gap-3"><TeamCrest src={r.logo} name={r.name} size="sm" /><span><b>{r.name}</b><span className="block text-xs text-slate-500">RIF {r.vat_display}</span></span></span> },
        { key: "categories", header: "Categorías", render: (r) => r.category_names.length ? r.category_names.map((c) => <Badge key={c} tone="gold" className="mr-1">{c}</Badge>) : <span className="text-slate-400">—</span> },
        { key: "location", header: "Ubicación", render: (r) => `${r.municipality}, ${r.state}` },
        { key: "players", header: "Jugadores", render: (r) => `${r.player_count}` },
        { key: "access", header: "Acceso", render: (r) => r.manager_usernames.map((u) => <Badge key={u} tone="navy" className="mr-1">@{u}</Badge>) },
      ]} />
  );
}
