import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Lock, MapPin, Pencil, Plus, Send, Trash2, X } from "lucide-react";

import { ResourceForm } from "@/components/forms";
import { Can } from "@/components/layout/Guards";
import {
  Alert, Badge, ConfirmDialog, EmptyState, Modal, PageHeader, PageLoader, Pagination, SearchInput, SelectMenu, Spinner, StatusBadge,
  usePaged,
} from "@/components/ui";
import { useCan, useDebounce, useToast } from "@/hooks";
import { delegates, fields as fieldsService, groups as groupsService, matchdays, matches, referees, registrations, tournaments } from "@/services";
import type { Field, Match, Matchday } from "@/types";
import { cn } from "@/utils/cn";
import { capacityFor, fieldSize } from "@/utils/fieldCapacity";
import { formatDate, formatLongDate, formatTime, isReasonableDate, normalizeTime, toCaracasInput, UTC_OFFSET } from "@/utils/datetime";
import { errorMessage, fieldErrors } from "@/utils/errors";
import { FIELD_LABELS } from "@/utils/labels";
import { groupResolver, KNOCKOUT_ORDER, phaseKey } from "@/utils/matchPhase";

interface AssignScope { schedule: boolean; delegate: boolean; referees: boolean }

/** Etiquetas cortas de un partido: fase (grupo o ronda), fecha o cruce, y si es ida o vuelta. */
const matchMeta = (m: Match) => [
  m.category_name,
  m.stage === "regular" ? (m.group_name ?? "Fase regular") : m.stage_display,
  m.stage === "regular" ? `Fecha ${m.round_number}` : `Cruce ${m.bracket_position ?? "—"}`,
  m.leg_display,
].filter(Boolean).join(" · ");

