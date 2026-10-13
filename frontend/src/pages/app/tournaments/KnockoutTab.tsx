import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, ListChecks, RefreshCw, Trophy } from "lucide-react";

import { Can } from "@/components/layout/Guards";
import { TeamCrest } from "@/components/match/TeamCrest";
import { Alert, Badge, Card, CardHeader, ConfirmDialog, EmptyState, SelectMenu, Spinner, StatusBadge } from "@/components/ui";
import { useToast } from "@/hooks";
import { knockout } from "@/services";
import type { KnockoutMatch, KnockoutOption, KnockoutSide, Tournament } from "@/types";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";

/** Modalidades con eliminación directa. */
export const usesKnockout = (t: Tournament) => t.modality === "groups_knockout" || t.modality === "knockout";

function describe(o: KnockoutOption, pureKnockout: boolean) {
  if (pureKnockout) return `Sorteo de los ${o.slots - o.byes} equipos inscritos${o.byes ? ` · ${o.byes} pase(s) directo(s) a la ronda siguiente` : ""}.`;
  const parts = [];
  if (o.per_group) parts.push(`los ${o.per_group} primeros de cada grupo`);
  if (o.best_extra) parts.push(`los ${o.best_extra} mejores ${o.per_group + 1}º`);
  return `${o.slots} equipos: clasifican ${parts.join(" + ")}.`;
}

