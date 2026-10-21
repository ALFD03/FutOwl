import { useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, KeyRound, ListChecks, Pencil, Plus, RotateCcw, Save, Trophy, UserMinus, UserPlus, UserX, X } from "lucide-react";

import { accountField, ResourceForm, type FieldDef, type Values } from "@/components/forms";
import { Can } from "@/components/layout/Guards";
import { TeamCrest } from "@/components/match/TeamCrest";
import {
  Alert, Avatar, Badge, Card, CardHeader, ConfirmDialog, DataTable, EmptyState, KeyValue, Modal, MultiSelectMenu, normalize, PageLoader,
  SearchInput, SelectMenu, Spinner, StatusBadge, Tabs,
} from "@/components/ui";
import { useAuth, useToast } from "@/hooks";
import { categories, coaches, players, registrations, roster, teams } from "@/services";
import type { Category, Coach, Player, Registration, RosterCandidate, Team, TeamPlayer } from "@/types";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";

import { COACH_FIELDS, PLAYER_FIELDS } from "./index";
import { PlayerProfile } from "./PlayerProfile";

type Tab = "roster" | "players" | "coaches" | "categories" | "access";

const playerCell = (p: { photo: string | null; full_name: string; vat_display: string }) => (
  <span className="flex items-center gap-3">
    <Avatar src={p.photo} name={p.full_name} size="sm" />
    <span><b>{p.full_name}</b><span className="block text-xs text-slate-500">{p.vat_display || "Partida de nacimiento"}</span></span>
  </span>
);

/** Edita la ficha completa de un jugador (la carga al abrir: las tablas solo traen un resumen). */
function EditPlayerModal({ playerId, onClose }: { playerId: number | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["players", playerId], queryFn: () => players.get(playerId!), enabled: playerId !== null });
  return (
    <Modal open={playerId !== null} onClose={onClose} title="Editar jugador" subtitle={data?.full_name} size="lg">
      {isLoading || !data ? <div className="grid place-items-center py-10"><Spinner /></div> : (
        <ResourceForm key={data.id} fields={PLAYER_FIELDS} initial={data as unknown as Values} onCancel={onClose}
          onSubmit={async (v) => {
            await players.update(data.id, v);
            toast.success("Jugador actualizado.");
            onClose();
            await Promise.all([queryClient.invalidateQueries({ queryKey: ["players"] }), queryClient.invalidateQueries({ queryKey: ["roster"] })]);
          }} />
      )}
    </Modal>
  );
}

const editButton = (title: string, onClick: () => void) => (
  <button className="btn-ghost btn-sm" title={title} aria-label={title} onClick={(e) => { e.stopPropagation(); onClick(); }}>
    <Pencil className="h-4 w-4" />
  </button>
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

      {tab === "roster" && <RosterTab team={team} canManage={isStaff && can("tournaments.add_teamplayer")} canEditPlayers={isStaff && can("registry.change_player")} />}
      {tab === "players" && <PlayersTab team={team} canCreate={isStaff && can("registry.add_player")} canEdit={isStaff && can("registry.change_player")} canEditFormer={isAdmin && can("registry.change_player")} />}
      {tab === "coaches" && <CoachesTab team={team} canManage={isStaff && can("registry.change_coach")} canCreate={isStaff && can("registry.add_coach")} />}
      {tab === "categories" && <CategoriesTab team={team} canManage={isAdmin} />}
      {tab === "access" && <AccessTab team={team} />}
    </div>
  );
}

// ------------------------------------------------------------------ Nómina por torneo
const TOURNAMENT_STATUS: Record<Registration["tournament_status"], string> = {
  draft: "Borrador", registration: "Inscripciones abiertas", in_progress: "En curso", finished: "Finalizado",
};
const STATUS_ORDER: Registration["tournament_status"][] = ["in_progress", "registration", "draft", "finished"];

/**
 * Torneos donde está inscrito el equipo, con sus categorías. Al abrir uno, cada categoría inscrita es una
 * página con su nómina. La inscripción abierta va en la URL (?inscripcion=id) para enlazarla y volver atrás.
 */
