import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { ResourceForm, type FieldDef } from "@/components/forms";
import { Can } from "@/components/layout/Guards";
import { TeamCrest } from "@/components/match/TeamCrest";
import { Badge, Card, CardHeader, DataTable, Modal, SelectMenu } from "@/components/ui";
import { useToast } from "@/hooks";
import { groups, registrations, teams } from "@/services";
import type { Group, Registration, Team, Tournament } from "@/types";
import { errorMessage } from "@/utils/errors";

export function TeamsTab({ tournament }: { tournament: Tournament }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<"team" | "group" | null>(null);
  const regs = useQuery({ queryKey: ["registrations", tournament.id], queryFn: () => registrations.all({ tournament: tournament.id, is_active: true }) });
  const grps = useQuery({ queryKey: ["groups", tournament.id], queryFn: () => groups.all({ tournament: tournament.id, is_active: true }) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["registrations"] });
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
    void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
  };

  const teamFields: FieldDef[] = [
    { name: "category", label: "Categoría", type: "select", required: true, options: tournament.categories.map((id, i) => ({ value: id, label: tournament.category_names[i] })) },
    { name: "team", label: "Equipo", type: "select", required: true, source: { service: teams, label: (t: Team) => `${t.name} (${t.category_names.join(", ")})` } },
    { name: "group", label: "Grupo (opcional)", type: "select", options: (grps.data ?? []).map((g) => ({ value: g.id, label: `${g.name} · ${g.category_name}` })) },
  ];

  const changeGroup = async (reg: Registration, group: string) => {
    try {
      await registrations.update(reg.id, { group: group ? Number(group) : null });
      toast.success("Grupo asignado.");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader title="Equipos inscritos" subtitle={`${regs.data?.length ?? 0} inscripciones`}
          actions={<Can perm="tournaments.add_tournamentteam"><button className="btn-gold btn-sm" onClick={() => setModal("team")}><Plus className="h-4 w-4" /> Inscribir equipo</button></Can>} />
        <DataTable<Registration> loading={regs.isLoading} rows={regs.data ?? []} columns={[
          { key: "team", header: "Equipo", render: (r) => <span className="flex items-center gap-2"><TeamCrest src={r.team_logo} name={r.team_name} size="sm" /><b>{r.team_name}</b></span> },
          { key: "cat", header: "Categoría", render: (r) => <Badge tone="gold">{r.category_name}</Badge> },
          { key: "roster", header: "Nómina", render: (r) => <Link to={`/app/equipos/${r.team}`} className="text-sm font-semibold text-navy-700 hover:underline dark:text-gold-400">{r.roster_count} jugadores</Link> },
          { key: "group", header: "Grupo", render: (r) => (
            <div className="w-40"><SelectMenu value={r.group ?? null} clearable placeholder="Sin grupo" className="py-1" onChange={(v) => changeGroup(r, v == null ? "" : String(v))}
              options={(grps.data ?? []).filter((g) => g.category === r.category).map((g) => ({ value: g.id, label: g.name }))} /></div>
          ) },
        ]} />
      </Card>
      <Card className="h-fit">
        <CardHeader title="Grupos" actions={<Can perm="tournaments.add_group"><button className="btn-outline btn-sm" onClick={() => setModal("group")}><Plus className="h-4 w-4" /> Grupo</button></Can>} />
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {(grps.data ?? []).map((g: Group) => (
            <li key={g.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span><b>{g.name}</b><span className="block text-xs text-slate-500">{g.category_name}</span></span>
              <Badge tone="navy">{g.team_ids.length} equipos</Badge>
            </li>
          ))}
          {grps.data?.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">Sin grupos (liga única)</li>}
        </ul>
      </Card>

      <Modal open={modal === "team"} onClose={() => setModal(null)} title="Inscribir equipo" size="sm">
        <ResourceForm fields={teamFields} onCancel={() => setModal(null)} submitLabel="Inscribir" onSubmit={async (v) => {
          await registrations.create({ ...v, tournament: tournament.id });
          toast.success("Equipo inscrito.");
          setModal(null);
          refresh();
        }} />
      </Modal>
      <Modal open={modal === "group"} onClose={() => setModal(null)} title="Nuevo grupo" size="sm">
        <ResourceForm fields={[
          { name: "name", label: "Nombre", type: "text", required: true, placeholder: "Grupo A" },
          { name: "category", label: "Categoría", type: "select", required: true, options: tournament.categories.map((id, i) => ({ value: id, label: tournament.category_names[i] })) },
        ]} onCancel={() => setModal(null)} onSubmit={async (v) => {
          await groups.create({ ...v, tournament: tournament.id });
          toast.success("Grupo creado.");
          setModal(null);
          refresh();
        }} />
      </Modal>
    </div>
  );
}