export function KnockoutTab({ tournament }: { tournament: Tournament }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<number>(tournament.categories[0]);
  const [choice, setChoice] = useState<KnockoutOption | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [filling, setFilling] = useState(false);
  const pure = tournament.modality === "knockout";
  const view = useQuery({ queryKey: ["knockout", tournament.id, category], queryFn: () => knockout.view(tournament.id, category), refetchInterval: 30_000 });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["knockout"] });
    await queryClient.invalidateQueries({ queryKey: ["matches"] });
  };
  const data = view.data;
  const showChooser = data && (!data.bracket || rebuilding);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56"><SelectMenu value={category} onChange={(v) => { setCategory(Number(v)); setRebuilding(false); }}
          options={tournament.categories.map((id, i) => ({ value: id, label: tournament.category_names[i] }))} /></div>
        {data?.bracket && (
          <span className="text-sm text-slate-500">
            Desde {data.stages[0]?.label ?? ""}{!pure && ` · ${data.bracket.per_group} por grupo${data.bracket.best_extra ? ` + ${data.bracket.best_extra} mejores ${data.bracket.per_group + 1}º` : ""}`}
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {data?.bracket && !pure && !data.bracket.filled && (
            <Can perm="competition.generate_fixture">
              <button className="btn-gold btn-sm" disabled={!data.group_stage_finished} onClick={() => setFilling(true)}
                title={data.group_stage_finished ? "" : "Disponible cuando todos los partidos de grupos estén cerrados"}>
                <ListChecks className="h-4 w-4" /> Llenar con resultados de grupos
              </button>
            </Can>
          )}
          {data?.bracket && !rebuilding && (
            <Can perm="competition.generate_fixture"><button className="btn-ghost btn-sm" onClick={() => setRebuilding(true)}><RefreshCw className="h-4 w-4" /> Rehacer llave</button></Can>
          )}
        </div>
      </div>

      {view.isLoading || !data ? <div className="grid h-32 place-items-center"><Spinner /></div> : showChooser ? (
        <Card>
          <CardHeader title="Configurar la eliminación directa" icon={<GitBranch className="h-4 w-4" />}
            subtitle={pure ? "La llave se arma por sorteo con los equipos inscritos." : "Según los grupos y equipos inscritos, elija desde qué ronda empieza la llave."} />
          <div className="card-body space-y-3">
            {!data.options.length ? (
              <Alert tone="info">{pure ? "Se necesitan al menos 2 equipos inscritos." : "Primero sortee o arme los grupos de esta categoría (pestaña Grupos)."}</Alert>
            ) : data.options.map((o) => (
              <button key={o.stage} type="button" onClick={() => setChoice(o)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-gold-400 hover:shadow-soft dark:border-white/10">
                <Trophy className="h-5 w-5 shrink-0 text-gold-500" />
                <span className="flex-1"><b>{o.label}</b><span className="block text-xs text-slate-500">{describe(o, pure)}</span></span>
                <Badge tone="gold">{o.slots} equipos</Badge>
              </button>
            ))}
            {rebuilding && <button className="btn-ghost btn-sm" onClick={() => setRebuilding(false)}>Cancelar</button>}
          </div>
        </Card>
      ) : !data.stages.length ? (
        <Card><EmptyState title="Sin llave" message="Configure la eliminación directa." /></Card>
      ) : (
        <>
          {!pure && !data.bracket?.filled && (
            <Alert tone="info" title="Proyección con las posiciones actuales">
              Los nombres en cursiva indican quién entraría hoy a cada cupo. Los partidos ya pueden programarse en jornadas; los equipos se fijan con «Llenar con resultados de grupos» cuando termine la fase de grupos.
            </Alert>
          )}
          <div className="flex gap-4 overflow-x-auto pb-2">
            {data.stages.map((stage) => (
              <div key={stage.stage} className="w-72 shrink-0 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-navy-900 dark:text-gold-400">{stage.label}</h3>
                {stage.matches.map((m) => <BracketCard key={m.id} match={m} />)}
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog open={choice !== null} onClose={() => setChoice(null)} confirmLabel="Crear llave"
        title={`Crear llave desde ${choice?.label ?? ""}`}
        message={`${choice ? describe(choice, pure) : ""} Se crearán todos los partidos hasta la final, en borrador y con nombres representativos para programarlos.${data?.bracket ? " La llave actual y sus partidos en borrador se reemplazan." : ""}`}
        onConfirm={async () => {
          if (!choice) return;
          try {
            await knockout.createBracket(tournament.id, category, choice.stage);
            toast.success("Llave creada.");
            setRebuilding(false);
            await refresh();
          } catch (e) { toast.error(errorMessage(e)); throw e; }
        }} />
      <ConfirmDialog open={filling} onClose={() => setFilling(false)} confirmLabel="Llenar llave" title="Llenar con resultados de grupos"
        message="Se colocarán los clasificados reales de la fase de grupos en la primera ronda. Después ya no podrá rehacerse la llave si sus partidos se envían."
        onConfirm={async () => {
          try { await knockout.fill(tournament.id, category); toast.success("Llave completada con los clasificados."); await refresh(); }
          catch (e) { toast.error(errorMessage(e)); throw e; }
        }} />
    </div>
  );
}

function SideRow({ side, score, winner }: { side: KnockoutSide; score: number | null; winner: boolean }) {
  const name = side.team?.name ?? side.projected?.name;
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 text-sm", winner && "bg-gold-50 font-bold dark:bg-gold-500/10")}>
      {name ? <TeamCrest src={side.team?.logo ?? side.projected?.logo} name={name} size="sm" /> : <span className="h-7 w-7 shrink-0 rounded-full border border-dashed border-slate-300 dark:border-white/20" />}
      <span className="min-w-0 flex-1">
        {side.team ? <span className="block truncate">{side.team.name}</span>
          : side.projected ? <span className="block truncate italic text-slate-600 dark:text-slate-300">{side.projected.name} <span className="text-xs not-italic text-slate-400">({side.projected.points} pts)</span></span>
            : <span className="block truncate text-slate-400">{side.source || "Por definir"}</span>}
        {(side.team || side.projected) && side.source && <span className="block truncate text-[11px] text-slate-400">{side.source}</span>}
      </span>
      {score != null && <span className="font-display font-bold">{score}</span>}
    </div>
  );
}

function BracketCard({ match }: { match: KnockoutMatch }) {
  return (
    <Link to={`/app/partidos/${match.id}`} className="block overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-gold-400 hover:shadow-soft dark:border-white/10 dark:bg-ink-800">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1 text-[11px] text-slate-500 dark:border-white/5">
        <span>Partido {match.position}</span>
        <StatusBadge status={match.status} label={match.status_display} />
      </div>
      <SideRow side={match.home} score={match.home_score} winner={Boolean(match.winner && match.winner === match.home.team?.id)} />
      <SideRow side={match.away} score={match.away_score} winner={Boolean(match.winner && match.winner === match.away.team?.id)} />
      <p className="border-t border-slate-100 px-3 py-1 text-[11px] text-slate-500 dark:border-white/5">
        {match.scheduled_start ? `${formatDateTime(match.scheduled_start)} · ${match.field_name ?? "Sin cancha"}` : "Sin programar"}{match.matchday_label ? ` · ${match.matchday_label}` : ""}
      </p>
    </Link>
  );
}
