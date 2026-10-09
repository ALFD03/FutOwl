import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Pause, Play, Square, StickyNote } from "lucide-react";

import { Alert, Card, CardHeader, ConfirmDialog, Modal, Spinner } from "@/components/ui";
import { useLiveInterval, useToast } from "@/hooks";
import { matches } from "@/services";
import type { EventType, LiveState, Match, MatchEvent, TeamLiveState } from "@/types";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { EVENT_META } from "@/utils/labels";

import { EventTimeline } from "./EventTimeline";
import { ScoreBoard } from "./ScoreBoard";

type PlayerMap = Record<number, { name: string; number: number }>;
interface Pending { type: EventType; team: number; side: "home" | "away" }

const PLAY_ACTIONS: EventType[] = ["goal", "penalty_goal", "own_goal", "yellow_card", "red_card", "substitution"];

/** Mesa técnica: el delegado registra la cronología completa en tiempo real. */
export function LiveConsole({ match, showScoreboard = true }: { match: Match; showScoreboard?: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const interval = useLiveInterval(3_000);
  const stateQ = useQuery({ queryKey: ["matches", match.id, "state"], queryFn: () => matches.state(match.id), refetchInterval: interval });
  const eventsQ = useQuery({ queryKey: ["matches", match.id, "events"], queryFn: () => matches.events(match.id), refetchInterval: interval });
  const lineupsQ = useQuery({ queryKey: ["matches", match.id, "lineups"], queryFn: () => matches.lineups(match.id) });
  const [pending, setPending] = useState<Pending | null>(null);
  const [annulling, setAnnulling] = useState<MatchEvent | null>(null);
  const [noteOpen, setNoteOpen] = useState<"incident" | "note" | null>(null);
  const [busy, setBusy] = useState(false);

  const players = useMemo(() => {
    const map: PlayerMap = {};
    (lineupsQ.data ?? []).forEach((l) => l.players.forEach((p) => { map[p.team_player] = { name: p.player_name, number: p.shirt_number }; }));
    return map;
  }, [lineupsQ.data]);

  const state = stateQ.data;
  const record = async (data: Record<string, unknown>, success?: string) => {
    setBusy(true);
    try {
      const created = await matches.recordEvent(match.id, data);
      toast.success(success ?? `${EVENT_META[data.type as EventType].label} registrado${created.length > 1 ? " (+ expulsión por doble amarilla)" : ""}.`);
      await queryClient.invalidateQueries({ queryKey: ["matches", match.id] });
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <Spinner />;
  if (!state.can_operate) return <Alert tone="info">Solo el delegado asignado (o una autoridad habilitada) puede operar la mesa técnica de este partido.</Alert>;
  if (!["confirmed", "in_progress", "finished"].includes(state.status ?? "")) {
    return <Alert tone="warning">La mesa técnica se habilita cuando el partido está confirmado por el delegado y la terna arbitral.</Alert>;
  }
  const finished = state.status === "finished";
  const playing = state.phase === "playing";
  const teams = [{ side: "home" as const, id: match.home, name: match.home_name, st: state.home }, { side: "away" as const, id: match.away, name: match.away_name, st: state.away }];

  return (
    <div className="space-y-6">
      {showScoreboard && <ScoreBoard homeName={match.home_name} awayName={match.away_name} homeLogo={match.home_logo} awayLogo={match.away_logo}
        homeScore={state.kicked_off ? state.home_score : null} awayScore={state.kicked_off ? state.away_score : null}
        status={state.status ?? match.status} statusLabel={match.status_display} phase={state.phase} minute={state.minute} period={state.current_period}
        subtitle="Mesa técnica · actualización en tiempo real" />}

      {!state.kicked_off && <PreMatch state={state} teams={teams} busy={busy} onRecord={record} />}

      {state.kicked_off && (
        <Card>
          <CardHeader title="Control del partido" subtitle={finished ? "Partido finalizado: solo correcciones con motivo, anulaciones y notas" : `Tiempo ${state.current_period}`}
            actions={!finished && <>
              {playing && <button className="btn-outline btn-sm" disabled={busy} onClick={() => record({ type: "period_end" })}><Pause className="h-4 w-4" /> Fin de tiempo</button>}
              {state.phase === "break" && <button className="btn-primary btn-sm" disabled={busy} onClick={() => record({ type: "period_start" })}><Play className="h-4 w-4" /> Iniciar siguiente tiempo</button>}
              <FinishButton busy={busy} onConfirm={() => record({ type: "match_end" })} />
            </>} />
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {teams.map((t) => (
              <div key={t.side} className={cn("rounded-2xl border p-4", t.side === "home" ? "border-navy-200 dark:border-navy-500/30" : "border-crimson-200 dark:border-crimson-500/30")}>
                <p className="mb-3 font-display font-bold">{t.name} <span className="text-xs font-normal text-slate-500">· {t.st.substitutions} cambios · 🟨 {t.st.yellow} · 🟥 {t.st.red}</span></p>
                <div className="grid grid-cols-3 gap-2">
                  {PLAY_ACTIONS.map((type) => (
                    <button key={type} disabled={busy || (!playing && !finished && !["yellow_card", "red_card"].includes(type))}
                      onClick={() => setPending({ type, team: t.id, side: t.side })}
                      className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-3 text-xs font-semibold transition-all hover:-translate-y-0.5 hover:border-gold-400 hover:shadow-soft disabled:opacity-40 dark:border-white/10 dark:bg-ink-700">
                      <span className="text-xl">{EVENT_META[type].emoji}</span>{EVENT_META[type].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3 dark:border-white/5">
            <button className="btn-ghost btn-sm" onClick={() => setNoteOpen("incident")}><Flag className="h-4 w-4" /> Incidencia</button>
            <button className="btn-ghost btn-sm" onClick={() => setNoteOpen("note")}><StickyNote className="h-4 w-4" /> Nota</button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Cronología completa" subtitle="Los eventos no se editan ni se borran: se anulan con motivo" />
        <div className="card-body"><EventTimeline events={eventsQ.data ?? []} homeTeamId={match.home} showInternal onAnnul={(e) => setAnnulling(e)} /></div>
      </Card>

      {pending && <EventModal pending={pending} state={state} players={players} finished={finished} busy={busy} onClose={() => setPending(null)}
        onSubmit={async (data) => { if (await record({ type: pending.type, team: pending.team, ...data })) setPending(null); }} />}
      <ConfirmDialog open={annulling !== null} onClose={() => setAnnulling(null)} title={`Anular evento #${annulling?.sequence ?? ""}`} danger requireReason minReason={5}
        reasonLabel="Motivo de la anulación" confirmLabel="Anular" message={annulling && `${annulling.type_display}${annulling.player_name ? ` · ${annulling.player_name}` : ""}. El evento original se conserva marcado como anulado.`}
        onConfirm={async (reason) => { if (!(await record({ type: "annulment", annuls: annulling!.id, notes: reason }, "Evento anulado."))) throw new Error(); }} />
      <ConfirmDialog open={noteOpen !== null} onClose={() => setNoteOpen(null)} title={noteOpen === "incident" ? "Registrar incidencia" : "Agregar nota"} requireReason minReason={3}
        reasonLabel="Descripción" confirmLabel="Registrar"
        onConfirm={async (notes) => { if (!(await record({ type: noteOpen, notes }))) throw new Error(); }} />
    </div>
  );
}

function PreMatch({ state, teams, busy, onRecord }: {
  state: LiveState; teams: { side: "home" | "away"; id: number; name: string; st: TeamLiveState }[]; busy: boolean;
  onRecord: (data: Record<string, unknown>, success?: string) => Promise<boolean>;
}) {
  const steps = [
    { label: "Llegada del delegado", done: state.delegate_arrived, action: () => onRecord({ type: "delegate_arrival" }), enabled: true },
    ...teams.flatMap((t) => [
      { label: `Llegada de ${t.name}`, done: t.st.arrived, action: () => onRecord({ type: "team_arrival", team: t.id }), enabled: state.delegate_arrived },
      { label: `Documentación de ${t.name} coincide con lo cargado`, done: t.st.documents_verified, action: () => onRecord({ type: "documents_verified", team: t.id }), enabled: t.st.arrived },
    ]),
  ];
  const ready = steps.every((s) => s.done);
  return (
    <Card>
      <CardHeader title="Protocolo previo al partido" subtitle="Cada paso queda registrado con hora exacta (UTC-4)" />
      <ol className="divide-y divide-slate-100 dark:divide-white/5">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-3 px-5 py-3">
            <span className={cn("grid h-7 w-7 place-items-center rounded-full text-xs font-bold", step.done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10")}>{step.done ? "✓" : i + 1}</span>
            <span className={cn("flex-1 text-sm", step.done && "text-slate-400 line-through")}>{step.label}</span>
            {!step.done && <button className="btn-outline btn-sm" disabled={busy || !step.enabled} onClick={() => void step.action()}>Registrar</button>}
          </li>
        ))}
      </ol>
      <div className="flex justify-end border-t border-slate-100 px-5 py-4 dark:border-white/5">
        <button className="btn-gold" disabled={!ready || busy} onClick={() => void onRecord({ type: "kickoff" }, "¡Partido iniciado!")}><Play className="h-4 w-4" /> Iniciar partido</button>
      </div>
    </Card>
  );
}

function FinishButton({ busy, onConfirm }: { busy: boolean; onConfirm: () => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-danger btn-sm" disabled={busy} onClick={() => setOpen(true)}><Square className="h-4 w-4" /> Fin del partido</button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} title="Finalizar partido" confirmLabel="Finalizar" danger
        message="Se notificará al delegado y al árbitro para enviar sus informes. Luego solo se admitirán correcciones con motivo."
        onConfirm={async () => { if (!(await onConfirm())) throw new Error(); }} />
    </>
  );
}

function EventModal({ pending, state, players, finished, busy, onClose, onSubmit }: {
  pending: Pending; state: LiveState; players: PlayerMap; finished: boolean; busy: boolean; onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const st = state[pending.side];
  const [player, setPlayer] = useState<number | "">("");
  const [playerIn, setPlayerIn] = useState<number | "">("");
  const [minute, setMinute] = useState<number | "">(state.minute ?? "");
  const [notes, setNotes] = useState("");
  const isSub = pending.type === "substitution";
  const pool = finished ? [...st.on_field, ...st.bench] : isSub || ["goal", "penalty_goal", "own_goal"].includes(pending.type) ? st.on_field : [...st.on_field, ...st.bench];
  const label = (id: number) => `${players[id]?.number ?? "?"} · ${players[id]?.name ?? `#${id}`}`;
  const options = (ids: number[]) => [...ids].sort((a, b) => (players[a]?.number ?? 0) - (players[b]?.number ?? 0));

  return (
    <Modal open onClose={onClose} title={`${EVENT_META[pending.type].emoji} ${EVENT_META[pending.type].label}`} size="sm" footer={
      <><button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={busy || !player || (isSub && !playerIn) || (finished && notes.trim().length < 3)}
          onClick={() => onSubmit({ player, player_in: isSub ? playerIn : undefined, minute: minute === "" ? undefined : minute, notes })}>
          {busy && <Spinner className="h-4 w-4" />}Registrar</button></>
    }>
      <div className="space-y-4">
        <div>
          <label className="label">{isSub ? "Sale" : pending.type === "own_goal" ? "Jugador (autogol)" : "Jugador"}</label>
          <select className="input" value={player} onChange={(e) => setPlayer(e.target.value ? Number(e.target.value) : "")} autoFocus>
            <option value="">Seleccione…</option>
            {options(pool).map((id) => <option key={id} value={id}>{label(id)}</option>)}
          </select>
        </div>
        {isSub && (
          <div>
            <label className="label">Entra</label>
            <select className="input" value={playerIn} onChange={(e) => setPlayerIn(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Seleccione…</option>
              {options(st.bench).map((id) => <option key={id} value={id}>{label(id)}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Minuto</label>
          <input type="number" min={0} max={200} className="input" value={minute} onChange={(e) => setMinute(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Automático" />
          <p className="help">Se calcula automáticamente con el reloj del servidor si se deja vacío.</p>
        </div>
        <div>
          <label className="label">Observación {finished && "*"}</label>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={finished ? "Motivo de la corrección posterior al final" : "Opcional"} />
        </div>
      </div>
    </Modal>
  );
}
