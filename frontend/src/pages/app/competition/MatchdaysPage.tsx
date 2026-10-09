import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus } from "lucide-react";

import { ResourceForm, type FieldDef } from "@/components/forms";
import { Can } from "@/components/layout/Guards";
import { Card, CardHeader, DataTable, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { useToast } from "@/hooks";
import { matchdays, tournaments } from "@/services";
import type { Matchday, Tournament } from "@/types";
import { formatDate } from "@/utils/datetime";

export function MatchdaysList({ tournamentId }: { tournamentId?: number }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["matchdays", tournamentId, status],
    queryFn: () => matchdays.all({ tournament: tournamentId, status, ordering: "-date" }),
  });
  const fields: FieldDef[] = [
    ...(tournamentId ? [] : [{ name: "tournament", label: "Torneo", type: "select", required: true, wide: true,
      source: { service: tournaments, label: (t: Tournament) => t.name } } as FieldDef]),
    { name: "number", label: "Número de jornada", type: "number", required: true, min: 1, defaultValue: (data?.length ?? 0) + 1 },
    { name: "date", label: "Día de jornada", type: "date", required: true },
    { name: "name", label: "Nombre (opcional)", type: "text", wide: true, placeholder: "Jornada 1 · Apertura" },
  ];
  return (
    <Card>
      <CardHeader title="Jornadas" subtitle="Borrador → enviada → válida (confirmada) → cerrada" icon={<CalendarDays className="h-5 w-5" />}
        actions={<>
          <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos los estados</option><option value="draft">Borrador</option><option value="submitted">Enviada</option>
            <option value="confirmed">Válida</option><option value="closed">Cerrada</option>
          </select>
          <Can perm="competition.add_matchday"><button className="btn-gold btn-sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Jornada</button></Can>
        </>} />
      <DataTable<Matchday> loading={isLoading} rows={data ?? []} onRowClick={(r) => navigate(`/app/jornadas/${r.id}`)} columns={[
        { key: "n", header: "Jornada", render: (r) => <span><b>{r.name || `Jornada ${r.number}`}</b><span className="block text-xs text-slate-500">N.º {r.number}</span></span> },
        ...(tournamentId ? [] : [{ key: "t", header: "Torneo", render: (r: Matchday) => r.tournament_name }]),
        { key: "d", header: "Día", render: (r) => formatDate(r.date) },
        { key: "m", header: "Partidos", render: (r) => r.match_count },
        { key: "s", header: "Estado", render: (r) => <StatusBadge status={r.status} label={r.status_display} /> },
      ]} />
      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva jornada" subtitle="Queda en borrador hasta completar todos los campos" size="sm">
        <ResourceForm fields={fields} onCancel={() => setCreating(false)} onSubmit={async (v) => {
          const md = await matchdays.create({ ...v, tournament: tournamentId ?? v.tournament });
          toast.success("Jornada creada en borrador.");
          setCreating(false);
          await queryClient.invalidateQueries({ queryKey: ["matchdays"] });
          navigate(`/app/jornadas/${md.id}`);
        }} />
      </Modal>
    </Card>
  );
}

export function MatchdaysPage() {
  return (
    <div>
      <PageHeader title="Jornadas" subtitle="Calendario de partidos con canchas, horarios y oficiales" icon={<CalendarDays className="h-6 w-6" />} />
      <MatchdaysList />
    </div>
  );
}