function RosterTab({ team, canManage, canEditPlayers }: { team: Team; canManage: boolean; canEditPlayers: boolean }) {
  const [params, setParams] = useSearchParams();
  const regsQ = useQuery({ queryKey: ["registrations", "team", team.id], queryFn: () => registrations.all({ team: team.id, is_active: true }) });
  const regs = regsQ.data ?? [];
  const open = (id: number | null) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (id == null) next.delete("inscripcion"); else next.set("inscripcion", String(id));
    return next;
  });

  if (regsQ.isLoading) return <PageLoader />;
  if (!regs.length) {
    return <Card><EmptyState title="Sin torneos" message="El equipo aún no está inscrito en ningún torneo. La inscripción se hace desde el torneo; luego aquí se carga su nómina." /></Card>;
  }

  const selected = regs.find((r) => r.id === Number(params.get("inscripcion")));
  const byTournament = new Map<number, Registration[]>();
  regs.forEach((r) => byTournament.set(r.tournament, [...(byTournament.get(r.tournament) ?? []), r]));
  const tournaments = [...byTournament.values()]
    .map((items) => items.sort((a, b) => a.category_name.localeCompare(b.category_name, "es", { numeric: true })))
    .sort((a, b) => STATUS_ORDER.indexOf(a[0].tournament_status) - STATUS_ORDER.indexOf(b[0].tournament_status)
      || a[0].tournament_name.localeCompare(b[0].tournament_name, "es"));

  if (selected) {
    const categoriesOf = tournaments.find((items) => items[0].tournament === selected.tournament) ?? [selected];
    const editable = selected.tournament_status !== "finished";
    return (
      <div>
        <button className="btn-ghost mb-3 -ml-3" onClick={() => open(null)}><ArrowLeft className="h-4 w-4" /> Todos los torneos</button>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold">{selected.tournament_name}</h2>
          <StatusBadge status={selected.tournament_status} label={TOURNAMENT_STATUS[selected.tournament_status]} />
          <Can perm="tournaments.view_tournament">
            <Link to={`/app/torneos/${selected.tournament}`} className="text-sm font-semibold text-navy-700 hover:underline dark:text-gold-400">Ver torneo</Link>
          </Can>
        </div>
        <Tabs<string> value={String(selected.id)} onChange={(id) => open(Number(id))}
          tabs={categoriesOf.map((r) => ({ id: String(r.id), label: <>{r.category_name} <span className="ml-1 opacity-70">({r.roster_count})</span></> }))} />
        <CategoryRoster key={selected.id} team={team} registration={selected} canManage={canManage && editable} canEditPlayers={canEditPlayers} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader title="Torneos inscritos" subtitle="Abra un torneo para cargar la nómina de cada categoría. Un jugador solo puede estar en un equipo por torneo; en otros torneos puede jugar con otro equipo." />
      <ul className="divide-y divide-slate-100 dark:divide-white/5">
        {tournaments.map((items) => {
          const first = items[0];
          const players = items.reduce((n, r) => n + r.roster_count, 0);
          const empty = items.filter((r) => !r.roster_count).length;
          return (
            <li key={first.tournament} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 lg:flex-row lg:items-center dark:hover:bg-white/[.03]">
              <button className="min-w-0 flex-1 text-left" onClick={() => open(first.id)}>
                <span className="flex flex-wrap items-center gap-2">
                  <Trophy className="h-4 w-4 text-gold-500" />
                  <b>{first.tournament_name}</b>
                  <StatusBadge status={first.tournament_status} label={TOURNAMENT_STATUS[first.tournament_status]} />
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {items.length} categoría(s) · {players} jugador(es) en nómina
                  {empty > 0 && first.tournament_status !== "finished" && <span className="text-amber-600 dark:text-amber-400"> · {empty} sin nómina</span>}
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {items.map((r) => (
                  <button key={r.id} onClick={() => open(r.id)} title={`Abrir la nómina de ${r.category_name}`}
                    className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:border-navy-400 hover:bg-navy-50 dark:hover:border-gold-500/50 dark:hover:bg-gold-500/10",
                      r.roster_count ? "border-slate-200 dark:border-white/10" : "border-dashed border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-300")}>
                    {r.category_name} · {r.roster_count}
                  </button>
                ))}
                <ChevronRight className="hidden h-4 w-4 text-slate-400 lg:block" />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Página de una categoría inscrita: su nómina, y desde aquí se carga la categoría o se inscribe uno a uno. */
function CategoryRoster({ team, registration, canManage, canEditPlayers }: {
  team: Team; registration: Registration; canManage: boolean; canEditPlayers: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState<"existing" | "new" | "category" | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState(false);
  const rosterQ = useQuery({
    queryKey: ["roster", registration.id], queryFn: () => roster.all({ registration: registration.id, is_active: true }),
  });
  const rows = rosterQ.data ?? [];
  const chosen = rows.filter((r) => selected.has(r.id));
  const allChosen = rows.length > 0 && chosen.length === rows.length;
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // Los contadores de cada categoría salen de las inscripciones: se refrescan junto con la nómina.
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["roster"] }), queryClient.invalidateQueries({ queryKey: ["registrations"] }),
  ]);

  const enroll = async (playerId: number, shirt: unknown) => {
    await roster.create({ registration: registration.id, player: playerId, shirt_number: shirt });
    toast.success("Jugador inscrito en la nómina del torneo.");
    setAdding(null);
    await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["players"] })]);
  };

  const enrollFields: FieldDef[] = [
    { name: "player", label: "Jugador", type: "remote", required: true, wide: true,
      help: `Solo aparecen jugadores nacidos desde el año tope de ${registration.category_name} y libres en este torneo.`,
      remote: { service: players, params: { available_for: registration.id },
        label: (p: Player) => p.full_name,
        hint: (p: Player) => [p.vat_display || "Partida de nacimiento", `${p.age} años`, p.current_team_name ? `Equipo actual: ${p.current_team_name}` : "Sin equipo"].join(" · ") } },
    { name: "shirt_number", label: "Dorsal", type: "number", min: 0, max: 99 },
  ];
  const subtitle = [registration.group_name && `Grupo ${registration.group_name}`,
    registration.tournament_status === "finished" ? "Torneo finalizado: la nómina ya no se modifica." : "Cargue la categoría completa o inscriba jugadores uno a uno."]
    .filter(Boolean).join(" · ");

  return (
    <Card>
      <CardHeader title={`Nómina · ${registration.category_name}`} subtitle={subtitle}
        actions={canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-gold btn-sm" onClick={() => setAdding("category")}><ListChecks className="h-4 w-4" /> Cargar categoría</button>
            <button className="btn-outline btn-sm" onClick={() => setAdding("existing")}><Plus className="h-4 w-4" /> Inscribir jugador</button>
            <button className="btn-outline btn-sm" onClick={() => setAdding("new")}><UserPlus className="h-4 w-4" /> Nuevo jugador</button>
          </div>
        )} />
      {canManage && rows.length > 0 && (
        <div className={cn("flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-2 text-sm dark:border-white/5", chosen.length && "bg-gold-50/80 dark:bg-gold-500/10")}>
          <label className="flex cursor-pointer items-center gap-2 font-semibold text-navy-700 dark:text-gold-400">
            <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={allChosen}
              onChange={() => setSelected(allChosen ? new Set() : new Set(rows.map((r) => r.id)))} />
            {allChosen ? "Quitar selección" : `Seleccionar todos (${rows.length})`}
          </label>
          {chosen.length > 0 && (
            <>
              <span className="text-slate-500">{chosen.length} seleccionado(s)</span>
              <button className="btn-sm btn-outline border-crimson-300 text-crimson-600" onClick={() => setRemoving(true)}><UserX className="h-4 w-4" /> Dar de baja</button>
              <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}><X className="h-4 w-4" /> Limpiar</button>
            </>
          )}
        </div>
      )}
      <DataTable<TeamPlayer> paginate loading={rosterQ.isLoading} rows={rows} columns={[
        ...(canManage ? [{ key: "sel", header: "", className: "w-10", render: (r: TeamPlayer) => (
          <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={selected.has(r.id)} aria-label={`Seleccionar a ${r.player_detail.full_name}`}
            onChange={() => toggle(r.id)} />
        ) }] : []),
        { key: "n", header: "Dorsal", render: (r) => canManage
          ? <ShirtInput key={`${r.id}-${r.shirt_number}`} entry={r} onSaved={refresh} />
          : <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 font-display font-bold text-gold-400">{r.shirt_number ?? "–"}</span> },
        { key: "p", header: "Jugador", render: (r) => playerCell(r.player_detail) },
        { key: "age", header: "Edad", render: (r) => `${r.player_detail.age} años (${formatDate(r.player_detail.birth_date)})` },
        { key: "g", header: "Representante", render: (r) => r.player_detail.guardian_name ?? "—" },
        { key: "a", header: "", className: "text-right", render: (r) => (
          <span className="flex justify-end gap-1">
            {canEditPlayers && editButton("Editar jugador", () => setEditing(r.player))}
            {canManage && (
              <button className="btn-ghost btn-sm text-crimson-600" title="Dar de baja de la nómina" onClick={async () => {
                try { await roster.deactivate(r.id); toast.success("Jugador dado de baja de la nómina (registro conservado)."); await refresh(); }
                catch (e) { toast.error(errorMessage(e)); }
              }}><UserX className="h-4 w-4" /></button>
            )}
          </span>
        ) },
      ]} empty={<EmptyState title="Nómina vacía" message={canManage
        ? `Cargue la categoría: se proponen los jugadores del equipo de ${registration.category_name} para revisarlos y confirmarlos.`
        : "Nadie inscrito todavía en la nómina de esta categoría."}
        action={canManage && <button className="btn-gold btn-sm" onClick={() => setAdding("category")}><ListChecks className="h-4 w-4" /> Cargar categoría</button>} />} />
      <EditPlayerModal playerId={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={removing} onClose={() => setRemoving(false)} danger confirmLabel="Dar de baja"
        title={`Dar de baja a ${chosen.length} jugador(es)`}
        message={`Salen de la nómina de ${registration.category_name} en ${registration.tournament_name}; los registros se conservan y se pueden volver a inscribir.`}
        onConfirm={async () => {
          try {
            const { deactivated } = await roster.bulkDeactivate(chosen.map((r) => r.id));
            toast.success(`${deactivated} jugador(es) dado(s) de baja de la nómina (registros conservados).`);
            setSelected(new Set());
            await refresh();
          } catch (e) { toast.error(errorMessage(e)); throw e; }
        }} />
      {adding === "category" && (
        <RosterByCategoryModal registration={registration} taken={(rosterQ.data ?? []).flatMap((r) => (r.shirt_number == null ? [] : [r.shirt_number]))}
          onClose={() => setAdding(null)} onDone={() => Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["players"] })])} />
      )}

      <Modal open={adding === "existing"} onClose={() => setAdding(null)} title="Inscribir jugador registrado" size="sm"
        subtitle={`${registration.tournament_name} · ${registration.category_name}`}>
        <ResourceForm fields={enrollFields} onSubmit={(v) => enroll(v.player as number, v.shirt_number)} onCancel={() => setAdding(null)} submitLabel="Inscribir" />
      </Modal>
      <Modal open={adding === "new"} onClose={() => setAdding(null)} title="Nuevo jugador e inscripción" size="lg"
        subtitle={`${registration.tournament_name} · ${registration.category_name}`}>
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

