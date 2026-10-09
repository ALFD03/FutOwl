import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, Plus, Save, UserMinus, UserPlus, UserX } from "lucide-react";

import { accountField, ResourceForm, type FieldDef, type Values } from "@/components/forms";
import { TeamCrest } from "@/components/match/TeamCrest";
import {
  Alert, Avatar, Badge, Card, CardHeader, DataTable, EmptyState, KeyValue, Modal, MultiSelectMenu, PageLoader, SelectMenu,
  Spinner, StatusBadge, Tabs,
} from "@/components/ui";
import { useAuth, useToast } from "@/hooks";
import { categories, coaches, players, registrations, roster, teams } from "@/services";
import type { Coach, Player, Registration, Team, TeamPlayer } from "@/types";
import { formatDate } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";

import { PLAYER_FIELDS } from "./index";
import { PlayerProfile } from "./PlayerProfile";

type Tab = "roster" | "players" | "coaches" | "categories" | "access";

const playerCell = (p: { photo: string | null; full_name: string; vat_display: string }) => (
  <span className="flex items-center gap-3">
    <Avatar src={p.photo} name={p.full_name} size="sm" />
    <span><b>{p.full_name}</b><span className="block text-xs text-slate-500">{p.vat_display || "Partida de nacimiento"}</span></span>
  </span>
);

export function TeamDetailPage() {
  const id = Number(useParams().id);
  const { user, can } = useAuth();
  const [tab, setTab] = useState<Tab>("roster");
  const { data: team, isLoading } = useQuery({ queryKey: ["teams", id], queryFn: () => teams.get(id) });

  const isAdmin = can("registry.change_team");
  const isStaff = isAdmin || Boolean(user?.profiles.team_ids.includes(id));

  if (isLoading || !team) return <PageLoader />;

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
              { label: "Cuerpo técnico", value: team.coach_names.join(", ") || "—" },
              { label: "Jugadores actuales", value: team.player_count },
              { label: "Acceso", value: team.manager_usernames.map((u) => `@${u}`).join(", ") || "—" },
              { label: "Estado", value: team.is_active ? "Activo" : "Inactivo" },
            ]} />
          </div>
        </Card>
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "roster", label: "Nómina por torneo" },
        { id: "players", label: "Jugadores" },
        { id: "coaches", label: "Cuerpo técnico" },
        { id: "categories", label: "Categorías" },
        { id: "access", label: "Acceso", hidden: !isAdmin },
      ]} />

      {tab === "roster" && <RosterTab team={team} canManage={isStaff && can("tournaments.add_teamplayer")} />}
      {tab === "players" && <PlayersTab team={team} canCreate={isStaff && can("registry.add_player")} />}
      {tab === "coaches" && <CoachesTab team={team} canManage={isStaff && can("registry.change_coach")} />}
      {tab === "categories" && <CategoriesTab team={team} canManage={isAdmin} />}
      {tab === "access" && <AccessTab team={team} />}
    </div>
  );
}