export function MatchdayDetailPage() {
  const id = Number(useParams().id);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState<{ field: number | null } | null>(null);
  const [confirm, setConfirm] = useState<"submit" | "close" | "delete" | null>(null);
  const [editing, setEditing] = useState(false);
  const canSchedule = useCan("competition.change_match");
  // Los jefes de delegados / árbitros solo asignan a los oficiales de su tipo, y recién tras el envío.
  const scope: AssignScope = {
    schedule: canSchedule,
    delegate: useCan(["competition.change_match", "competition.assign_delegate"], "any"),
    referees: useCan(["competition.change_match", "competition.assign_referees"], "any"),
  };

  const md = useQuery({ queryKey: ["matchdays", id], queryFn: () => matchdays.get(id) });
  const list = useQuery({ queryKey: ["matches", "matchday", id], queryFn: () => matches.all({ matchday: id, ordering: "scheduled_start" }), refetchInterval: 20_000 });
  const completeness = useQuery({ queryKey: ["matchdays", id, "completeness", list.data], queryFn: () => matchdays.completeness(id), enabled: md.data?.status === "draft" });
  const tournament = useQuery({ queryKey: ["tournaments", md.data?.tournament], queryFn: () => tournaments.get(md.data!.tournament), enabled: Boolean(md.data) });
  const allFields = useQuery({ queryKey: ["options", "fields"], queryFn: () => fieldsService.all({ is_active: true }), staleTime: 60_000 });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["matches"] });
    await queryClient.invalidateQueries({ queryKey: ["matchdays"] });
  };

  // Canchas del torneo (o todas si el torneo no indicó) más las que ya usan sus partidos.
  const fieldCards = useMemo(() => {
    const all = allFields.data ?? [];
    const own = tournament.data?.fields ?? [];
    const used = new Set((list.data ?? []).map((m) => m.field).filter((f): f is number => f != null));
    return all.filter((f) => (own.length ? own.includes(f.id) : true) || used.has(f.id));
  }, [allFields.data, tournament.data, list.data]);

  if (md.isLoading || !md.data) return <PageLoader />;
  const matchday = md.data;
  const draft = matchday.status === "draft";
  const rows = list.data ?? [];
  const withoutField = rows.filter((m) => m.field == null);
  const missingTime = rows.filter((m) => !m.scheduled_start).length;

  const doAction = async (action: "submit" | "close" | "delete") => {
    try {
      if (action === "submit") await matchdays.submit(id);
      if (action === "close") await matchdays.close(id);
      if (action === "delete") {
        await matchdays.remove(id);
        window.history.back();
        return;
      }
      toast.success(action === "submit" ? "Jornada enviada: se avisó a los jefes de delegados y de árbitros para asignar oficiales." : "Jornada cerrada.");
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  };

  // Categorías de la jornada con sus reglas: cada tarjeta indica cuántos partidos de cada una entran a la vez.
  const categoryRules = [...new Map(rows.map((m) => [m.category_name, m.rules] as const)).entries()].sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }));
  const cardProps = { matchday, draft, scope, fields: fieldCards, categoryRules, incomplete: completeness.data?.incomplete ?? {}, onSaved: refresh,
    onAdd: draft && canSchedule ? (field: number | null) => setAdding({ field }) : undefined };

  return (
    <div>
      <Link to="/app/jornadas" className="btn-ghost mb-4 -ml-3"><ArrowLeft className="h-4 w-4" /> Jornadas</Link>
      <PageHeader title={matchday.name || `Jornada ${matchday.number}`} subtitle={<span className="capitalize">{matchday.tournament_name} · {formatLongDate(matchday.date)}</span>}
        actions={<>
          <StatusBadge status={matchday.status} label={matchday.status_display} />
          {draft && <Can perm="competition.change_matchday"><button className="btn-ghost" title="Editar número, día o nombre" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Editar</button></Can>}
          {draft && <Can perm="competition.delete_matchday"><button className="btn-ghost text-crimson-600" title="Eliminar borrador" onClick={() => setConfirm("delete")}><Trash2 className="h-4 w-4" /></button></Can>}
          {draft && canSchedule && <button className="btn-outline" onClick={() => setAdding({ field: null })}><Plus className="h-4 w-4" /> Agregar partidos</button>}
          {draft && <Can perm="competition.submit_matchday"><button className="btn-gold" disabled={!completeness.data?.ready} onClick={() => setConfirm("submit")}><Send className="h-4 w-4" /> Enviar jornada</button></Can>}
          {matchday.status !== "draft" && matchday.status !== "closed" && <Can perm="competition.close_matchday"><button className="btn-primary" onClick={() => setConfirm("close")}><Lock className="h-4 w-4" /> Cerrar jornada</button></Can>}
        </>} />

      {!isReasonableDate(matchday.date) && (
        <div className="mb-4"><Alert tone="danger" title="Revise el día de la jornada">
          La jornada está guardada para el {formatDate(matchday.date)}: el año parece mal escrito, y con esa fecha las horas se muestran corridas.
          {draft && " Corríjala con «Editar»: los partidos se mueven al nuevo día con la misma hora."}
        </Alert></div>
      )}
      {draft && completeness.data && (
        <div className="mb-4">
          {completeness.data.ready
            ? <Alert tone="success" title="Lista para enviar">Todos los partidos tienen cancha y hora. Al enviarla quedan bloqueados y se avisa a los jefes de delegados y de árbitros para que asignen a los oficiales.</Alert>
            : <Alert tone="info" title="Arme la jornada">Agregue partidos a cada cancha y escriba su hora de inicio: el fin se calcula con las reglas de la categoría y todo se guarda solo. Cuando cada partido tenga cancha y hora, pulse «Enviar jornada». Delegado y árbitros los asignan los jefes después del envío.</Alert>}
        </div>
      )}
      {matchday.status === "submitted" && <div className="mb-4"><Alert tone="info" title="Asignación y confirmación de oficiales">Los jefes asignan delegado y terna arbitral de cada partido (se guarda al elegir). Cada partido queda bloqueado cuando sus oficiales confirman, y entonces se avisa a los equipos. La jornada es válida cuando todos sus partidos están confirmados.</Alert></div>}

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Badge tone="navy">{rows.length} partido(s)</Badge>
        {draft && withoutField.length > 0 && <Badge tone="amber">{withoutField.length} sin cancha</Badge>}
        {draft && missingTime > 0 && <Badge tone="amber">{missingTime} sin hora</Badge>}
      </div>

      {list.isLoading || allFields.isLoading ? <div className="grid h-32 place-items-center"><Spinner /></div> : (
        <div className={cn("grid gap-4", draft && "xl:grid-cols-2")}>
          {withoutField.length > 0 && <FieldCard field={null} matches={withoutField} {...cardProps} />}
          {fieldCards.map((f) => <FieldCard key={f.id} field={f} matches={rows.filter((m) => m.field === f.id)} {...cardProps} />)}
          {!fieldCards.length && !withoutField.length && (
            <div className="card xl:col-span-2"><EmptyState title="Sin canchas" message="Registre canchas o indíquelas en el torneo para armar la jornada." /></div>
          )}
        </div>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar jornada" size="sm">
        <ResourceForm initial={{ number: matchday.number, date: matchday.date, name: matchday.name }} onCancel={() => setEditing(false)}
          fields={[
            { name: "number", label: "Número de jornada", type: "number", required: true, min: 1 },
            { name: "date", label: "Día de jornada", type: "date", required: true, help: "Si cambia el día, los partidos programados se mueven a esa fecha con la misma hora." },
            { name: "name", label: "Nombre (opcional)", type: "text", placeholder: "Jornada 1 · Apertura" },
          ]}
          onSubmit={async (v) => {
            await matchdays.update(id, v);
            toast.success("Jornada actualizada.");
            setEditing(false);
            await refresh();
          }} />
      </Modal>
      {adding && (
        <AddMatchesModal matchday={matchday} presetField={adding.field} fields={fieldCards} onClose={() => setAdding(null)}
          onAdded={async () => { setAdding(null); await refresh(); }} />
      )}
      <ConfirmDialog open={confirm === "submit"} onClose={() => setConfirm(null)} onConfirm={() => doAction("submit")} title="Enviar jornada"
        message="Cancha y horario quedarán bloqueados (cambiarlos después requerirá un ajuste con exposición de motivos). Se avisará a los jefes de delegados y de árbitros para que asignen a los oficiales. La jornada ya no podrá eliminarse." confirmLabel="Enviar" />
      <ConfirmDialog open={confirm === "close"} onClose={() => setConfirm(null)} onConfirm={() => doAction("close")} title="Cerrar jornada"
        message="Solo es posible si todos los partidos están cerrados o suspendidos. Después solo se admitirán notas o apelaciones." confirmLabel="Cerrar jornada" />
      <ConfirmDialog open={confirm === "delete"} onClose={() => setConfirm(null)} onConfirm={() => doAction("delete")} title="Eliminar borrador" danger
        message="Solo las jornadas en borrador pueden eliminarse. Los partidos vuelven al fixture sin jornada, cancha ni horario." confirmLabel="Eliminar" />
    </div>
  );
}

// ------------------------------------------------------------------ Tarjeta por cancha
function FieldCard({ field, matches: items, matchday, draft, scope, fields, categoryRules, incomplete, onSaved, onAdd }: {
  field: Field | null; matches: Match[]; matchday: Matchday; draft: boolean; scope: AssignScope; fields: Field[];
  categoryRules: (readonly [string, Match["rules"]])[];
  incomplete: Record<string, string[]>; onSaved: () => Promise<void>; onAdd?: (field: number | null) => void;
}) {
  // Por hora de inicio; los que aún no tienen hora, al final.
  const at = (m: Match) => (m.scheduled_start ? new Date(m.scheduled_start).getTime() : Number.MAX_SAFE_INTEGER);
  const sorted = [...items].sort((a, b) => at(a) - at(b) || a.id - b.id);
  const paged = usePaged(sorted);
  return (
    <section className={cn("card flex flex-col", !field && "border-gold-300 dark:border-gold-500/30")}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-white/5">
        <div>
          <h3 className="flex items-center gap-2 font-bold">
            {field ? <MapPin className="h-4 w-4 text-gold-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
            {field ? field.name : "Sin cancha asignada"}
          </h3>
          <p className="text-xs text-slate-500">
            {field
              ? <>{fieldSize(field)} · {field.is_divisible ? "divisible" : "un partido a la vez"}
                {field.is_divisible && categoryRules.length > 0 && (
                  <span className="block">A la vez: {categoryRules.map(([name, rules]) => <span key={name} className="mr-2 inline-block"><b>{capacityFor(field, rules)}</b> de {name}</span>)}</span>
                )}</>
              : "Elija la cancha de cada partido para que pase a su tarjeta."}
          </p>
        </div>
        <Badge tone={items.length ? "navy" : "slate"}>{items.length} partido(s)</Badge>
      </header>
      {!items.length ? (
        <p className="px-5 py-6 text-center text-sm text-slate-400">Sin partidos en esta cancha.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {paged.rows.map((m) => (
            <li key={m.id}>
              {draft && scope.schedule
                ? <PlanRow match={m} matchday={matchday} fields={fields} missing={incomplete[m.id]} onSaved={onSaved} />
                : m.status === "pending" && (scope.delegate || scope.referees)
                  ? <AssignRow match={m} scope={scope} onSaved={onSaved} />
                  : <ReadOnlyRow match={m} />}
            </li>
          ))}
        </ul>
      )}
      {paged.count > 20 && <Pagination page={paged.page} count={paged.count} onChange={paged.setPage} />}
      {onAdd && field && (
        <button type="button" onClick={() => onAdd(field.id)}
          className="mt-auto flex items-center justify-center gap-1.5 border-t border-dashed border-slate-200 px-5 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-gold-400 dark:hover:bg-white/[.03]">
          <Plus className="h-4 w-4" /> Agregar partidos a esta cancha
        </button>
      )}
    </section>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ state, error }: { state: SaveState; error: string }) {
  if (state === "saving") return <span className="flex items-center gap-1 text-xs text-slate-400"><Spinner className="h-3 w-3" /> Guardando…</span>;
  if (state === "saved") return <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3 w-3" /> Guardado</span>;
  if (state === "error") return <span className="flex items-center gap-1 text-xs text-crimson-600" title={error}><AlertTriangle className="h-3 w-3" /> No guardado</span>;
  return null;
}

/** Guarda al momento cada cambio y muestra su estado. */
function useAutosave(onSaved: () => Promise<void>) {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const save = async (fn: () => Promise<unknown>) => {
    setState("saving");
    try {
      await fn();
      setError("");
      setState("saved");
      await onSaved();
    } catch (e) {
      // Mensaje legible, sin el nombre técnico del campo («field: …»).
      setError(Object.values(fieldErrors(e))[0] ?? errorMessage(e));
      setState("error");
    }
  };
  return { state, error, save };
}

/** Fin estimado según las reglas: duración + descansos entre tiempos (igual que el servidor). */
function estimatedEnd(startIso: string, rules: Match["rules"]): string | null {
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return null;
  const minutes = rules.match_duration_minutes + rules.break_minutes * Math.max(0, rules.periods - 1);
  return new Date(start + minutes * 60_000).toISOString();
}

/** Partido en borrador: hora de inicio y cancha, con guardado automático. */
function PlanRow({ match, matchday, fields, missing, onSaved }: {
  match: Match; matchday: Matchday; fields: Field[]; missing?: string[]; onSaved: () => Promise<void>;
}) {
  const { state, error, save } = useAutosave(onSaved);
  const serverTime = toCaracasInput(match.scheduled_start).slice(11, 16);
  const [time, setTime] = useState(serverTime);
  const debounced = useDebounce(time, 700);
  useEffect(() => setTime(serverTime), [serverTime]);
  useEffect(() => {
    const value = normalizeTime(debounced);
    if (value === null || value === serverTime) return;  // hora incompleta o inválida: no se guarda
    // El fin y la mini cancha los recalcula el servidor a partir del inicio.
    void save(() => matches.update(match.id, value
      ? { scheduled_start: `${matchday.date}T${value}:00${UTC_OFFSET}`, sub_field: null }
      : { scheduled_start: null, scheduled_end: null, sub_field: null }));
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const normalized = normalizeTime(time);
  const startIso = normalized ? `${matchday.date}T${normalized}:00${UTC_OFFSET}` : null;
  const end = match.scheduled_end && normalized === serverTime ? match.scheduled_end : startIso ? estimatedEnd(startIso, match.rules) : null;
  const rules = match.rules;
  const selectedField = fields.find((f) => f.id === match.field);

  // El fin se calcula solo: no se pide; los equipos de la llave se completan con los resultados.
  const pendingLabels = [...new Set((missing ?? []).filter((f) => f !== "scheduled_end" && f !== "matchday")
    .map((f) => (f === "home" || f === "away" ? "equipos por definir" : FIELD_LABELS[f] ?? f)))];
  return (
    <div className="flex gap-3 px-5 py-3">
      <div className="w-36 shrink-0">
        <input type="time" step={60} aria-label="Hora de inicio" className={cn("input py-1.5 text-sm",
          normalized === null ? "input-error" : !time && "border-amber-300 dark:border-amber-500/40")}
          value={time} onChange={(e) => setTime(e.target.value)} />
        <p className="mt-1 text-[11px] text-slate-500" title={`${rules.periods} tiempo(s) · ${rules.match_duration_minutes}' de juego + ${rules.break_minutes}' de descanso`}>
          {normalized === null ? <span className="text-crimson-600">Hora inválida (HH:MM)</span> : end ? <>Fin ≈ <b>{formatTime(end)}</b></> : `Dura ${rules.match_duration_minutes + rules.break_minutes * Math.max(0, rules.periods - 1)}'`}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <Link to={`/app/partidos/${match.id}`} className="block truncate font-semibold hover:underline">{match.home_name} <span className="text-slate-400">vs</span> {match.away_name}</Link>
        <p className="truncate text-xs text-slate-500">{matchMeta(match)}{match.sub_field && selectedField ? ` · mini cancha ${match.sub_field} de ${capacityFor(selectedField, match.rules)}` : ""}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <div className="w-44">
            <SelectMenu value={match.field} clearable placeholder="Elegir cancha…" className="py-1 text-xs"
              onChange={(v) => save(() => matches.update(match.id, { field: v == null ? null : Number(v), sub_field: null }))}
              options={fields.map((f) => ({ value: f.id, label: f.name, hint: `${capacityFor(f, match.rules)} a la vez` }))} />
          </div>
          <SaveIndicator state={state} error={error} />
          {state !== "error" && pendingLabels.length > 0 && <span className="text-[11px] text-amber-600">Falta: {pendingLabels.join(", ")}</span>}
        </div>
        {state === "error" && <p className="error-text">{error}</p>}
      </div>
      <button className="btn-ghost btn-sm h-fit p-1.5" title="Quitar de la jornada" aria-label="Quitar de la jornada"
        onClick={() => save(() => matches.update(match.id, { matchday: null }))}><X className="h-4 w-4" /></button>
    </div>
  );
}

function ReadOnlyRow({ match }: { match: Match }) {
  return (
    <Link to={`/app/partidos/${match.id}`} className="flex flex-col gap-2 px-5 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-center dark:hover:bg-white/[.03]">
      <div className="w-24 shrink-0 whitespace-nowrap font-display text-lg font-bold text-navy-900 dark:text-gold-400">{formatTime(match.scheduled_start)}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{match.home_name} <span className="text-slate-400">vs</span> {match.away_name}</p>
        <p className="truncate text-xs text-slate-500">{matchMeta(match)} · Delegado: {match.delegate_name ?? "sin asignar"} · Árbitro: {match.referee_name ?? "sin asignar"}</p>
      </div>
      {match.home_score != null && <Badge tone="navy">{match.home_score} - {match.away_score}</Badge>}
      <StatusBadge status={match.status} label={match.status_display} />
    </Link>
  );
}

/** Partido enviado y pendiente: los jefes eligen a sus oficiales y se asignan al elegir. */
function AssignRow({ match, scope, onSaved }: { match: Match; scope: AssignScope; onSaved: () => Promise<void> }) {
  const { state, error, save } = useAutosave(onSaved);
  const delegatesQ = useQuery({ queryKey: ["options", "delegates"], queryFn: () => delegates.all({ is_active: true }), staleTime: 60_000 });
  const refereesQ = useQuery({ queryKey: ["options", "referees"], queryFn: () => referees.all({ is_active: true }), staleTime: 60_000 });
  const refs = refereesQ.data ?? [];
  type Key = "delegate" | "referee" | "assistant_referee_1" | "assistant_referee_2";
  const select = (key: Key, label: string, options: { id: number; full_name: string }[]): ReactNode => {
    const editable = key === "delegate" ? scope.delegate : scope.referees;
    return (
      <div>
        <label className="label">{label}</label>
        <SelectMenu value={match[key]} clearable placeholder="Seleccione…" className="py-1.5 text-xs" disabled={!editable}
          onChange={(v) => save(() => matches.assignOfficials(match.id, { [key]: v == null ? null : Number(v) }))}
          options={options.map((o) => ({ value: o.id, label: o.full_name }))} />
      </div>
    );
  };

  return (
    <div className="px-5 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Link to={`/app/partidos/${match.id}`} className="font-semibold hover:underline">{match.home_name} <span className="text-slate-400">vs</span> {match.away_name}
          <span className="ml-2 text-xs font-normal text-slate-500"><Lock className="mr-1 inline h-3 w-3" />{formatTime(match.scheduled_start)}–{formatTime(match.scheduled_end)} · {matchMeta(match)}</span></Link>
        <span className="flex items-center gap-2">
          <SaveIndicator state={state} error={error} />
          {match.missing_officials.length
            ? <Badge tone="amber"><AlertTriangle className="h-3 w-3" /> Falta: {match.missing_officials.map((f) => FIELD_LABELS[f] ?? f).join(", ")}</Badge>
            : <Badge tone="sky"><CheckCircle2 className="h-3 w-3" /> Esperando confirmaciones</Badge>}
        </span>
      </div>
      {state === "error" && <p className="error-text mb-2">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {select("delegate", "Delegado", delegatesQ.data ?? [])}
        {select("referee", "Árbitro principal", refs)}
        {match.rules.referees_required >= 2 && select("assistant_referee_1", "Asistente 1", refs)}
        {match.rules.referees_required >= 3 && select("assistant_referee_2", "Asistente 2", refs)}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Agregar partidos
type PhaseFilter = "all" | "groups" | "knockout";
type LegFilter = "all" | "single" | "1" | "2";
type GroupBy = "round" | "phase" | "category";

/** Partidos del fixture sin jornada, en tabla con búsqueda, filtros y agrupación; se pueden dejar ya en una cancha. */
function AddMatchesModal({ matchday, presetField, fields, onClose, onAdded }: {
  matchday: Matchday; presetField: number | null; fields: Field[]; onClose: () => void; onAdded: () => Promise<void>;
}) {
  const toast = useToast();
  const tournamentId = matchday.tournament;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [phase, setPhase] = useState<PhaseFilter>("all");
  const [sub, setSub] = useState<string | null>(null);
  const [leg, setLeg] = useState<LegFilter>("all");
  const [round, setRound] = useState<number | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("round");
  const [field, setField] = useState<number | null>(presetField);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const pending = useQuery({ queryKey: ["matches", "unscheduled", tournamentId], queryFn: () => matches.all({ tournament: tournamentId, unscheduled: 1, status: "draft", ordering: "round_number" }) });
  const regs = useQuery({ queryKey: ["registrations", tournamentId], queryFn: () => registrations.all({ tournament: tournamentId, is_active: true }) });
  const grps = useQuery({ queryKey: ["groups", tournamentId], queryFn: () => groupsService.all({ tournament: tournamentId, is_active: true }) });
  const groupOf = useMemo(() => groupResolver(regs.data ?? []), [regs.data]);
  const groupName = useMemo(() => new Map((grps.data ?? []).map((g) => [g.id, g.name])), [grps.data]);
  const all = useMemo(() => pending.data ?? [], [pending.data]);

  const categories = [...new Map(all.map((m) => [m.category, m.category_name])).entries()];
  const multiCategory = categories.length > 1;
  const inCategory = all.filter((m) => category == null || m.category === category);
  const phaseLabel = (m: Match) => {
    if (m.stage !== "regular") return m.stage_display;
    const g = groupOf(m);
    return g != null ? groupName.get(g) ?? "Grupo" : "Fase regular";
  };
  // Subcategorías: los grupos dentro de la fase de grupos y las rondas dentro de la eliminatoria.
  const subOptions = phase === "groups"
    ? [...new Map(inCategory.filter((m) => m.stage === "regular" && groupOf(m) != null)
      .map((m) => [`g:${groupOf(m)}`, `${multiCategory && category == null ? `${m.category_name} · ` : ""}${phaseLabel(m)}`])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
    : phase === "knockout"
      ? KNOCKOUT_ORDER.filter((s) => inCategory.some((m) => m.stage === s)).map((s) => [s, inCategory.find((m) => m.stage === s)!.stage_display] as [string, string])
      : [];
  const rounds = [...new Set(inCategory.filter((m) => m.stage === "regular").map((m) => m.round_number))].sort((a, b) => a - b);
  const hasLegs = all.some((m) => m.leg != null);

  const term = search.trim().toLocaleLowerCase();
  const filtered = inCategory
    .filter((m) => phase === "all" || (phase === "groups" ? m.stage === "regular" : m.stage !== "regular"))
    .filter((m) => sub == null || phaseKey(m, groupOf) === sub)
    .filter((m) => leg === "all" || (leg === "single" ? m.leg == null : String(m.leg) === leg))
    .filter((m) => round == null || (m.stage === "regular" && m.round_number === round))
    .filter((m) => !term || `${m.home_name} ${m.away_name}`.toLocaleLowerCase().includes(term));
  const sectionOf = (m: Match) => groupBy === "category" ? m.category_name
    : groupBy === "phase" ? `${multiCategory ? `${m.category_name} · ` : ""}${phaseLabel(m)}`
      : m.stage === "regular" ? `Fecha ${m.round_number}` : m.stage_display;
  const order = (m: Match) => (m.stage === "regular" ? 0 : 1000 + KNOCKOUT_ORDER.indexOf(m.stage) * 10) + m.round_number;
  const sorted = [...filtered].sort((a, b) => sectionOf(a).localeCompare(sectionOf(b), "es", { numeric: true })
    || order(a) - order(b) || (a.bracket_position ?? 0) - (b.bracket_position ?? 0) || (a.leg ?? 0) - (b.leg ?? 0) || a.id - b.id);
  const paged = usePaged(sorted);
  const allChosen = filtered.length > 0 && filtered.every((m) => selected.has(m.id));
  const reset = () => paged.setPage(1);
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const add = async () => {
    setBusy(true);
    try {
      const res = await matchdays.addMatches(matchday.id, [...selected], field);
      toast.success(`${res.added} partido(s) agregado(s)${field ? ` a ${fields.find((f) => f.id === field)?.name ?? "la cancha"}` : ""}.${res.skipped ? ` ${res.skipped} omitido(s).` : ""}`);
      await onAdded();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  let lastSection = "";
  return (
    <Modal open onClose={onClose} title="Agregar partidos a la jornada" subtitle="Partidos del fixture que aún no tienen jornada" size="xl" footer={<>
      <div className="mr-auto flex items-center gap-2">
        <span className="text-sm text-slate-500">Cancha:</span>
        <div className="w-52"><SelectMenu value={field} clearable placeholder="Elegir después" onChange={(v) => setField(v == null ? null : Number(v))}
          options={fields.map((f) => ({ value: f.id, label: f.name, hint: `${fieldSize(f)}${f.is_divisible ? " · divisible" : ""}` }))} /></div>
      </div>
      <button className="btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn-primary" disabled={!selected.size || busy} onClick={add}>{busy && <Spinner className="h-4 w-4" />}Agregar {selected.size || ""}</button>
    </>}>
      {pending.isLoading ? <div className="grid h-32 place-items-center"><Spinner /></div> : !all.length ? (
        <EmptyState title="No hay partidos pendientes" message="Todos los partidos del fixture ya tienen jornada, o falta generar el fixture del torneo." />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={(v) => { setSearch(v); reset(); }} placeholder="Buscar equipo…" />
            {multiCategory && (
              <div className="w-44"><SelectMenu value={category} clearable placeholder="Todas las categorías"
                onChange={(v) => { setCategory(v == null ? null : Number(v)); setSub(null); setRound(null); reset(); }}
                options={categories.map(([value, label]) => ({ value, label }))} /></div>
            )}
            {rounds.length > 1 && (
              <div className="w-36"><SelectMenu value={round} clearable placeholder="Toda fecha" onChange={(v) => { setRound(v == null ? null : Number(v)); reset(); }}
                options={rounds.map((r) => ({ value: r, label: `Fecha ${r}` }))} /></div>
            )}
            {hasLegs && (
              <div className="w-40"><SelectMenu value={leg} onChange={(v) => { setLeg((v ?? "all") as LegFilter); reset(); }}
                options={[{ value: "all", label: "Ida y vuelta: todos" }, { value: "single", label: "Partido único" }, { value: "1", label: "Solo ida" }, { value: "2", label: "Solo vuelta" }]} /></div>
            )}
            <div className="ml-auto w-44"><SelectMenu value={groupBy} onChange={(v) => setGroupBy((v ?? "round") as GroupBy)}
              options={[{ value: "round", label: "Agrupar por fecha" }, { value: "phase", label: "Agrupar por fase" }, { value: "category", label: "Agrupar por categoría" }]} /></div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Fase</span>
            {([["all", "Todas"], ["groups", "Fase de grupos"], ["knockout", "Eliminatoria"]] as [PhaseFilter, string][]).map(([value, label]) => (
              <Chip key={value} active={phase === value} onClick={() => { setPhase(value); setSub(null); reset(); }}>{label}</Chip>
            ))}
            {subOptions.length > 0 && <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-white/10" />}
            {subOptions.map(([value, label]) => (
              <Chip key={value} small active={sub === value} onClick={() => { setSub(sub === value ? null : value); reset(); }}>{label}</Chip>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
            <div className="table-wrap max-h-[52vh] overflow-y-auto">
              <table className="table">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="w-10"><input type="checkbox" className="h-4 w-4 accent-navy-700" aria-label="Seleccionar todos los filtrados" checked={allChosen}
                      onChange={() => setSelected((s) => { const n = new Set(s); filtered.forEach((m) => (allChosen ? n.delete(m.id) : n.add(m.id))); return n; })} /></th>
                    <th>Partido</th><th>Categoría</th><th>Fase</th><th>Fecha</th><th>Ida / vuelta</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((m) => {
                    const section = sectionOf(m);
                    const header = section !== lastSection;
                    lastSection = section;
                    return [
                      header && (
                        <tr key={`h-${section}`}><td colSpan={6} className="bg-slate-50/80 py-1.5 text-xs font-bold uppercase tracking-wide text-navy-900 dark:bg-white/[.03] dark:text-gold-400">
                          {section} <span className="font-normal normal-case text-slate-400">({sorted.filter((x) => sectionOf(x) === section).length})</span></td></tr>
                      ),
                      <tr key={m.id} className={cn("cursor-pointer", selected.has(m.id) && "bg-gold-50/70 dark:bg-gold-500/10")} onClick={() => toggle(m.id)}>
                        <td><input type="checkbox" className="h-4 w-4 accent-navy-700" checked={selected.has(m.id)} onChange={() => toggle(m.id)} onClick={(e) => e.stopPropagation()} aria-label="Seleccionar partido" /></td>
                        <td className="font-semibold">{m.home_name} <span className="font-normal text-slate-400">vs</span> {m.away_name}</td>
                        <td><Badge tone="gold">{m.category_name}</Badge></td>
                        <td className="text-sm">{phaseLabel(m)}</td>
                        <td className="text-sm">{m.stage === "regular" ? `Fecha ${m.round_number}` : `Cruce ${m.bracket_position ?? "—"}`}</td>
                        <td className="text-sm">{m.leg_display ?? <span className="text-slate-400">Único</span>}</td>
                      </tr>,
                    ];
                  })}
                </tbody>
              </table>
              {!filtered.length && <p className="px-5 py-8 text-center text-sm text-slate-400">Ningún partido coincide con los filtros.</p>}
            </div>
            <Pagination page={paged.page} count={paged.count} onChange={paged.setPage} />
          </div>
          {selected.size > 0 && <p className="text-sm text-slate-500"><b>{selected.size}</b> seleccionado(s) · <button className="hover:underline" onClick={() => setSelected(new Set())}>limpiar</button></p>}
        </div>
      )}
    </Modal>
  );
}

function Chip({ active, small, onClick, children }: { active: boolean; small?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("rounded-full border font-semibold transition", small ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs", active
        ? "border-navy-700 bg-navy-700 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-navy-950"
        : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300")}>
      {children}
    </button>
  );
}
