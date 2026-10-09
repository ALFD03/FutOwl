import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trophy } from "lucide-react";

import { ResourceForm } from "@/components/forms";
import { Badge, Card, KeyValue, Modal, PageHeader, PageLoader, StatusBadge, Tabs } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { tournaments } from "@/services";
import type { Tournament } from "@/types";
import { formatDate } from "@/utils/datetime";

import { MatchdaysList } from "../competition/MatchdaysPage";
import { DocumentsTab } from "./DocumentsTab";
import { FixtureTab } from "./FixtureTab";
import { StandingsTab } from "./StandingsTab";
import { TeamsTab } from "./TeamsTab";
import { TOURNAMENT_FIELDS } from "./TournamentsPage";

type Tab = "summary" | "teams" | "fixture" | "matchdays" | "documents" | "standings";

export function TournamentDetailPage() {
  const id = Number(useParams().id);
  const [tab, setTab] = useState<Tab>("summary");
  const [editing, setEditing] = useState(false);
  const canEdit = useCan("tournaments.change_tournament");
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: t, isLoading } = useQuery({ queryKey: ["tournaments", id], queryFn: () => tournaments.get(id) });
  if (isLoading || !t) return <PageLoader />;

  return (
    <div>
      <Link to="/app/torneos" className="btn-ghost mb-4 -ml-3"><ArrowLeft className="h-4 w-4" /> Torneos</Link>
      <PageHeader title={t.name} subtitle={`${t.modality_display} · ${formatDate(t.start_date)} — ${formatDate(t.end_date)}`}
        icon={t.logo ? <img src={t.logo} alt="" className="h-10 w-10 object-contain" /> : <Trophy className="h-6 w-6" />}
        actions={<>
          <StatusBadge status={t.status} label={t.status_display} />
          {canEdit && <button className="btn-outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Editar</button>}
        </>} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "summary", label: "Resumen" }, { id: "teams", label: "Equipos y grupos" }, { id: "fixture", label: "Partidos" },
        { id: "matchdays", label: "Jornadas" }, { id: "documents", label: "Documentación" }, { id: "standings", label: "Posiciones" },
      ]} />
      {tab === "summary" && <Summary t={t} />}
      {tab === "teams" && <TeamsTab tournament={t} />}
      {tab === "fixture" && <FixtureTab tournament={t} />}
      {tab === "matchdays" && <MatchdaysList tournamentId={t.id} />}
      {tab === "documents" && <DocumentsTab tournament={t} />}
      {tab === "standings" && <StandingsTab tournament={t} />}

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar torneo" size="lg">
        <ResourceForm fields={TOURNAMENT_FIELDS} initial={t as unknown as Record<string, unknown>} onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            await tournaments.update(t.id, values);
            toast.success("Torneo actualizado.");
            setEditing(false);
            await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
          }} />
      </Modal>
    </div>
  );
}

function Summary({ t }: { t: Tournament }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><div className="card-body">
        <h3 className="mb-4 font-bold">Configuración</h3>
        <KeyValue items={[
          { label: "Categorías", value: t.category_names.map((c) => <Badge key={c} tone="gold" className="mr-1">{c}</Badge>) },
          { label: "Canchas", value: t.field_names.join(", ") || "—" },
          { label: "Equipos inscritos", value: t.team_count },
          { label: "Duración", value: `${t.match_duration_minutes} min · ${t.periods} tiempos · ${t.break_minutes} min descanso` },
          { label: "Planilla", value: `${t.max_lineup_players} jugadores · ${t.starters_count} titulares` },
          { label: "Cambios", value: t.max_substitutions ?? "Ilimitados" },
          { label: "Árbitros por partido", value: t.referees_required },
          { label: "Puntos", value: `G ${t.points_win} · E ${t.points_draw} · P ${t.points_loss}` },
        ]} />
      </div></Card>
      <Card><div className="card-body">
        <h3 className="mb-4 font-bold">Flujo del torneo</h3>
        <ol className="space-y-3 text-sm">
          {["Crear el torneo y sus reglas", "Inscribir equipos participantes por categoría", "Establecer grupos y generar partidos",
            "Armar jornadas: día, cancha, horario, delegado y terna arbitral", "Enviar jornada → confirmaciones de oficiales y equipos",
            "Equipos cargan alineaciones antes de la jornada", "Mesa técnica en vivo a cargo del delegado",
            "Informes de delegado y árbitro → cierre por la autoridad"].map((step, i) => (
            <li key={step} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-bold text-gold-400">{i + 1}</span>{step}</li>
          ))}
        </ol>
      </div></Card>
    </div>
  );
}
