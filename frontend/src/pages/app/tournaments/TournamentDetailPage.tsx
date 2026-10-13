import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2, Trophy } from "lucide-react";

import { ResourceForm } from "@/components/forms";
import { Badge, Card, ConfirmDialog, KeyValue, Modal, PageHeader, PageLoader, StatusBadge, Tabs } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { tournaments } from "@/services";
import type { Tournament } from "@/types";
import { formatDate } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";

import { MatchdaysList } from "../competition/MatchdaysPage";
import { DocumentsTab } from "./DocumentsTab";
import { FixtureTab } from "./FixtureTab";
import { GroupsTab, usesGroups } from "./GroupsTab";
import { KnockoutTab, usesKnockout } from "./KnockoutTab";
import { RulesTab } from "./RulesTab";
import { StandingsTab } from "./StandingsTab";
import { TeamsTab } from "./TeamsTab";
import { TOURNAMENT_FIELDS } from "./TournamentsPage";

type Tab = "summary" | "rules" | "teams" | "groups" | "knockout" | "fixture" | "matchdays" | "documents" | "standings";

export function TournamentDetailPage() {
  const id = Number(useParams().id);
  const [tab, setTab] = useState<Tab>("summary");
  const [editing, setEditing] = useState(false);
  // Salir de borrador o eliminar el torneo siempre pide confirmación.
  const [publishing, setPublishing] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const canEdit = useCan("tournaments.change_tournament");
  const canDelete = useCan("tournaments.delete_tournament");
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: t, isLoading } = useQuery({ queryKey: ["tournaments", id], queryFn: () => tournaments.get(id) });
  if (isLoading || !t) return <PageLoader />;

  const save = async (values: Record<string, unknown>) => {
    await tournaments.update(t.id, values);
    toast.success("Torneo actualizado.");
    setEditing(false);
    setPublishing(null);
    await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
  };

  return (
    <div>
      <Link to="/app/torneos" className="btn-ghost mb-4 -ml-3"><ArrowLeft className="h-4 w-4" /> Torneos</Link>
      <PageHeader title={t.name} subtitle={`${t.modality_display} · ${formatDate(t.start_date)} — ${formatDate(t.end_date)}`}
        icon={t.logo ? <img src={t.logo} alt="" className="h-10 w-10 object-contain" /> : <Trophy className="h-6 w-6" />}
        actions={<>
          <StatusBadge status={t.status} label={t.status_display} />
          {canEdit && <button className="btn-outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Editar</button>}
          {canDelete && t.status === "draft" && <button className="btn-ghost text-crimson-600" title="Eliminar torneo (borrador)" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4" /></button>}
        </>} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "summary", label: "Resumen" }, { id: "rules", label: "Reglas de juego" }, { id: "teams", label: "Equipos" }, { id: "groups", label: "Grupos", hidden: !usesGroups(t) }, { id: "knockout", label: "Eliminación directa", hidden: !usesKnockout(t) }, { id: "fixture", label: "Partidos" },
        { id: "matchdays", label: "Jornadas" }, { id: "documents", label: "Documentación" }, { id: "standings", label: "Posiciones" },
      ]} />
      {tab === "summary" && <Summary t={t} />}
      {tab === "rules" && <RulesTab tournament={t} />}
      {tab === "teams" && <TeamsTab tournament={t} />}
      {tab === "groups" && usesGroups(t) && <GroupsTab tournament={t} />}
      {tab === "knockout" && usesKnockout(t) && <KnockoutTab tournament={t} />}
      {tab === "fixture" && <FixtureTab tournament={t} />}
      {tab === "matchdays" && <MatchdaysList tournamentId={t.id} />}
      {tab === "documents" && <DocumentsTab tournament={t} />}
      {tab === "standings" && <StandingsTab tournament={t} />}

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar torneo" size="lg">
        <ResourceForm fields={TOURNAMENT_FIELDS} initial={t as unknown as Record<string, unknown>} onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            if (t.status === "draft" && values.status !== "draft") { setPublishing(values); return; }
            await save(values);
          }} />
      </Modal>
      <ConfirmDialog open={publishing !== null} onClose={() => setPublishing(null)} onConfirm={async () => {
          if (!publishing) return;
          try { await save(publishing); } catch (e) { toast.error(errorMessage(e)); throw e; }
        }}
        title="Sacar el torneo de borrador" confirmLabel="Sí, cambiar estado"
        message="El torneo dejará de ser un borrador: será visible en el sitio público y ya no podrá eliminarse. ¿Continuar?" />
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} danger confirmLabel="Eliminar definitivamente"
        title="Eliminar torneo" onConfirm={async () => {
          try {
            await tournaments.remove(t.id);
            toast.success("Torneo eliminado.");
            await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
            navigate("/app/torneos");
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
        message={`Se borrará «${t.name}» con sus inscripciones, nóminas, grupos, jornadas y partidos en borrador. No se puede deshacer.`} />
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
          { label: "Reglas de juego", value: "Las de cada categoría (ajustables en la pestaña Reglas de juego)" },
          { label: "Puntos", value: `G ${t.points_win} · E ${t.points_draw} · P ${t.points_loss}` },
        ]} />
      </div></Card>
      <Card><div className="card-body">
        <h3 className="mb-4 font-bold">Flujo del torneo</h3>
        <ol className="space-y-3 text-sm">
          {["Crear el torneo y definir sus reglas de juego por categoría", "Inscribir equipos participantes por categoría", "Establecer grupos y generar partidos",
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