// ------------------------------------------------------------------ Nómina por torneo
function RosterTab({ team, canManage }: { team: Team; canManage: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [adding, setAdding] = useState<"existing" | "new" | null>(null);

  const regsQ = useQuery({ queryKey: ["registrations", "team", team.id], queryFn: () => registrations.all({ team: team.id, is_active: true }) });
  const regs = regsQ.data ?? [];
  const registration: Registration | undefined = regs.find((r) => r.id === selected) ?? regs[0];
  const rosterQ = useQuery({
    queryKey: ["roster", registration?.id], queryFn: () => roster.all({ registration: registration!.id, is_active: true }), enabled: Boolean(registration),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["roster"] });

  const enroll = async (playerId: number, shirt: unknown) => {
    await roster.create({ registration: registration!.id, player: playerId, shirt_number: shirt });
    toast.success("Jugador inscrito en la nómina del torneo.");
    setAdding(null);
    await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["players"] })]);
  };

  if (regsQ.isLoading) return <PageLoader />;
  if (!regs.length) {
    return <Card><EmptyState title="Sin torneos" message="El equipo aún no está inscrito en ningún torneo. La inscripción se hace desde el torneo; luego aquí se carga su nómina." /></Card>;
  }

  const enrollFields: FieldDef[] = [
    { name: "player", label: "Jugador", type: "remote", required: true, wide: true,
      help: `Solo aparecen jugadores nacidos desde el año tope de ${registration?.category_name} y libres en este torneo.`,
      remote: { service: players, params: { available_for: registration?.id },
        label: (p: Player) => p.full_name,
        hint: (p: Player) => [p.vat_display || "Partida de nacimiento", `${p.age} años`, p.current_team_name ? `Equipo actual: ${p.current_team_name}` : "Sin equipo"].join(" · ") } },
    { name: "shirt_number", label: "Dorsal", type: "number", min: 0, max: 99 },
  ];

  return (
    <Card>
      <CardHeader title="Nómina del torneo" subtitle="Un jugador solo puede estar en un equipo por torneo; en otros torneos puede jugar con otro equipo."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-72">
              <SelectMenu value={registration?.id ?? null} onChange={(v) => setSelected(Number(v))} searchable={regs.length > 6}
                options={regs.map((r) => ({ value: r.id, label: `${r.tournament_name} · ${r.category_name}`, hint: r.group_name ?? undefined }))} />
            </div>
            {canManage && (
              <>
                <button className="btn-outline btn-sm" onClick={() => setAdding("existing")}><Plus className="h-4 w-4" /> Inscribir jugador</button>
                <button className="btn-gold btn-sm" onClick={() => setAdding("new")}><UserPlus className="h-4 w-4" /> Nuevo jugador</button>
              </>
            )}
          </div>
        } />
      <DataTable<TeamPlayer> loading={rosterQ.isLoading} rows={rosterQ.data ?? []} empty="Nadie inscrito todavía en la nómina de este torneo." columns={[
        { key: "n", header: "Dorsal", render: (r) => <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 font-display font-bold text-gold-400">{r.shirt_number ?? "–"}</span> },
        { key: "p", header: "Jugador", render: (r) => playerCell(r.player_detail) },
        { key: "age", header: "Edad", render: (r) => `${r.player_detail.age} años (${formatDate(r.player_detail.birth_date)})` },
        { key: "g", header: "Representante", render: (r) => r.player_detail.guardian_name ?? "—" },
        { key: "a", header: "", className: "text-right", render: (r) => canManage && (
          <button className="btn-ghost btn-sm text-crimson-600" title="Dar de baja de la nómina" onClick={async () => {
            try { await roster.deactivate(r.id); toast.success("Jugador dado de baja de la nómina (registro conservado)."); await refresh(); }
            catch (e) { toast.error(errorMessage(e)); }
          }}><UserX className="h-4 w-4" /></button>
        ) },
      ]} />

      <Modal open={adding === "existing"} onClose={() => setAdding(null)} title="Inscribir jugador registrado" size="sm"
        subtitle={registration && `${registration.tournament_name} · ${registration.category_name}`}>
        <ResourceForm fields={enrollFields} onSubmit={(v) => enroll(v.player as number, v.shirt_number)} onCancel={() => setAdding(null)} submitLabel="Inscribir" />
      </Modal>
      <Modal open={adding === "new"} onClose={() => setAdding(null)} title="Nuevo jugador e inscripción" size="lg"
        subtitle={registration && `${registration.tournament_name} · ${registration.category_name}`}>
        <ResourceForm fields={[...PLAYER_FIELDS, { name: "shirt_number", label: "Dorsal", type: "number", min: 0, max: 99, section: "Nómina" }]}
          onCancel={() => setAdding(null)} submitLabel="Crear e inscribir"
          onSubmit={async (v) => {
            const { shirt_number, ...data } = v;
            const player = await players.create({ ...data, current_team: team.id });
            await enroll(player.id, shirt_number);
          }} />
      </Modal>
    </Card>
  );
}

