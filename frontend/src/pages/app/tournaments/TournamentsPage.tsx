import { useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { DOCUMENT_ACCEPT, IMAGE_ACCEPT, type FieldDef } from "@/components/forms";
import { Badge, StatusBadge } from "@/components/ui";
import { categories, fields, tournaments } from "@/services";
import type { Category, Field, Tournament } from "@/types";
import { formatDate } from "@/utils/datetime";

export const TOURNAMENT_FIELDS: FieldDef[] = [
  { name: "name", label: "Nombre", type: "text", required: true, wide: true },
  { name: "logo", label: "Logo", type: "image", accept: IMAGE_ACCEPT },
  { name: "modality", label: "Modalidad", type: "select", required: true, defaultValue: "league", options: [
    { value: "league", label: "Liga (todos contra todos)" }, { value: "league_double", label: "Liga ida y vuelta" },
    { value: "groups", label: "Fase de grupos" }, { value: "groups_knockout", label: "Grupos + eliminación directa" },
    { value: "knockout", label: "Eliminación directa" },
  ] },
  { name: "status", label: "Estado", type: "select", required: true, defaultValue: "draft", options: [
    { value: "draft", label: "Borrador (no público)" }, { value: "registration", label: "Inscripciones" },
    { value: "in_progress", label: "En curso" }, { value: "finished", label: "Finalizado" },
  ] },
  { name: "start_date", label: "Fecha de inicio", type: "date" },
  { name: "end_date", label: "Fecha de fin", type: "date" },
  { name: "categories", label: "Categorías permitidas", type: "multiselect", required: true, wide: true, source: { service: categories, label: (c: Category) => c.name } },
  { name: "fields", label: "Canchas disponibles (tentativas)", type: "multiselect", wide: true, source: { service: fields, label: (f: Field) => `${f.name} (${f.capacity})` } },
  { name: "match_duration_minutes", label: "Duración del partido (min)", type: "number", defaultValue: 60, section: "Reglas de juego" },
  { name: "periods", label: "Tiempos", type: "number", min: 1, max: 4, defaultValue: 2, section: "Reglas de juego" },
  { name: "break_minutes", label: "Descanso (min)", type: "number", defaultValue: 10, section: "Reglas de juego" },
  { name: "max_substitutions", label: "Cambios máximos", type: "number", help: "Vacío = ilimitados", section: "Reglas de juego" },
  { name: "max_lineup_players", label: "Jugadores por planilla", type: "number", defaultValue: 18, section: "Reglas de juego" },
  { name: "starters_count", label: "Titulares", type: "number", defaultValue: 11, section: "Reglas de juego" },
  { name: "referees_required", label: "Árbitros requeridos", type: "number", min: 1, max: 3, defaultValue: 3, section: "Reglas de juego", help: "3 = terna completa" },
  { name: "points_win", label: "Puntos por victoria", type: "number", defaultValue: 3, section: "Puntuación" },
  { name: "points_draw", label: "Puntos por empate", type: "number", defaultValue: 1, section: "Puntuación" },
  { name: "points_loss", label: "Puntos por derrota", type: "number", defaultValue: 0, section: "Puntuación" },
  { name: "regulation_file", label: "Reglamento (archivo)", type: "file", accept: DOCUMENT_ACCEPT, section: "Documentación (importar)" },
  { name: "lineup_sheet_file", label: "Planilla de alineación (plantilla)", type: "file", accept: DOCUMENT_ACCEPT, section: "Documentación (importar)" },
  { name: "substitution_card_file", label: "Tarjeta de cambio (plantilla)", type: "file", accept: DOCUMENT_ACCEPT, section: "Documentación (importar)" },
];

export function TournamentsPage() {
  const navigate = useNavigate();
  return (
    <ResourcePage<Tournament> title="Torneos" subtitle="Crea el torneo, inscribe equipos y arma el calendario" icon={<Trophy className="h-6 w-6" />}
      service={tournaments} model="tournaments.tournament" createLabel="Nuevo torneo" fields={TOURNAMENT_FIELDS} formSize="lg"
      onRowClick={(r) => navigate(`/app/torneos/${r.id}`)}
      columns={[
        { key: "name", header: "Torneo", render: (r) => <span className="flex items-center gap-3">
          {r.logo ? <img src={r.logo} alt="" className="h-9 w-9 rounded-lg object-contain" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-400 text-navy-950"><Trophy className="h-4 w-4" /></span>}
          <span><b>{r.name}</b><span className="block text-xs text-slate-500">{r.modality_display}</span></span></span> },
        { key: "cats", header: "Categorías", render: (r) => r.category_names.map((c) => <Badge key={c} tone="gold" className="mr-1">{c}</Badge>) },
        { key: "dates", header: "Fechas", render: (r) => `${formatDate(r.start_date)} — ${formatDate(r.end_date)}` },
        { key: "teams", header: "Equipos", render: (r) => r.team_count },
        { key: "status", header: "Fase", render: (r) => <StatusBadge status={r.status} label={r.status_display} /> },
      ]} />
  );
}
