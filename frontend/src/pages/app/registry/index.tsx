/** Páginas de registros maestros, construidas sobre ResourcePage + definiciones de campos. */
import { useNavigate } from "react-router-dom";
import { ClipboardList, Flag, LayoutGrid, MapPin, Megaphone, Shield, UserRound, UsersRound } from "lucide-react";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { DOCUMENT_ACCEPT, IMAGE_ACCEPT, LICENSE_OPTIONS, type FieldDef } from "@/components/forms";
import { TeamCrest } from "@/components/match/TeamCrest";
import { Avatar, Badge, StatusBadge } from "@/components/ui";
import { categories, coaches, delegates, fields as fieldsService, guardians, players, referees, teams, users } from "@/services";
import type { Category, Coach, Field, Guardian, Official, Player, Team, User } from "@/types";
import { formatDate } from "@/utils/datetime";

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
        { name: "max_age", label: "Tope de edad", type: "number", required: true, min: 1, max: 99, placeholder: "11" },
        { name: "birth_year_limit", label: "Tope de año de nacimiento", type: "year", required: true, min: 1900, max: 2100, placeholder: "2015", help: "Nacidos en este año o después" },
      ]}
      columns={[
        { key: "name", header: "Nombre", render: (r) => <b>{r.name}</b> },
        { key: "max_age", header: "Tope de edad", render: (r) => `${r.max_age} años` },
        { key: "birth_year_limit", header: "Nacidos desde", render: (r) => r.birth_year_limit },
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
        { name: "is_divisible", label: "Divisible", type: "checkbox", placeholder: "La cancha es divisible en mini canchas", section: "Medidas y capacidad" },
        { name: "mini_fields_count", label: "Cantidad de mini canchas", type: "number", min: 2, max: 16, defaultValue: 1, section: "Medidas y capacidad",
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
      service={coaches} model="registry.coach" createLabel="Nuevo entrenador"
      fields={[
        ...PERSON,
        { name: "license_number", label: "N.º de licencia", type: "text", required: true, section: "Licencia" },
        { name: "license_expiry_year", label: "Año de vencimiento", type: "year", required: true, min: 2000, max: 2100, defaultValue: year + 1, section: "Licencia" },
        { name: "license_photo", label: "Foto de la licencia", type: "file", accept: DOCUMENT_ACCEPT, section: "Licencia" },
      ]}
      columns={[
        personColumn<Coach>(),
        { key: "phone", header: "Teléfono", render: (r) => r.phone || "—" },
        { key: "license", header: "Licencia", render: (r) => <span>{r.license_number} <StatusBadge status={r.license_valid ? "confirmed" : "rejected"} label={r.license_valid ? `Vigente ${r.license_expiry_year}` : `Vencida ${r.license_expiry_year}`} /></span> },
      ]} />
  );
}

// ------------------------------------------------------------------- Representantes
export function GuardiansPage() {
  return (
    <ResourcePage<Guardian> title="Representantes" subtitle="Responsables legales de jugadores menores de edad" icon={<UserRound className="h-6 w-6" />}
      service={guardians} model="registry.guardian" createLabel="Nuevo representante"
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
  { name: "guardian", label: "Representante", type: "select", wide: true, section: "Representante (obligatorio para menores de 18 años)",
    source: { service: guardians, label: (g: Guardian) => `${g.first_name} ${g.last_name} · ${g.vat_display}` } },
];

export function PlayersPage() {
  return (
    <ResourcePage<Player> title="Jugadores" subtitle="Fichas de jugadores con edad calculada automáticamente" icon={<UsersRound className="h-6 w-6" />}
      service={players} model="registry.player" createLabel="Nuevo jugador" fields={PLAYER_FIELDS}
      columns={[
        personColumn<Player>(),
        { key: "age", header: "Edad", render: (r) => <span>{r.age} años <span className="block text-xs text-slate-500">{formatDate(r.birth_date)}</span></span> },
        { key: "guardian", header: "Representante", render: (r) => r.guardian_detail ? `${r.guardian_detail.first_name} ${r.guardian_detail.last_name}` : r.is_minor ? <Badge tone="crimson">Falta</Badge> : "No aplica" },
        { key: "teams", header: "Equipos", render: (r) => r.memberships.length ? r.memberships.map((m) => <Badge key={m.id} tone="navy" className="mr-1">{m.team_name} · {m.category_name}</Badge>) : <span className="text-slate-400">Libre</span> },
      ]} />
  );
}

// ------------------------------------------------------------------- Delegados y árbitros
const officialFields = (label: string): FieldDef[] => [
  ...PERSON,
  { name: "license_status", label: "Licencia", type: "select", required: true, options: LICENSE_OPTIONS, defaultValue: "not_endorsed" },
  { name: "user", label: `Usuario vinculado (${label})`, type: "select", help: "Permite confirmar asignaciones y operar en la app",
    source: { service: users, label: (u: User) => `${u.username} · ${u.first_name} ${u.last_name}` } },
];

const officialColumns = [
  personColumn<Official>(),
  { key: "phone", header: "Teléfono", render: (r: Official) => r.phone || "—" },
  { key: "license", header: "Licencia", render: (r: Official) => <StatusBadge status={r.license_status} label={r.license_status === "endorsed" ? "Avalado" : "No avalado"} /> },
  { key: "user", header: "Usuario", render: (r: Official) => r.username ? <Badge tone="navy">@{r.username}</Badge> : <span className="text-slate-400">Sin usuario</span> },
];

export function DelegatesPage() {
  return <ResourcePage<Official> title="Delegados" subtitle="Responsables de mesa técnica" icon={<Flag className="h-6 w-6" />}
    service={delegates} model="registry.delegate" createLabel="Nuevo delegado" fields={officialFields("delegado")} columns={officialColumns} />;
}

export function RefereesPage() {
  return <ResourcePage<Official> title="Árbitros" subtitle="Ternas arbitrales" icon={<Megaphone className="h-6 w-6" />}
    service={referees} model="registry.referee" createLabel="Nuevo árbitro" fields={officialFields("árbitro")} columns={officialColumns} />;
}

// ------------------------------------------------------------------- Equipos
export const TEAM_FIELDS: FieldDef[] = [
  { name: "name", label: "Nombre", type: "text", required: true },
  { name: "vat", label: "RIF", type: "vat", required: true },
  { name: "logo", label: "Logo", type: "image", accept: IMAGE_ACCEPT },
  { name: "document_photo", label: "Documento RIF", type: "file", accept: DOCUMENT_ACCEPT },
  ...ADDRESS,
  { name: "categories", label: "Categorías", type: "multiselect", wide: true, section: "Deportivo", source: { service: categories, label: (c: Category) => c.name } },
  { name: "home_field", label: "Cancha", type: "select", section: "Deportivo", source: { service: fieldsService, label: (f: Field) => f.name } },
  { name: "coaches", label: "Entrenadores", type: "multiselect", wide: true, section: "Deportivo", source: { service: coaches, label: (c: Coach) => c.full_name } },
  { name: "managers", label: "Gestores (usuarios)", type: "multiselect", wide: true, section: "Deportivo",
    help: "Usuarios que cargan alineaciones y confirman asistencia", source: { service: users, label: (u: User) => u.username } },
];

export function TeamsPage() {
  const navigate = useNavigate();
  return (
    <ResourcePage<Team> title="Equipos" subtitle="Clubes, categorías, cuerpo técnico y nómina" icon={<Shield className="h-6 w-6" />}
      service={teams} model="registry.team" createLabel="Nuevo equipo" fields={TEAM_FIELDS} formSize="lg"
      onRowClick={(r) => navigate(`/app/equipos/${r.id}`)}
      columns={[
        { key: "name", header: "Equipo", render: (r) => <span className="flex items-center gap-3"><TeamCrest src={r.logo} name={r.name} size="sm" /><span><b>{r.name}</b><span className="block text-xs text-slate-500">RIF {r.vat_display}</span></span></span> },
        { key: "categories", header: "Categorías", render: (r) => r.category_names.map((c) => <Badge key={c} tone="gold" className="mr-1">{c}</Badge>) },
        { key: "location", header: "Ubicación", render: (r) => `${r.municipality}, ${r.state}` },
        { key: "roster", header: "Nómina", render: (r) => `${r.roster_count} jugadores` },
      ]} />
  );
}