// ------------------------------------------------------------------ Jugadores (actuales e históricos)
function PlayersTab({ team, canCreate }: { team: Team; canCreate: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ["players", "team", team.id], queryFn: () => players.all({ team: team.id }) });
  const current = data.filter((p) => p.current_team === team.id);
  const former = data.filter((p) => p.current_team !== team.id);

  const columns = [
    { key: "p", header: "Jugador", render: (r: Player) => playerCell(r) },
    { key: "age", header: "Edad", render: (r: Player) => `${r.age} años` },
    { key: "t", header: "Torneos con el equipo", render: (r: Player) => r.history.filter((h) => h.team === team.id).map((h) => <Badge key={h.id} className="mr-1">{h.tournament_name}</Badge>) },
    { key: "s", header: "G · PJ", render: (r: Player) => <span className="font-mono text-xs"><b className="text-gold-600 dark:text-gold-400">{r.stats.goals}</b> · {r.stats.matches}</span> },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Plantel actual" subtitle="Jugadores cuyo equipo actual es este: el equipo puede actualizar su ficha (fotos, documento…)."
          actions={canCreate && <button className="btn-gold btn-sm" onClick={() => setCreating(true)}><UserPlus className="h-4 w-4" /> Nuevo jugador</button>} />
        <DataTable<Player> loading={isLoading} rows={current} onRowClick={(r) => setProfile(r.id)} empty="Sin jugadores actuales." columns={columns} />
      </Card>
      <Card>
        <CardHeader title="Han jugado con el equipo" subtitle="Registro histórico: jugadores que estuvieron en la nómina de algún torneo y hoy están en otro equipo o libres." />
        <DataTable<Player> loading={isLoading} rows={former} onRowClick={(r) => setProfile(r.id)} empty="Sin registros históricos." columns={[
          ...columns.slice(0, 1),
          { key: "now", header: "Equipo actual", render: (r: Player) => r.current_team_name ? <Badge tone="navy">{r.current_team_name}</Badge> : <span className="text-slate-400">Libre</span> },
          ...columns.slice(2),
        ]} />
      </Card>
      <PlayerProfile playerId={profile} onClose={() => setProfile(null)} />
      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo jugador" subtitle={`Queda con ${team.name} como equipo actual`} size="lg">
        <ResourceForm fields={PLAYER_FIELDS} onCancel={() => setCreating(false)} submitLabel="Crear jugador"
          onSubmit={async (v) => {
            await players.create({ ...v, current_team: team.id });
            toast.success("Jugador creado.");
            setCreating(false);
            await queryClient.invalidateQueries({ queryKey: ["players"] });
          }} />
      </Modal>
    </div>
  );
}