/** Dorsal editable en la nómina: se guarda al salir del campo o con Enter (Esc lo deja como estaba). */
function ShirtInput({ entry, onSaved }: { entry: TeamPlayer; onSaved: () => Promise<unknown> }) {
  const toast = useToast();
  const initial = entry.shirt_number?.toString() ?? "";
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);
  const save = async () => {
    if (cancelled.current) { cancelled.current = false; return; }
    if (value === initial || busy) return;
    setBusy(true);
    try {
      await roster.update(entry.id, { shirt_number: value === "" ? null : Number(value) });
      toast.success(`Dorsal de ${entry.player_detail.full_name} actualizado.`);
      await onSaved();
    } catch (e) { toast.error(errorMessage(e)); setValue(initial); }
    finally { setBusy(false); }
  };
  return (
    <input className={cn("h-8 w-12 rounded-lg border-0 bg-navy-900 text-center font-display font-bold text-gold-400 placeholder:text-gold-400/50 focus:outline-none focus:ring-2 focus:ring-gold-400",
      busy && "opacity-60")} inputMode="numeric" placeholder="–" value={value} disabled={busy}
      aria-label={`Dorsal de ${entry.player_detail.full_name}`} title="Editar dorsal"
      onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 2))}
      onBlur={() => void save()}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { cancelled.current = true; setValue(initial); e.currentTarget.blur(); } }} />
  );
}

