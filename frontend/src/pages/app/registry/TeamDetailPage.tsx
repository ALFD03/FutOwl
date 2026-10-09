import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, UserPlus, UserX } from "lucide-react";

import { Can } from "@/components/layout/Guards";
import { ResourceForm, type FieldDef } from "@/components/forms";
import { TeamCrest } from "@/components/match/TeamCrest";
import { Avatar, Badge, Card, CardHeader, DataTable, EmptyState, KeyValue, Modal, PageLoader } from "@/components/ui";
import { useAuth, useToast } from "@/hooks";
import { categories, players, roster, teams } from "@/services";
import type { Category, Player, TeamPlayer } from "@/types";
import { formatDate } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";

import { PLAYER_FIELDS } from "./index";

export function TeamDetailPage() {
  const id = Number(useParams().id);
  const { user, can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<number | null>(null);
  const [adding, setAdding] = useState<"existing" | "new" | null>(null);

  const { data: team, isLoading } = useQuery({ queryKey: ["teams", id], queryFn: () => teams.get(id) });
  const { data: cats = [] } = useQuery({ queryKey: ["categories", "all"], queryFn: () => categories.all({ is_active: true }) });
  const teamCats = cats.filter((c) => team?.categories.includes(c.id));
  const cat = category ?? teamCats[0]?.id ?? null;
  const rosterQuery = useQuery({
    queryKey: ["roster", id, cat],
    queryFn: () => roster.all({ team: id, category: cat!, is_active: true }),
    enabled: Boolean(cat),
  });

  const isManager = Boolean(user?.profiles.team_ids.includes(id));
  const canManage = can("registry.change_team") || (isManager && can("registry.add_teamplayer"));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["roster"] });

  if (isLoading || !team) return <PageLoader />;
  const selectedCat = teamCats.find((c) => c.id === cat);

  const addFields: FieldDef[] = [
    { name: "player", label: "Jugador sin equipo en esta categoría", type: "select", required: true, wide: true,
      source: { service: players, params: { unassigned: true }, label: (p: Player) => `${p.full_name} · ${p.age} años · nac. ${p.birth_date.slice(0, 4)}` } },
    { name: "shirt_number", label: "Dorsal", type: "number", min: 0, max: 99 },
  ];

  const enroll = async (playerId: number, shirt: unknown) => {
    await roster.create({ team: id, category: cat, player: playerId, shirt_number: shirt });
    toast.success("Jugador inscrito en la nómina.");
    setAdding(null);
    await refresh();
  };

  return (
    <div>
      <Link to="/app/equipos" className="btn-ghost mb-4 -ml-3"><ArrowLeft className="h-4 w-4" /> Equipos</Link>
      <div className="mb-6 flex flex-col gap-6 lg:flex-row">
        <Card className="flex-1">
          <div className="flex items-center gap-5 p-6">
            <TeamCrest src={team.logo} name={team.name} size="xl" />
            <div>
              <h1 className="text-2xl font-bold">{team.name}</h1>
              <p className="text-sm text-slate-500">RIF {team.vat_display} · {team.full_address}</p>
              <div className="mt-2 flex flex-wrap gap-1">{team.category_names.map((c) => <Badge key={c} tone="gold">{c}</Badge>)}</div>
            </div>
          </div>
        </Card>
        <Card className="lg:w-96">
          <div className="card-body">
            <KeyValue items={[
              { label: "Cancha", value: team.home_field_name ?? "—" },
              { label: "Entrenadores", value: team.coach_names.join(", ") || "—" },
              { label: "Jugadores en nómina", value: team.roster_count },
              { label: "Estado", value: team.is_active ? "Activo" : "Inactivo" },
            ]} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Nómina de jugadores" subtitle={selectedCat ? `${selectedCat.name} · nacidos desde ${selectedCat.birth_year_limit}` : "Seleccione una categoría"}
          actions={
            <>
              <select className="input w-40" value={cat ?? ""} onChange={(e) => setCategory(Number(e.target.value))}>
                {teamCats.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {canManage && cat && (
                <>
                  <button className="btn-outline btn-sm" onClick={() => setAdding("existing")}><Plus className="h-4 w-4" /> Inscribir</button>
                  <Can perm="registry.add_player"><button className="btn-gold btn-sm" onClick={() => setAdding("new")}><UserPlus className="h-4 w-4" /> Nuevo jugador</button></Can>
                </>
              )}
            </>
          } />
        {!teamCats.length ? <EmptyState title="El equipo no tiene categorías" /> : (
          <DataTable<TeamPlayer> loading={rosterQuery.isLoading} rows={rosterQuery.data ?? []} columns={[
            { key: "n", header: "Dorsal", render: (r) => <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 font-display font-bold text-gold-400">{r.shirt_number ?? "–"}</span> },
            { key: "p", header: "Jugador", render: (r) => <span className="flex items-center gap-3"><Avatar src={r.player_detail.photo} name={r.player_detail.full_name} size="sm" /><span><b>{r.player_detail.full_name}</b><span className="block text-xs text-slate-500">{r.player_detail.vat_display || "Partida de nacimiento"}</span></span></span> },
            { key: "age", header: "Edad", render: (r) => `${r.player_detail.age} años (${formatDate(r.player_detail.birth_date)})` },
            { key: "g", header: "Representante", render: (r) => r.player_detail.guardian_detail ? `${r.player_detail.guardian_detail.first_name} ${r.player_detail.guardian_detail.last_name}` : "—" },
            { key: "a", header: "", className: "text-right", render: (r) => canManage && (
              <button className="btn-ghost btn-sm text-crimson-600" title="Dar de baja de la nómina" onClick={async () => {
                try { await roster.deactivate(r.id); toast.success("Jugador dado de baja (registro conservado)."); await refresh(); }
                catch (e) { toast.error(errorMessage(e)); }
              }}><UserX className="h-4 w-4" /></button>
            ) },
          ]} />
        )}
      </Card>

      <Modal open={adding === "existing"} onClose={() => setAdding(null)} title="Inscribir jugador existente" size="sm">
        <ResourceForm fields={addFields} onSubmit={(v) => enroll(v.player as number, v.shirt_number)} onCancel={() => setAdding(null)} submitLabel="Inscribir" />
      </Modal>
      <Modal open={adding === "new"} onClose={() => setAdding(null)} title="Nuevo jugador e inscripción" subtitle={selectedCat?.name} size="lg">
        <ResourceForm fields={[...PLAYER_FIELDS, { name: "shirt_number", label: "Dorsal", type: "number", min: 0, max: 99, section: "Nómina" }]}
          onCancel={() => setAdding(null)} submitLabel="Crear e inscribir"
          onSubmit={async (v) => {
            const { shirt_number, ...data } = v;
            const player = await players.create(data);
            await enroll(player.id, shirt_number);
          }} />
      </Modal>
    </div>
  );
}
