import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, Lock, MapPin, Pencil, Plus, Shuffle, Trash2, X } from "lucide-react";

import { Can } from "@/components/layout/Guards";
import { TeamCrest } from "@/components/match/TeamCrest";
import {
  Alert, Badge, Card, CardHeader, ConfirmDialog, EmptyState, Modal, Pagination, SearchInput, SelectMenu, Spinner, StatusBadge,
  Toggle, usePaged,
} from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { groups, matches, registrations } from "@/services";
import type { Group, Match, Registration, Tournament } from "@/types";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";

type StatusFilter = "all" | "draft" | "sent" | "played";

const STATUS_FILTERS: { value: StatusFilter; label: string; test: (m: Match) => boolean }[] = [
  { value: "all", label: "Todos", test: () => true },
  { value: "draft", label: "Borrador", test: (m) => m.status === "draft" },
  { value: "sent", label: "Enviados", test: (m) => ["pending", "confirmed", "in_progress"].includes(m.status) },
  { value: "played", label: "Jugados", test: (m) => ["finished", "closed", "suspended"].includes(m.status) },
];

/** Se edita o elimina aquí solo lo que sigue en borrador y es de la fase regular (la llave tiene su pestaña). */
const isEditable = (m: Match) => m.status === "draft" && m.stage === "regular";
const roundKey = (m: Match) => (m.stage === "regular" ? `r${m.round_number}` : m.stage);
const roundLabel = (m: Match) => (m.stage === "regular" ? `Fecha ${m.round_number}` : m.stage_display);
const sortKey = (m: Match) => [(m.stage === "regular" ? 0 : 1000) + m.round_number, m.bracket_position ?? 0, m.leg ?? 0, m.id];
/** Rondas de la eliminación directa en orden. */
const KNOCKOUT_ORDER = ["r64", "r32", "r16", "qf", "sf", "final"];

/** Filtro de fase: un grupo (`g:<id>`), la fase regular sin grupo (`regular`) o una ronda de la llave (`qf`…). */
type Phase = string | null;