/**
 * Nómina por categoría: propone los jugadores del equipo de esa categoría (ya marcados) y los de categorías
 * menores (elegibles, sin marcar). Solo queda revisar, ajustar dorsales y confirmar.
 */
function RosterByCategoryModal({ registration, taken, onClose, onDone }: {
  registration: Registration; taken: number[]; onClose: () => void; onDone: () => Promise<unknown>;
}) {
  const { data, isLoading, dataUpdatedAt } = useQuery({ queryKey: ["roster", "candidates", registration.id], queryFn: () => roster.candidates(registration.id) });
  const [errors, setErrors] = useState<{ label: string; message: string }[]>([]);
  return (
    <Modal open onClose={onClose} title={`Cargar nómina · ${registration.category_name}`} subtitle={registration.tournament_name} size="lg">
      {errors.length > 0 && (
        <div className="mb-4"><Alert tone="danger" title="No se pudieron inscribir algunos jugadores">
          <ul className="list-disc pl-5">{errors.map((e) => <li key={e.label}><b>{e.label}:</b> {e.message}</li>)}</ul>
        </Alert></div>
      )}
      {isLoading || !data ? <div className="grid place-items-center py-10"><Spinner /></div>
        : !data.length ? (
          <EmptyState title="Sin jugadores por proponer" message={`Todos los jugadores del equipo elegibles para ${registration.category_name} ya están en una nómina de este torneo, o no hay ninguno registrado. Use «Nuevo jugador» para registrar más.`} />
        ) : (
          <CandidatesForm key={dataUpdatedAt} candidates={data} taken={taken} registration={registration} onClose={onClose}
            onSaved={async (result) => { setErrors(result.errors); await onDone(); if (!result.errors.length) onClose(); }} />
        )}
    </Modal>
  );
}

