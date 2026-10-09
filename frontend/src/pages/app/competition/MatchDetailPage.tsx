import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, ExternalLink, History, PencilRuler } from "lucide-react";

import { Can } from "@/components/layout/Guards";
import { AdjustDialog } from "@/components/match/AdjustDialog";
import { ConfirmationPanel } from "@/components/match/ConfirmationPanel";
import { LineupEditor } from "@/components/match/LineupEditor";
import { LiveConsole } from "@/components/match/LiveConsole";
import { NotesPanel } from "@/components/match/NotesPanel";
import { ReportsPanel } from "@/components/match/ReportsPanel";
import { ScoreBoard } from "@/components/match/ScoreBoard";
import { Card, CardHeader, ConfirmDialog, KeyValue, PageLoader, Tabs } from "@/components/ui";
import { useAuth, useLiveInterval, useToast } from "@/hooks";
import { matches, tournaments } from "@/services";
import type { Match } from "@/types";
import { formatDateTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";
import { FIELD_LABELS, PARTY_LABELS } from "@/utils/labels";

type Tab = "summary" | "lineups" | "live" | "reports" | "notes";

export function MatchDetailPage() {
  const id = Number(useParams().id);
  const { user } = useAuth();
  const interval = useLiveInterval(10_000);
  const { data: match, isLoading } = useQuery({ queryKey: ["matches", id], queryFn: () => matches.get(id), refetchInterval: interval });
  const isDelegate = Boolean(user?.profiles.delegate_id && match && user.profiles.delegate_id === match.delegate);
  const [tab, setTab] = useState<Tab | null>(null);
  const liveInterval = useLiveInterval(4_000);
  const playing = match?.status === "in_progress" || match?.status === "finished";
  // Marcador en vivo (no oficial) calculado a partir de la cronología de la mesa técnica
  const live = useQuery({ queryKey: ["matches", id, "state"], queryFn: () => matches.state(id), enabled: playing, refetchInterval: liveInterval });
  if (isLoading || !match) return <PageLoader />;
  const score = playing && live.data ? { home: live.data.home_score, away: live.data.away_score } : { home: match.home_score, away: match.away_score };
  const current: Tab = tab ?? (isDelegate && ["confirmed", "in_progress", "finished"].includes(match.status) ? "live" : "summary");

  return (
    <div>
      <Link to="/app/partidos" className="btn-ghost mb-4 -ml-3"><ArrowLeft className="h-4 w-4" /> Partidos</Link>
      <ScoreBoard homeName={match.home_name} awayName={match.away_name} homeLogo={match.home_logo} awayLogo={match.away_logo}
        homeScore={score.home} awayScore={score.away} status={match.status} statusLabel={match.status_display}
        phase={match.phase} period={match.current_period} start={match.scheduled_start} minute={live.data?.minute}
        subtitle={`${match.tournament_name} · ${match.category_name}${match.matchday_label ? ` · ${match.matchday_label}` : ""}`} />
      <div className="mt-6">
        <Tabs<Tab> value={current} onChange={setTab} tabs={[
          { id: "summary", label: "Resumen y confirmaciones" }, { id: "lineups", label: "Alineaciones" },
          { id: "live", label: "Mesa técnica", hidden: match.status === "draft" || match.status === "pending" },
          { id: "reports", label: "Informes y cierre", hidden: !["finished", "closed"].includes(match.status) },
          { id: "notes", label: "Notas y apelaciones" },
        ]} />
      </div>
      {current === "summary" && <Summary match={match} />}
      {current === "lineups" && <Lineups match={match} />}
      {current === "live" && <LiveConsole match={match} showScoreboard={false} />}
      {current === "reports" && <ReportsPanel match={match} />}
      {current === "notes" && <NotesPanel match={match} />}
    </div>
  );
}

function Summary({ match }: { match: Match }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [adjusting, setAdjusting] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const adjustments = useQuery({ queryKey: ["matches", match.id, "adjustments"], queryFn: () => matches.adjustments(match.id), enabled: match.is_locked });
  const adjustable = match.status === "pending" || match.status === "confirmed";

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Asignación" subtitle={match.is_locked ? `Bloqueada · versión ${match.assignment_version}` : "Borrador: se edita desde la jornada"}
            actions={<>
              {match.status !== "draft" && <Link to={`/partido/${match.id}`} className="btn-ghost btn-sm" target="_blank"><ExternalLink className="h-4 w-4" /> Vista pública</Link>}
              {adjustable && <Can perm="competition.adjust_match"><button className="btn-outline btn-sm" onClick={() => setAdjusting(true)}><PencilRuler className="h-4 w-4" /> Ajustar</button></Can>}
              {!["closed", "suspended", "draft"].includes(match.status) && <Can perm="competition.suspend_match"><button className="btn-ghost btn-sm text-crimson-600" onClick={() => setSuspending(true)}><Ban className="h-4 w-4" /> Suspender</button></Can>}
            </>} />
          <div className="card-body">
            <KeyValue items={[
              { label: "Inicio", value: formatDateTime(match.scheduled_start) },
              { label: "Fin programado", value: formatDateTime(match.scheduled_end) },
              { label: "Cancha", value: match.field_name ? `${match.field_name}${match.sub_field ? ` · mini cancha ${match.sub_field}` : ""}` : "—" },
              { label: "Jornada", value: match.matchday ? <Link className="font-semibold text-navy-700 underline dark:text-gold-400" to={`/app/jornadas/${match.matchday}`}>{match.matchday_label}</Link> : "Sin jornada" },
              { label: "Delegado", value: match.delegate_name },
              { label: "Árbitro principal", value: match.referee_name },
              { label: "Asistente 1", value: match.assistant_referee_1_name },
              { label: "Asistente 2", value: match.assistant_referee_2_name },
            ]} />
            {match.missing_fields.length > 0 && <p className="mt-4 text-xs text-amber-600">Falta completar: {match.missing_fields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}</p>}
          </div>
        </Card>
        {adjustments.data && adjustments.data.length > 0 && (
          <Card>
            <CardHeader title="Historial de ajustes" subtitle="Evidencia de cambios posteriores (nada se sobrescribe)" icon={<History className="h-5 w-5" />} />
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {adjustments.data.map((a) => (
                <li key={a.id} className="px-5 py-4 text-sm">
                  <p className="mb-1 text-xs text-slate-500">{formatDateTime(a.created_at)} · {a.username} · v{a.version_from} → v{a.version_to}</p>
                  <p className="italic">“{a.reason}”</p>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {Object.entries(a.changes).map(([field, change]) => (
                      <li key={field}><b>{FIELD_LABELS[field] ?? field}:</b> <span className="text-crimson-600 line-through">{display(change.antes)}</span> → <span className="text-emerald-600">{display(change.despues)}</span></li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-slate-500">Deben reconfirmar: {a.affected_parties.map((p) => PARTY_LABELS[p]).join(", ")}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      {match.is_locked && <ConfirmationPanel match={match} />}
      {adjusting && <AdjustDialog match={match} open={adjusting} onClose={() => setAdjusting(false)} />}
      <ConfirmDialog open={suspending} onClose={() => setSuspending(false)} title="Suspender partido" danger requireReason confirmLabel="Suspender"
        message="La suspensión queda registrada con su motivo y se notifica a los involucrados."
        onConfirm={async (reason) => {
          try { await matches.suspend(match.id, reason); toast.success("Partido suspendido."); await queryClient.invalidateQueries({ queryKey: ["matches"] }); }
          catch (e) { toast.error(errorMessage(e)); throw e; }
        }} />
    </div>
  );
}

function display(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object" && "label" in (value as Record<string, unknown>)) return String((value as { label: string }).label);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  return String(value);
}

function Lineups({ match }: { match: Match }) {
  const { data = [] } = useQuery({ queryKey: ["matches", match.id, "lineups"], queryFn: () => matches.lineups(match.id) });
  const tournament = useQuery({ queryKey: ["tournaments", match.tournament], queryFn: () => tournaments.get(match.tournament) });
  const max = tournament.data?.max_lineup_players ?? 18;
  const starters = tournament.data?.starters_count ?? 11;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <LineupEditor match={match} side="home" lineup={data.find((l) => l.team === match.home)} maxPlayers={max} starters={starters} />
      <LineupEditor match={match} side="away" lineup={data.find((l) => l.team === match.away)} maxPlayers={max} starters={starters} />
    </div>
  );
}