export function FixtureTab({ tournament }: { tournament: Tournament }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canDelete = useCan("competition.delete_match");
  const canEdit = useCan("competition.change_match");
  const [category, setCategory] = useState<number>(tournament.categories[0]);
  const [phase, setPhase] = useState<Phase>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<{ match: Match | null } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<Match[] | null>(null);

  const list = useQuery({ queryKey: ["matches", "tournament", tournament.id, category], queryFn: () => matches.all({ tournament: tournament.id, category, ordering: "round_number" }) });
  const grps = useQuery({ queryKey: ["groups", tournament.id], queryFn: () => groups.all({ tournament: tournament.id, is_active: true }) });
  const regs = useQuery({ queryKey: ["registrations", tournament.id], queryFn: () => registrations.all({ tournament: tournament.id, is_active: true }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["matches"] });

  const catOptions = tournament.categories.map((id, i) => ({ value: id, label: tournament.category_names[i] }));
  const catGroups = (grps.data ?? []).filter((g) => g.category === category);
  const all = useMemo(() => list.data ?? [], [list.data]);
  // Un partido de grupos generado sin grupo (p. ej. «todos los equipos») igual se ubica por el grupo de sus equipos.
  const regGroup = useMemo(() => new Map((regs.data ?? []).map((r) => [r.id, r.group])), [regs.data]);
  const phaseOf = useCallback((m: Match): string => {
    if (m.stage !== "regular") return m.stage;
    const home = m.home != null ? regGroup.get(m.home) : null;
    const group = m.group ?? (home != null && home === (m.away != null ? regGroup.get(m.away) : null) ? home : null);
    return group != null ? `g:${group}` : "regular";
  }, [regGroup]);
  const phases = useMemo(() => {
    const present = new Set(all.map(phaseOf));
    const options: { value: string; label: string }[] = catGroups.filter((g) => present.has(`g:${g.id}`)).map((g) => ({ value: `g:${g.id}`, label: g.name }));
    if (present.has("regular")) options.unshift({ value: "regular", label: catGroups.length ? "Sin grupo" : "Fase regular" });
    KNOCKOUT_ORDER.filter((stage) => present.has(stage))
      .forEach((stage) => options.push({ value: stage, label: all.find((m) => m.stage === stage)!.stage_display }));
    return options;
  }, [all, catGroups, phaseOf]);
  const term = search.trim().toLocaleLowerCase();
  const filtered = useMemo(() => all
    .filter((m) => phase == null || phaseOf(m) === phase)
    .filter(STATUS_FILTERS.find((f) => f.value === status)!.test)
    .filter((m) => !term || `${m.home_name} ${m.away_name}`.toLocaleLowerCase().includes(term))
    .sort((a, b) => {
      const [x, y] = [sortKey(a), sortKey(b)];
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || x[3] - y[3];
    }), [all, phase, status, term, phaseOf]);
  const paged = usePaged(filtered);
  const deletable = filtered.filter(isEditable);
  const chosen = all.filter((m) => selected.has(m.id));
  const allChosen = deletable.length > 0 && deletable.every((m) => selected.has(m.id));

  // Agrupa la página actual por fecha / ronda.
  const sections: { key: string; label: string; items: Match[] }[] = [];
  paged.rows.forEach((m) => {
    const last = sections[sections.length - 1];
    if (last?.key === roundKey(m)) last.items.push(m);
    else sections.push({ key: roundKey(m), label: roundLabel(m), items: [m] });
  });

  const resetView = () => { setSelected(new Set()); paged.setPage(1); };
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const counts = {
    total: all.length,
    draft: all.filter((m) => m.status === "draft").length,
    unscheduled: all.filter((m) => !m.matchday).length,
  };

  return (
    <Card>
      <CardHeader title="Partidos" subtitle="Cree el fixture automático o partidos sueltos; mientras estén en borrador puede editarlos o eliminarlos."
        actions={<>
          <div className="w-44"><SelectMenu value={category} onChange={(v) => { setCategory(Number(v)); setPhase(null); resetView(); }} options={catOptions} /></div>
          <Can perm="competition.add_match"><button className="btn-outline btn-sm" onClick={() => setForm({ match: null })}><Plus className="h-4 w-4" /> Nuevo partido</button></Can>
          <Can perm="competition.generate_fixture"><button className="btn-gold btn-sm" onClick={() => setGenerating(true)}><Shuffle className="h-4 w-4" /> Generar fixture</button></Can>
        </>} />

      {/* Filtros y resumen */}
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 dark:border-white/5">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={(v) => { setSearch(v); resetView(); }} placeholder="Buscar equipo…" />
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <Chip key={f.value} active={status === f.value} onClick={() => { setStatus(f.value); resetView(); }}>{f.label}</Chip>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap gap-1.5 text-xs">
            <Badge tone="navy">{counts.total} partido(s)</Badge>
            <Badge tone="slate">{counts.draft} en borrador</Badge>
            {counts.unscheduled > 0 && <Badge tone="amber">{counts.unscheduled} sin jornada</Badge>}
          </div>
        </div>
        {phases.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Fase</span>
            <Chip active={phase == null} onClick={() => { setPhase(null); resetView(); }}>Todas</Chip>
            {phases.map((p, i) => (
              <span key={p.value} className="contents">
                {i > 0 && !p.value.startsWith("g:") && phases[i - 1].value.startsWith("g:") && <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-white/10" />}
                <Chip active={phase === p.value} onClick={() => { setPhase(p.value); resetView(); }}>{p.label}</Chip>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Barra de selección */}
      {canDelete && deletable.length > 0 && (
        <div className={cn("flex flex-wrap items-center gap-3 px-5 py-2 text-sm", selected.size ? "bg-gold-50/80 dark:bg-gold-500/10" : "")}>
          <label className="flex cursor-pointer items-center gap-2 font-semibold text-navy-700 dark:text-gold-400">
            <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={allChosen}
              onChange={() => setSelected(allChosen ? new Set() : new Set(deletable.map((m) => m.id)))} />
            {allChosen ? "Quitar selección" : `Seleccionar los ${deletable.length} borrador(es) del filtro`}
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-slate-500">{selected.size} seleccionado(s)</span>
              <button className="btn-sm btn-outline border-crimson-300 text-crimson-600" onClick={() => setDeleting(chosen)}><Trash2 className="h-4 w-4" /> Eliminar</button>
              <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}><X className="h-4 w-4" /> Limpiar</button>
            </>
          )}
        </div>
      )}

      {list.isLoading ? <div className="grid h-32 place-items-center"><Spinner /></div> : !all.length ? (
        <EmptyState title="Sin partidos en esta categoría" message="Inscriba los equipos y pulse «Generar fixture», o cree un partido con «Nuevo partido»."
          action={<Can perm="competition.generate_fixture"><button className="btn-gold btn-sm" onClick={() => setGenerating(true)}><Shuffle className="h-4 w-4" /> Generar fixture</button></Can>} />
      ) : !filtered.length ? (
        <EmptyState title="Ningún partido coincide" message="Cambie la búsqueda o los filtros." />
      ) : (
        <>
          <Pagination page={paged.page} count={paged.count} onChange={paged.setPage} position="top" />
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {sections.map((section) => (
              <section key={section.key} className="px-5 py-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-900 dark:text-gold-400">
                  {section.label}
                  <span className="text-xs font-normal text-slate-400">{section.items.length} partido(s)</span>
                </h4>
                <ul className="space-y-2">
                  {section.items.map((m) => (
                    <MatchRow key={m.id} match={m} selectable={canDelete && isEditable(m)} selected={selected.has(m.id)} onSelect={() => toggle(m.id)}
                      onEdit={canEdit && isEditable(m) ? () => setForm({ match: m }) : undefined}
                      onDelete={canDelete && isEditable(m) ? () => setDeleting([m]) : undefined} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <Pagination page={paged.page} count={paged.count} onChange={paged.setPage} />
        </>
      )}

      {form && (
        <MatchFormModal key={form.match?.id ?? "new"} tournament={tournament} match={form.match} defaultCategory={category} defaultGroup={phase?.startsWith("g:") ? Number(phase.slice(2)) : null}
          groups={grps.data ?? []} registrations={regs.data ?? []}
          defaultRound={Math.max(1, ...all.filter((m) => m.stage === "regular").map((m) => m.round_number))}
          onClose={() => setForm(null)}
          onSaved={async (saved) => { setForm(null); if (saved.category !== category) setCategory(saved.category); await refresh(); }} />
      )}
      {generating && (
        <GenerateModal tournament={tournament} category={category} groups={catGroups} existing={all.filter((m) => m.stage === "regular")}
          onClose={() => setGenerating(false)} onDone={async () => { setGenerating(false); resetView(); await refresh(); }} />
      )}
      <ConfirmDialog open={deleting !== null} onClose={() => setDeleting(null)} danger confirmLabel="Eliminar definitivamente"
        title={deleting?.length === 1 ? "Eliminar partido" : `Eliminar ${deleting?.length ?? 0} partidos`}
        message={deleting?.length === 1
          ? `Se borrará ${deleting[0].home_name} vs ${deleting[0].away_name} (${roundLabel(deleting[0])}). No se puede deshacer.`
          : "Se borrarán los partidos seleccionados en borrador. No se puede deshacer."}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            if (deleting.length === 1) {
              await matches.remove(deleting[0].id);
              toast.success("Partido eliminado.");
            } else {
              const res = await matches.bulkDelete(tournament.id, deleting.map((m) => m.id));
              toast.success(`${res.deleted} partido(s) eliminado(s).${res.skipped ? ` ${res.skipped} omitido(s) por no estar en borrador.` : ""}`);
            }
            setSelected(new Set());
            await refresh();
          } catch (e) { toast.error(errorMessage(e)); throw e; }
        }} />
    </Card>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition", active
        ? "border-navy-700 bg-navy-700 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-navy-950"
        : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300")}>
      {children}
    </button>
  );
}

function MatchRow({ match: m, selectable, selected, onSelect, onEdit, onDelete }: {
  match: Match; selectable: boolean; selected: boolean; onSelect: () => void; onEdit?: () => void; onDelete?: () => void;
}) {
  const played = m.home_score != null;
  return (
    <li className={cn("flex items-center gap-3 rounded-xl border px-3 py-2 transition",
      selected ? "border-gold-400 bg-gold-50/60 dark:bg-gold-500/10" : "border-slate-100 hover:border-slate-200 dark:border-white/5 dark:hover:border-white/10")}>
      <span className="w-4 shrink-0">
        {selectable && <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={selected} onChange={onSelect} aria-label="Seleccionar partido" />}
      </span>
      <Link to={`/app/partidos/${m.id}`} className="grid min-w-0 flex-1 items-center gap-x-3 gap-y-1 sm:grid-cols-[1fr_auto_1fr]">
        <span className="flex min-w-0 items-center gap-2 sm:justify-end">
          <b className="truncate text-sm sm:order-1 sm:text-right">{m.home_name}</b>
          <TeamCrest src={m.home_logo} name={m.home_name} size="sm" />
        </span>
        <span className="hidden text-center font-display text-sm font-bold sm:block">
          {played ? `${m.home_score} - ${m.away_score}` : <span className="text-slate-400">vs</span>}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <TeamCrest src={m.away_logo} name={m.away_name} size="sm" />
          <b className="truncate text-sm">{m.away_name}</b>
          {played && <Badge tone="navy" className="sm:hidden">{m.home_score}-{m.away_score}</Badge>}
        </span>
        <span className="flex flex-wrap gap-x-3 text-xs text-slate-500 sm:col-span-3 sm:justify-center">
          {m.stage !== "regular" && <span className="font-semibold text-navy-700 dark:text-gold-400">
            {m.bracket_position ? `Cruce ${m.bracket_position}` : m.stage_display}{m.leg_display ? ` · ${m.leg_display}` : ""}</span>}
          {m.group_name && <span>{m.group_name}</span>}
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{m.matchday_label ?? "Sin jornada"}</span>
          {m.scheduled_start && <span>{formatDateTime(m.scheduled_start)}</span>}
          {m.field_name && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{m.field_name}</span>}
        </span>
      </Link>
      <span className="flex shrink-0 items-center gap-1">
        <StatusBadge status={m.status} label={m.status_display} />
        {onEdit && <button className="btn-ghost btn-sm p-1.5" title="Editar partido" aria-label="Editar partido" onClick={onEdit}><Pencil className="h-4 w-4" /></button>}
        {onDelete && <button className="btn-ghost btn-sm p-1.5 text-crimson-600" title="Eliminar partido" aria-label="Eliminar partido" onClick={onDelete}><Trash2 className="h-4 w-4" /></button>}
        {!onEdit && m.status !== "draft" && <span title="Enviado: los cambios se hacen con un ajuste desde el partido" className="p-1.5 text-slate-400"><Lock className="h-4 w-4" /></span>}
        {!onEdit && m.status === "draft" && m.stage !== "regular" && <span title="Se gestiona desde la pestaña Eliminación directa" className="p-1.5 text-slate-400"><Lock className="h-4 w-4" /></span>}
        <Link to={`/app/partidos/${m.id}`} className="btn-ghost btn-sm p-1.5 text-slate-400" aria-label="Abrir partido"><ChevronRight className="h-4 w-4" /></Link>
      </span>
    </li>
  );
}

/** Alta y edición de un partido de la fase regular. Los equipos se filtran por categoría y grupo. */
function MatchFormModal({ tournament, match, defaultCategory, defaultGroup, defaultRound, groups: allGroups, registrations: regs, onClose, onSaved }: {
  tournament: Tournament; match: Match | null; defaultCategory: number; defaultGroup: number | null; defaultRound: number;
  groups: Group[]; registrations: Registration[]; onClose: () => void; onSaved: (m: Match) => Promise<void>;
}) {
  const toast = useToast();
  const [category, setCategory] = useState<number>(match?.category ?? defaultCategory);
  const [group, setGroup] = useState<number | null>(match ? match.group : defaultGroup);
  const [home, setHome] = useState<number | null>(match?.home ?? null);
  const [away, setAway] = useState<number | null>(match?.away ?? null);
  const [round, setRound] = useState<number>(match?.round_number ?? defaultRound);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const catGroups = allGroups.filter((g) => g.category === category);
  const teams = regs.filter((r) => r.category === category && (group == null || r.group === group))
    .sort((a, b) => a.team_name.localeCompare(b.team_name));
  const options = (exclude: number | null) => teams.filter((r) => r.id !== exclude).map((r) => ({ value: r.id, label: r.team_name, hint: r.group_name ?? undefined }));
  const valid = home != null && away != null && home !== away && round >= 1;

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const data = { home, away, round_number: round, group };
      const saved = match ? await matches.update(match.id, data) : await matches.create({ ...data, tournament: tournament.id, category });
      toast.success(match ? "Partido actualizado." : "Partido creado en borrador.");
      await onSaved({ ...saved, category } as Match);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={match ? "Editar partido" : "Nuevo partido"} subtitle={tournament.name} size="md" footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn-primary" disabled={!valid || busy} onClick={save}>{busy && <Spinner className="h-4 w-4" />}{match ? "Guardar cambios" : "Crear partido"}</button>
    </>}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">Categoría</span>
            <SelectMenu value={category} disabled={Boolean(match)} onChange={(v) => { setCategory(Number(v)); setGroup(null); setHome(null); setAway(null); }}
              options={tournament.categories.map((id, i) => ({ value: id, label: tournament.category_names[i] }))} />
          </div>
          <div>
            <span className="label">Grupo</span>
            <SelectMenu value={group} clearable placeholder={catGroups.length ? "Sin grupo (todos los equipos)" : "La categoría no tiene grupos"}
              disabled={!catGroups.length} onChange={(v) => { setGroup(v == null ? null : Number(v)); setHome(null); setAway(null); }}
              options={catGroups.map((g) => ({ value: g.id, label: g.name }))} />
          </div>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <span className="label">Local</span>
            <SelectMenu value={home} searchable placeholder="Elija el local…" onChange={(v) => setHome(v == null ? null : Number(v))} options={options(away)} />
          </div>
          <span className="hidden pb-2.5 text-center text-sm font-bold text-slate-400 sm:block">vs</span>
          <div>
            <span className="label">Visitante</span>
            <SelectMenu value={away} searchable placeholder="Elija el visitante…" onChange={(v) => setAway(v == null ? null : Number(v))} options={options(home)} />
          </div>
        </div>
        {!teams.length && <Alert tone="info">No hay equipos inscritos en esta categoría{group != null ? " y grupo" : ""}.</Alert>}
        <label className="block w-40">
          <span className="label">Fecha / ronda</span>
          <input type="number" min={1} className="input" value={round} onChange={(e) => setRound(Number(e.target.value))} />
        </label>
        <p className="text-xs text-slate-500">La cancha, el horario y los oficiales se asignan después, al agregar el partido a una jornada.</p>
      </div>
    </Modal>
  );
}

/** Genera el fixture todos contra todos de la categoría (o de un grupo), con opción de reemplazar el borrador actual. */
function GenerateModal({ tournament, category, groups: catGroups, existing, onClose, onDone }: {
  tournament: Tournament; category: number; groups: Group[]; existing: Match[]; onClose: () => void; onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [group, setGroup] = useState<number | null>(null);
  // Por defecto, el formato del torneo: liga ida y vuelta o grupos ida y vuelta.
  const defaultDouble = (g: number | null) => tournament.modality === "league_double" || (g != null && tournament.groups_double);
  const [double, setDouble] = useState(defaultDouble(null));
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const categoryName = tournament.category_names[tournament.categories.indexOf(category)];
  // El backend compara por grupo exacto: sin grupo = el fixture general de la categoría.
  const current = existing.filter((m) => m.group === group);
  const sent = current.filter((m) => m.status !== "draft").length;

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await matches.generateFixture({ tournament: tournament.id, category, group, double, replace: current.length > 0 && replace });
      toast.success(`${res.created} partidos creados en borrador.`);
      await onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Generar fixture" subtitle={`${categoryName} · todos contra todos (método del círculo)`} size="md" footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn-gold" disabled={busy || (current.length > 0 && (!replace || sent > 0))} onClick={generate}>
        {busy && <Spinner className="h-4 w-4" />}{current.length ? "Reemplazar y generar" : "Generar"}
      </button>
    </>}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {catGroups.length > 0 && (
          <div>
            <span className="label">Grupo</span>
            <SelectMenu value={group} clearable placeholder="Todos los equipos de la categoría" onChange={(v) => { const g = v == null ? null : Number(v); setGroup(g); setDouble(defaultDouble(g)); setReplace(false); }}
              options={catGroups.map((g) => ({ value: g.id, label: g.name, hint: `${g.team_ids.length} equipos` }))} />
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <Toggle checked={double} onChange={setDouble} label="Ida y vuelta" /> Ida y vuelta (cada cruce se juega dos veces)
        </label>
        {!current.length && existing.length > 0 && (
          <Alert tone="info">
            La categoría ya tiene {existing.length} partido(s) {group == null ? "en sus grupos" : "fuera de este grupo"}; este fixture se agrega aparte.
          </Alert>
        )}
        {current.length > 0 && (sent > 0 ? (
          <Alert tone="warning" title="No se puede reemplazar">
            Ya hay {current.length} partido(s) generados{group != null ? " para este grupo" : ""} y {sent} ya fueron enviados. Elimine o ajuste los partidos manualmente.
          </Alert>
        ) : (
          <Alert tone="warning" title="Ya existe un fixture">
            Hay {current.length} partido(s) en borrador{group != null ? " para este grupo" : ""}.
            <label className="mt-2 flex cursor-pointer items-center gap-3 font-semibold">
              <Toggle checked={replace} onChange={setReplace} label="Reemplazar" /> Borrarlos y generar de nuevo
            </label>
          </Alert>
        ))}
      </div>
    </Modal>
  );
}