type Pick = { checked: boolean; shirt: string };

function CandidatesForm({ candidates, taken, registration, onClose, onSaved }: {
  candidates: RosterCandidate[]; taken: number[]; registration: Registration; onClose: () => void;
  onSaved: (result: { created: number; errors: { label: string; message: string }[] }) => Promise<void>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [picks, setPicks] = useState<Record<number, Pick>>(() => Object.fromEntries(
    candidates.map((c) => [c.player.id, { checked: c.suggested, shirt: c.shirt_number?.toString() ?? "" }])));
  const set = (id: number, change: Partial<Pick>) => setPicks((p) => ({ ...p, [id]: { ...p[id], ...change } }));

  const chosen = candidates.filter((c) => picks[c.player.id].checked);
  const counts = new Map<string, number>();
  chosen.forEach((c) => { const v = picks[c.player.id].shirt.trim(); if (v) counts.set(v, (counts.get(v) ?? 0) + 1); });
  const shirtError = (id: number) => {
    const { checked, shirt } = picks[id];
    const v = shirt.trim();
    if (!checked || !v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 99) return "Dorsal de 0 a 99";
    if (taken.includes(n)) return "Ya está en la nómina";
    return (counts.get(v) ?? 0) > 1 ? "Dorsal repetido" : null;
  };
  const invalid = chosen.some((c) => shirtError(c.player.id));
  const empties = chosen.filter((c) => !picks[c.player.id].shirt.trim());

  const numberEmpties = () => {
    const used = new Set([...taken, ...chosen.map((c) => picks[c.player.id].shirt.trim()).filter(Boolean).map(Number)]);
    const next: Record<number, Pick> = { ...picks };
    let n = 1;
    for (const c of empties) {
      while (used.has(n) && n <= 99) n++;
      if (n > 99) break;
      next[c.player.id] = { ...next[c.player.id], shirt: String(n) };
      used.add(n);
    }
    setPicks(next);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const result = await roster.bulk({ registration: registration.id, players: chosen.map((c) => {
        const v = picks[c.player.id].shirt.trim();
        return { player: c.player.id, shirt_number: v ? Number(v) : null };
      }) });
      if (result.created) toast.success(`${result.created} jugador(es) inscrito(s) en la nómina.`);
      await onSaved(result);
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  };

  const section = (title: string, help: string, rows: RosterCandidate[]) => {
    if (!rows.length) return null;
    const all = rows.every((c) => picks[c.player.id].checked);
    return (
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-semibold">{title} ({rows.length})</p><p className="text-xs text-slate-500">{help}</p></div>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setPicks((p) => ({ ...p, ...Object.fromEntries(rows.map((c) => [c.player.id, { ...p[c.player.id], checked: !all }])) }))}>
            {all ? "Desmarcar todos" : "Marcar todos"}
          </button>
        </div>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
          {rows.map((c) => {
            const pick = picks[c.player.id];
            const error = shirtError(c.player.id);
            return (
              <li key={c.player.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-2.5", !pick.checked && "opacity-60")}>
                <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={pick.checked} aria-label={`Inscribir a ${c.player.full_name}`}
                  onChange={(e) => set(c.player.id, { checked: e.target.checked })} />
                <span className="min-w-0 flex-1">{playerCell(c.player)}</span>
                <span className="text-xs text-slate-500">{c.player.age} años · <Badge tone="gold">{c.category_name}</Badge></span>
                <label className="flex flex-col items-end">
                  <span className="sr-only">Dorsal</span>
                  <input className={cn("input w-20 text-center", error && "border-crimson-400")} inputMode="numeric" placeholder="Dorsal" disabled={!pick.checked}
                    value={pick.shirt} onChange={(e) => set(c.player.id, { shirt: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
                  {error && <span className="mt-0.5 text-[11px] text-crimson-600">{error}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Jugadores del plantel actual elegibles para <b>{registration.category_name}</b> y libres en este torneo. Ya vienen marcados los de esta categoría;
        revise, ajuste los dorsales y confirme.
      </p>
      {section(`De ${registration.category_name}`, "Su categoría en el equipo es esta.", candidates.filter((c) => c.suggested))}
      {section("Otros elegibles", "De categorías menores: pueden jugar aquí si los marca (y ya no podrán jugar otra categoría de este torneo).", candidates.filter((c) => !c.suggested))}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/5">
        <span className="text-sm text-slate-500">{chosen.length} seleccionado(s){empties.length > 0 && ` · ${empties.length} sin dorsal`}</span>
        <div className="flex flex-wrap gap-2">
          {empties.length > 0 && <button type="button" className="btn-ghost btn-sm" onClick={numberEmpties}>Numerar los sin dorsal</button>}
          <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={!chosen.length || invalid || busy} onClick={() => void submit()}>
            {busy ? <Spinner className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />} Inscribir {chosen.length}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Jugadores (actuales e históricos)
type Situation = "" | "current" | "free" | "other";

/** Categorías del equipo de la menor a la mayor (para ubicar a cada jugador en la suya). */
function useTeamLadder(team: Team) {
  const { data = [] } = useQuery({ queryKey: ["categories", "all"], queryFn: () => categories.all({ is_active: true }) });
  return useMemo(() => data.filter((c) => team.categories.includes(c.id)).sort((a, b) => a.max_age - b.max_age), [data, team.categories]);
}

/** Categoría del jugador en el equipo: la más baja de las del equipo en la que entra por edad. */
const ownCategory = (player: { birth_date: string }, ladder: Category[]) =>
  ladder.find((c) => Number(player.birth_date.slice(0, 4)) >= c.birth_year_limit) ?? null;

function PlayersTab({ team, canCreate, canEdit, canEditFormer }: { team: Team; canCreate: boolean; canEdit: boolean; canEditFormer: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [releasing, setReleasing] = useState<Player | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [situation, setSituation] = useState<Situation>("");
  const [tournament, setTournament] = useState<number | null>(null);
  const ladder = useTeamLadder(team);
  const { data = [], isLoading } = useQuery({ queryKey: ["players", "team", team.id], queryFn: () => players.all({ team: team.id }) });

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["players"] }), queryClient.invalidateQueries({ queryKey: ["teams", team.id] }),
  ]);
  const readmit = async (playerId: number) => {
    setBusy(true);
    try { await players.readmit(playerId, team.id); toast.success("Jugador incorporado al plantel actual."); setPick(null); await refresh(); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const loadFree = async (query: string) => (await players.list({ free: true, is_active: true, search: query })).results
    .map((p: Player) => ({ value: p.id, label: p.full_name,
      hint: [p.vat_display || "Partida de nacimiento", `${p.age} años`, p.released_from_name && `Desvinculado de ${p.released_from_name}`].filter(Boolean).join(" · ") }));

  const withTeam = (p: Player) => p.history.filter((h) => h.team === team.id);
  const tournamentOptions = [...new Map(data.flatMap(withTeam).map((h) => [h.tournament, h.tournament_name])).entries()]
    .map(([value, label]) => ({ value, label }));
  const term = normalize(search.trim());
  const visible = data.filter((p) => {
    if (term && !normalize(`${p.full_name} ${p.vat_display}`).includes(term)) return false;
    if (category != null && ownCategory(p, ladder)?.id !== category) return false;
    if (tournament != null && !withTeam(p).some((h) => h.tournament === tournament)) return false;
    if (situation === "current") return p.current_team === team.id;
    if (situation === "free") return p.current_team === null;
    if (situation === "other") return p.current_team !== null && p.current_team !== team.id;
    return true;
  });
  const current = visible.filter((p) => p.current_team === team.id);
  const former = visible.filter((p) => p.current_team !== team.id);
  const filtering = Boolean(term || category != null || tournament != null || situation);

  const columns = [
    { key: "p", header: "Jugador", render: (r: Player) => playerCell(r) },
    { key: "age", header: "Edad", render: (r: Player) => `${r.age} años` },
    { key: "c", header: "Categoría", render: (r: Player) => { const c = ownCategory(r, ladder); return c ? <Badge tone="gold">{c.name}</Badge> : <span className="text-slate-400">Fuera de edad</span>; } },
    { key: "t", header: "Torneos con el equipo", render: (r: Player) => withTeam(r).map((h) => <Badge key={h.id} className="mr-1">{h.tournament_name}</Badge>) },
    { key: "s", header: "G · PJ", render: (r: Player) => <span className="font-mono text-xs"><b className="text-gold-600 dark:text-gold-400">{r.stats.goals}</b> · {r.stats.matches}</span> },
  ];
  // Solo el equipo actual (o un administrador) puede actualizar la ficha del jugador.
  const currentActions = { key: "e", header: "", className: "text-right", render: (r: Player) => canEdit && (
    <span className="flex justify-end gap-1">
      {editButton("Editar jugador", () => setEditing(r.id))}
      <button className="btn-ghost btn-sm text-crimson-600" title="Desvincular del equipo (queda libre)" aria-label="Desvincular del equipo"
        onClick={(e) => { e.stopPropagation(); setReleasing(r); }}><UserMinus className="h-4 w-4" /></button>
    </span>
  ) };
  const formerActions = { key: "e", header: "", className: "text-right", render: (r: Player) => (
    <span className="flex justify-end gap-1">
      {canEditFormer && editButton("Editar jugador", () => setEditing(r.id))}
      {canEdit && r.is_active && r.current_team === null && (
        <button className="btn-ghost btn-sm text-emerald-600" title="Readmitir en el equipo" aria-label="Readmitir en el equipo" disabled={busy}
          onClick={(e) => { e.stopPropagation(); void readmit(r.id); }}><RotateCcw className="h-4 w-4" /></button>
      )}
    </span>
  ) };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o documento…" />
          <div className="lg:w-44"><SelectMenu value={category} clearable placeholder="Todas las categorías" onChange={(v) => setCategory(v == null ? null : Number(v))}
            options={ladder.map((c) => ({ value: c.id, label: c.name, hint: `Nacidos desde ${c.birth_year_limit}` }))} /></div>
          <div className="lg:w-48"><SelectMenu value={situation || null} clearable placeholder="Toda situación" onChange={(v) => setSituation((v ?? "") as Situation)}
            options={[{ value: "current", label: "En el plantel actual" }, { value: "free", label: "Libres (desvinculados)" }, { value: "other", label: "En otro equipo" }]} /></div>
          <div className="lg:w-52"><SelectMenu value={tournament} clearable placeholder="Todos los torneos" searchable={tournamentOptions.length > 6}
            onChange={(v) => setTournament(v == null ? null : Number(v))} options={tournamentOptions} /></div>
          {filtering && (
            <button className="btn-ghost btn-sm" onClick={() => { setSearch(""); setCategory(null); setSituation(""); setTournament(null); }}>
              <X className="h-4 w-4" /> Limpiar
            </button>
          )}
        </div>
      </Card>
      {situation !== "free" && situation !== "other" && (
        <Card>
          <CardHeader title={`Plantel actual (${current.length})`} subtitle="Jugadores cuyo equipo actual es este: el equipo puede actualizar su ficha (fotos, documento…)."
            actions={canCreate && <button className="btn-gold btn-sm" onClick={() => setCreating(true)}><UserPlus className="h-4 w-4" /> Nuevo jugador</button>} />
          {canEdit && (
            <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row dark:border-white/5">
              <div className="flex-1">
                <SelectMenu value={pick} onChange={(v) => setPick(v as number | null)} load={loadFree} placeholder="Incorporar un jugador libre: buscar por nombre o cédula…" searchPlaceholder="Nombre o cédula…" />
              </div>
              <button className="btn-primary" disabled={!pick || busy} onClick={() => void readmit(pick!)}>
                {busy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Incorporar
              </button>
            </div>
          )}
          <DataTable<Player> paginate loading={isLoading} rows={current} onRowClick={(r) => setProfile(r.id)}
            empty={filtering ? "Ningún jugador del plantel coincide con los filtros." : "Sin jugadores actuales."} columns={[...columns, currentActions]} />
        </Card>
      )}
      {situation !== "current" && (
        <Card>
          <CardHeader title={`Desvinculados y anteriores (${former.length})`} subtitle="Jugadores que el equipo desvinculó o que estuvieron en alguna de sus nóminas y hoy están en otro equipo o libres. Los libres se pueden readmitir." />
          <DataTable<Player> paginate loading={isLoading} rows={former} onRowClick={(r) => setProfile(r.id)}
            empty={filtering ? "Ningún jugador coincide con los filtros." : "Sin registros históricos."} columns={[
              ...columns.slice(0, 1),
              { key: "now", header: "Situación", render: (r: Player) => r.current_team_name ? <Badge tone="navy">{r.current_team_name}</Badge>
                : <span className="flex flex-wrap gap-1"><Badge tone="emerald">Libre</Badge>{r.released_from === team.id && <Badge tone="amber">Desvinculado</Badge>}</span> },
              ...columns.slice(1),
              formerActions,
            ]} />
        </Card>
      )}
      <PlayerProfile playerId={profile} onClose={() => setProfile(null)} />
      <EditPlayerModal playerId={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={releasing !== null} onClose={() => setReleasing(null)} danger confirmLabel="Desvincular"
        title={`Desvincular a ${releasing?.full_name ?? ""}`}
        message={<>El jugador deja el plantel actual y queda <b>libre</b>: otro equipo podrá incorporarlo. Sus nóminas de torneos no cambian
          (si ya no jugará, dele de baja desde «Nómina por torneo»). Seguirá apareciendo aquí para readmitirlo si vuelve.</>}
        onConfirm={async () => {
          try { await players.release(releasing!.id); toast.success("Jugador desvinculado: quedó libre."); await refresh(); }
          catch (e) { toast.error(errorMessage(e)); throw e; }
        }} />
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
function CoachesTab({ team, canManage, canCreate }: { team: Team; canManage: boolean; canCreate: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pick, setPick] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Coach | null>(null);
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
      <CardHeader title="Cuerpo técnico" subtitle="Un entrenador solo puede estar en un equipo a la vez. Si tiene usuario, ayuda al gestor a cargar la plantilla."
        actions={canCreate && <button className="btn-gold btn-sm" onClick={() => setCreating(true)}><UserPlus className="h-4 w-4" /> Nuevo entrenador</button>} />
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
      <DataTable<Coach> paginate loading={isLoading} rows={data} empty="El equipo no tiene entrenadores asignados." columns={[
        { key: "n", header: "Entrenador", render: (c) => playerCell(c) },
        { key: "l", header: "Licencia", render: (c) => <span>{c.license_number} <StatusBadge status={c.license_valid ? "confirmed" : "rejected"} label={c.license_valid ? `Vigente ${c.license_expiry_year}` : `Vencida ${c.license_expiry_year}`} /></span> },
        { key: "u", header: "Usuario", render: (c) => c.username ? <Badge tone="navy">@{c.username}</Badge> : <span className="text-slate-400">Sin acceso</span> },
        { key: "a", header: "", className: "text-right", render: (c) => canManage && (
          <span className="flex justify-end gap-1">
            {editButton("Editar entrenador", () => setEditing(c))}
            <button className="btn-ghost btn-sm text-crimson-600" title="Quitar del equipo (queda libre)" onClick={() => setTeam(c.id, null, "Entrenador liberado.")}>
              <UserMinus className="h-4 w-4" />
            </button>
          </span>
        ) },
      ]} />
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Editar entrenador" subtitle={editing?.full_name} size="lg">
        {editing && <ResourceForm key={editing.id} fields={COACH_FIELDS} initial={editing as unknown as Values} onCancel={() => setEditing(null)}
          onSubmit={async (v) => {
            await coaches.update(editing.id, v);
            toast.success("Entrenador actualizado.");
            setEditing(null);
            await refresh();
          }} />}
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo entrenador" subtitle={`Queda asignado a ${team.name}`} size="lg">
        <ResourceForm fields={COACH_FIELDS} onCancel={() => setCreating(false)} submitLabel="Crear y asignar"
          onSubmit={async (v) => {
            await coaches.create({ ...v, team: team.id });
            toast.success("Entrenador creado y asignado al equipo.");
            setCreating(false);
            await refresh();
          }} />
      </Modal>
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
