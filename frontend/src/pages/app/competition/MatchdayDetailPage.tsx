import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, Plus, Send, Trash2, X } from "lucide-react";

import { DateTimeInput } from "@/components/forms";
import { Can } from "@/components/layout/Guards";
import { Alert, Badge, ConfirmDialog, EmptyState, Modal, PageHeader, PageLoader, SelectMenu, Spinner, StatusBadge, Toggle } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { delegates, fields as fieldsService, matchdays, matches, referees, tournaments } from "@/services";
import type { Match } from "@/types";
import { formatDateTime, formatLongDate, formatTime } from "@/utils/datetime";
import { errorMessage, fieldErrors } from "@/utils/errors";
import { FIELD_LABELS } from "@/utils/labels";

export function MatchdayDetailPage() {
  const id = Number(useParams().id);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<"submit" | "close" | "delete" | null>(null);
  const canSchedule = useCan("competition.change_match");

  const md = useQuery({ queryKey: ["matchdays", id], queryFn: () => matchdays.get(id) });
  const list = useQuery({ queryKey: ["matches", "matchday", id], queryFn: () => matches.all({ matchday: id, ordering: "scheduled_start" }), refetchInterval: 20_000 });
  const tournament = useQuery({ queryKey: ["tournaments", md.data?.tournament], queryFn: () => tournaments.get(md.data!.tournament), enabled: Boolean(md.data) });
  const completeness = useQuery({ queryKey: ["matchdays", id, "completeness", list.data], queryFn: () => matchdays.completeness(id), enabled: md.data?.status === "draft" });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["matches"] });
    await queryClient.invalidateQueries({ queryKey: ["matchdays"] });
  };

  if (md.isLoading || !md.data) return <PageLoader />;
  const matchday = md.data;
  const draft = matchday.status === "draft";

  const doAction = async (action: "submit" | "close" | "delete") => {
    try {
      if (action === "submit") await matchdays.submit(id);
      if (action === "close") await matchdays.close(id);
      if (action === "delete") {
        await matchdays.remove(id);
        window.history.back();
        return;
      }
      toast.success(action === "submit" ? "Jornada enviada: se notificó a delegados, árbitros y equipos." : "Jornada cerrada.");
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  };

  return (
    <div>
      <Link to="/app/jornadas" className="btn-ghost mb-4 -ml-3"><ArrowLeft className="h-4 w-4" /> Jornadas</Link>
      <PageHeader title={matchday.name || `Jornada ${matchday.number}`} subtitle={<span className="capitalize">{matchday.tournament_name} · {formatLongDate(matchday.date)}</span>}
        actions={<>
          <StatusBadge status={matchday.status} label={matchday.status_display} />
          {draft && <Can perm="competition.delete_matchday"><button className="btn-ghost text-crimson-600" onClick={() => setConfirm("delete")}><Trash2 className="h-4 w-4" /></button></Can>}
          {draft && canSchedule && <button className="btn-outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Agregar partidos</button>}
          {draft && <Can perm="competition.submit_matchday"><button className="btn-gold" disabled={!completeness.data?.ready} onClick={() => setConfirm("submit")}><Send className="h-4 w-4" /> Enviar jornada</button></Can>}
          {matchday.status !== "draft" && matchday.status !== "closed" && <Can perm="competition.close_matchday"><button className="btn-primary" onClick={() => setConfirm("close")}><Lock className="h-4 w-4" /> Cerrar jornada</button></Can>}
        </>} />

      {draft && completeness.data && (
        <div className="mb-6">
          {completeness.data.ready
            ? <Alert tone="success" title="Jornada completa">Todos los campos están llenos. Al enviarla se bloquean las asignaciones y se solicita confirmación.</Alert>
            : <Alert tone="warning" title="La jornada permanece en borrador">Complete cancha, horario, delegado y terna arbitral de cada partido para poder enviarla.</Alert>}
        </div>
      )}
      {matchday.status === "submitted" && <div className="mb-6"><Alert tone="info" title="Esperando confirmaciones">La jornada será válida cuando el delegado y los árbitros de cada partido confirmen su asistencia.</Alert></div>}

      {!list.data?.length && !list.isLoading ? <div className="card"><EmptyState title="Sin partidos" message="Agregue partidos del fixture a esta jornada." /></div> : (
        <div className="space-y-4">
          {(list.data ?? []).map((m) => draft && canSchedule
            ? <ScheduleRow key={m.id} match={m} referees_required={tournament.data?.referees_required ?? 3} incomplete={completeness.data?.incomplete[m.id]} onSaved={refresh} />
            : <ReadOnlyRow key={m.id} match={m} />)}
        </div>
      )}

      <AddMatchesModal open={adding} onClose={() => setAdding(false)} tournament={matchday.tournament} matchday={id} onAdded={refresh} />
      <ConfirmDialog open={confirm === "submit"} onClose={() => setConfirm(null)} onConfirm={() => doAction("submit")} title="Enviar jornada"
        message="Las asignaciones quedarán bloqueadas. Cualquier cambio posterior requerirá un ajuste con exposición de motivos y conservará el registro anterior." confirmLabel="Enviar" />
      <ConfirmDialog open={confirm === "close"} onClose={() => setConfirm(null)} onConfirm={() => doAction("close")} title="Cerrar jornada"
        message="Solo es posible si todos los partidos están cerrados o suspendidos. Después solo se admitirán notas o apelaciones." confirmLabel="Cerrar jornada" />
      <ConfirmDialog open={confirm === "delete"} onClose={() => setConfirm(null)} onConfirm={() => doAction("delete")} title="Eliminar borrador" danger
        message="Solo las jornadas en borrador pueden eliminarse. Los partidos vuelven al fixture sin jornada." confirmLabel="Eliminar" />
    </div>
  );
}

function ReadOnlyRow({ match }: { match: Match }) {
  return (
    <Link to={`/app/partidos/${match.id}`} className="card card-hover block p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="w-28 whitespace-nowrap font-display text-lg font-bold text-navy-900 dark:text-gold-400">{formatTime(match.scheduled_start)}</div>
        <div className="flex-1">
          <p className="font-semibold">{match.home_name} <span className="text-slate-400">vs</span> {match.away_name}</p>
          <p className="text-xs text-slate-500">{match.field_name}{match.sub_field ? ` · mini ${match.sub_field}` : ""} · Delegado: {match.delegate_name} · Árbitro: {match.referee_name}</p>
        </div>
        {match.home_score != null && <Badge tone="navy">{match.home_score} - {match.away_score}</Badge>}
        <StatusBadge status={match.status} label={match.status_display} />
      </div>
    </Link>
  );
}

function OfficialSelect({ value, onChange, options, placeholder }: { value: number | null; onChange: (v: number | null) => void; options: { id: number; full_name: string }[]; placeholder: string }) {
  return (
    <SelectMenu value={value} onChange={(v) => onChange(v == null ? null : Number(v))} clearable placeholder={placeholder} className="py-1.5 text-xs"
      options={options.map((o) => ({ value: o.id, label: o.full_name }))} />
  );
}

function ScheduleRow({ match, referees_required, incomplete, onSaved }: { match: Match; referees_required: number; incomplete?: string[]; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [form, setForm] = useState({
    field: match.field, scheduled_start: match.scheduled_start, delegate: match.delegate, referee: match.referee,
    assistant_referee_1: match.assistant_referee_1, assistant_referee_2: match.assistant_referee_2,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const opts = { is_active: true };
  const fieldsQ = useQuery({ queryKey: ["options", "fields"], queryFn: () => fieldsService.all(opts), staleTime: 60_000 });
  const delegatesQ = useQuery({ queryKey: ["options", "delegates"], queryFn: () => delegates.all(opts), staleTime: 60_000 });
  const refereesQ = useQuery({ queryKey: ["options", "referees"], queryFn: () => referees.all(opts), staleTime: 60_000 });
  const set = (key: keyof typeof form, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      // Fin y mini cancha se recalculan en el servidor (duración del torneo + primera mini cancha libre)
      await matches.update(match.id, { ...form, scheduled_end: null, sub_field: null });
      toast.success("Partido programado (validado contra solapamientos).");
      await onSaved();
    } catch (e) {
      setErrors(fieldErrors(e));
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const removeFromMatchday = async () => {
    try {
      await matches.update(match.id, { matchday: null });
      await onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const refs = refereesQ.data ?? [];
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link to={`/app/partidos/${match.id}`} className="font-semibold hover:underline">{match.home_name} <span className="text-slate-400">vs</span> {match.away_name}
          <span className="ml-2 text-xs font-normal text-slate-500">Fecha {match.round_number}{match.group_name ? ` · ${match.group_name}` : ""}</span></Link>
        <div className="flex items-center gap-2">
          {incomplete?.length ? <Badge tone="amber"><AlertTriangle className="h-3 w-3" /> Falta: {incomplete.map((f) => FIELD_LABELS[f] ?? f).join(", ")}</Badge> : <Badge tone="emerald"><CheckCircle2 className="h-3 w-3" /> Completo</Badge>}
          <button className="btn-ghost btn-sm" onClick={removeFromMatchday} title="Quitar de la jornada"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">Cancha</label>
          <SelectMenu value={form.field ?? null} onChange={(v) => set("field", v == null ? null : Number(v))} clearable className="py-1.5 text-xs" invalid={Boolean(errors.field)}
            options={(fieldsQ.data ?? []).map((f) => ({ value: f.id, label: f.name, hint: `Capacidad: ${f.capacity} partido(s) simultáneo(s)` }))} />
          {errors.field && <p className="error-text">{errors.field}</p>}
        </div>
        <div>
          <label className="label">Inicio</label>
          <DateTimeInput value={form.scheduled_start} onChange={(v) => set("scheduled_start", v)} invalid={Boolean(errors.scheduled_start)} />
          {match.scheduled_end && <p className="help">Fin: {formatTime(match.scheduled_end)}</p>}
        </div>
        <div>
          <label className="label">Delegado</label>
          <OfficialSelect value={form.delegate} onChange={(v) => set("delegate", v)} options={delegatesQ.data ?? []} placeholder="Seleccione…" />
          {errors.delegate && <p className="error-text">{errors.delegate}</p>}
        </div>
        <div>
          <label className="label">Árbitro principal</label>
          <OfficialSelect value={form.referee} onChange={(v) => set("referee", v)} options={refs} placeholder="Seleccione…" />
          {errors.referee && <p className="error-text">{errors.referee}</p>}
        </div>
        {referees_required >= 2 && (
          <div>
            <label className="label">Asistente 1</label>
            <OfficialSelect value={form.assistant_referee_1} onChange={(v) => set("assistant_referee_1", v)} options={refs} placeholder="Seleccione…" />
            {errors.assistant_referee_1 && <p className="error-text">{errors.assistant_referee_1}</p>}
          </div>
        )}
        {referees_required >= 3 && (
          <div>
            <label className="label">Asistente 2</label>
            <OfficialSelect value={form.assistant_referee_2} onChange={(v) => set("assistant_referee_2", v)} options={refs} placeholder="Seleccione…" />
            {errors.assistant_referee_2 && <p className="error-text">{errors.assistant_referee_2}</p>}
          </div>
        )}
        <div className="flex items-end lg:col-span-2 lg:justify-end">
          {(errors.home || errors.sub_field) && <p className="error-text mr-3">{errors.home || errors.sub_field}</p>}
          <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Guardar</button>
        </div>
      </div>
      {match.scheduled_start && <p className="mt-2 text-xs text-slate-400">Programado: {formatDateTime(match.scheduled_start)}{match.sub_field ? ` · mini cancha ${match.sub_field}` : ""}</p>}
    </div>
  );
}

function AddMatchesModal({ open, onClose, tournament, matchday, onAdded }: { open: boolean; onClose: () => void; tournament: number; matchday: number; onAdded: () => Promise<void> }) {
  const toast = useToast();
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["matches", "unscheduled", tournament], queryFn: () => matches.all({ tournament, unscheduled: 1, status: "draft", ordering: "round_number" }), enabled: open });
  const add = async () => {
    setBusy(true);
    try {
      for (const id of selected) await matches.update(id, { matchday });
      toast.success(`${selected.length} partido(s) agregado(s).`);
      setSelected([]);
      await onAdded();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Agregar partidos a la jornada" subtitle="Partidos del fixture aún sin jornada" footer={
      <><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!selected.length || busy} onClick={add}>{busy && <Spinner className="h-4 w-4" />}Agregar {selected.length || ""}</button></>
    }>
      {!data.length ? <EmptyState title="No hay partidos pendientes" message="Genere el fixture desde el torneo." /> : (
        <ul className="space-y-2">
          {data.map((m) => (
            <li key={m.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm transition hover:border-gold-400 dark:border-white/10">
                <Toggle checked={selected.includes(m.id)} label="Agregar a la jornada"
                  onChange={(on) => setSelected((s) => on ? [...s, m.id] : s.filter((x) => x !== m.id))} />
                <span className="flex-1"><b>{m.home_name}</b> vs <b>{m.away_name}</b></span>
                <Badge tone="gold">{m.category_name}</Badge><Badge>Fecha {m.round_number}</Badge>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