// ------------------------------------------------------------------ Cuerpo técnico
function CoachesTab({ team, canManage }: { team: Team; canManage: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ["coaches", "team", team.id], queryFn: () => coaches.all({ team: team.id, is_active: true }) });

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["coaches"] }), queryClient.invalidateQueries({ queryKey: ["teams", team.id] }),
  ]);
  const setTeam = async (coach: number, teamId: number | null, message: string) => {
    setBusy(true);
    try { await coaches.update(coach, { team: teamId }); toast.success(message); setPick(null); await refresh(); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const loadFree = async (query: string) => (await coaches.list({ free: true, is_active: true, search: query })).results
    .map((c: Coach) => ({ value: c.id, label: c.full_name, hint: `${c.vat_display} · Licencia ${c.license_number}` }));

  return (
    <Card>
      <CardHeader title="Cuerpo técnico" subtitle="Un entrenador solo puede estar en un equipo a la vez. Si tiene usuario, ayuda al gestor a cargar la plantilla." />
      {canManage && (
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row dark:border-white/5">
          <div className="flex-1">
            <SelectMenu value={pick} onChange={(v) => setPick(v as number | null)} load={loadFree} placeholder="Buscar entrenador libre por nombre o cédula…" searchPlaceholder="Nombre o cédula…" />
          </div>
          <button className="btn-primary" disabled={!pick || busy} onClick={() => setTeam(pick!, team.id, "Entrenador asignado al equipo.")}>
            {busy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Asignar
          </button>
        </div>
      )}
      <DataTable<Coach> loading={isLoading} rows={data} empty="El equipo no tiene entrenadores asignados." columns={[
        { key: "n", header: "Entrenador", render: (c) => playerCell(c) },
        { key: "l", header: "Licencia", render: (c) => <span>{c.license_number} <StatusBadge status={c.license_valid ? "confirmed" : "rejected"} label={c.license_valid ? `Vigente ${c.license_expiry_year}` : `Vencida ${c.license_expiry_year}`} /></span> },
        { key: "u", header: "Usuario", render: (c) => c.username ? <Badge tone="navy">@{c.username}</Badge> : <span className="text-slate-400">Sin acceso</span> },
        { key: "a", header: "", className: "text-right", render: (c) => canManage && (
          <button className="btn-ghost btn-sm text-crimson-600" title="Quitar del equipo (queda libre)" onClick={() => setTeam(c.id, null, "Entrenador liberado.")}>
            <UserMinus className="h-4 w-4" />
          </button>
        ) },
      ]} />
    </Card>
  );
}

// ------------------------------------------------------------------ Categorías
function CategoriesTab({ team, canManage }: { team: Team; canManage: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState<(string | number)[]>(team.categories);
  const [busy, setBusy] = useState(false);
  const { data: cats = [] } = useQuery({ queryKey: ["categories", "all"], queryFn: () => categories.all({ is_active: true }) });
  const dirty = [...value].sort().join() !== [...team.categories].sort().join();

  const save = async () => {
    setBusy(true);
    try {
      await teams.update(team.id, { categories: value });
      toast.success("Categorías actualizadas.");
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title="Categorías del equipo" subtitle="El equipo solo puede inscribirse en torneos con estas categorías." />
      <div className="card-body space-y-4">
        <MultiSelectMenu value={value} onChange={setValue} disabled={!canManage} placeholder="Seleccione categorías…"
          options={cats.map((c) => ({ value: c.id, label: c.name, hint: `Tope ${c.max_age} años · nacidos desde ${c.birth_year_limit}` }))} />
        {canManage && (
          <div className="flex justify-end">
            <button className="btn-primary" disabled={!dirty || busy} onClick={save}>{busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} Guardar categorías</button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ Acceso (usuarios del equipo)
function AccessTab({ team }: { team: Team }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["teams"] });

  const remove = async (userId: number) => {
    try {
      await teams.update(team.id, { managers: team.managers.filter((m) => m !== userId) });
      toast.success("Usuario quitado del equipo (la cuenta sigue existiendo).");
      await refresh();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <Card>
      <CardHeader title="Usuarios de acceso" subtitle="Gestores que cargan nómina, alineaciones y confirman asistencia."
        actions={<button className="btn-gold btn-sm" onClick={() => setAdding(true)}><KeyRound className="h-4 w-4" /> Agregar usuario</button>} />
      <div className="card-body">
        {!team.managers.length ? <Alert tone="warning">El equipo no tiene usuarios de acceso.</Alert> : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {team.manager_details.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3">
                <span className="flex items-center gap-3"><Avatar name={m.full_name || m.username} size="sm" />
                  <span><b>@{m.username}</b>{m.full_name && <span className="block text-xs text-slate-500">{m.full_name}</span>}</span></span>
                <button className="btn-ghost btn-sm text-crimson-600" onClick={() => remove(m.id)} title="Quitar acceso"><UserMinus className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Modal open={adding} onClose={() => setAdding(false)} title="Agregar usuario de acceso" subtitle={team.name} size="md">
        <ResourceForm fields={[accountField({ roleLabel: "Gestor de equipo", required: true, section: "" })]} onCancel={() => setAdding(false)} submitLabel="Agregar"
          onSubmit={async (v: Values) => {
            await teams.update(team.id, v);
            toast.success("Usuario agregado al equipo.");
            setAdding(false);
            await refresh();
          }} />
      </Modal>
    </Card>
  );
}
