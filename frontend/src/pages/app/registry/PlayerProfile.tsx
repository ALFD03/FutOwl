import { useQuery } from "@tanstack/react-query";
import { Shield, Trophy } from "lucide-react";

import { Avatar, Badge, DataTable, Modal, Spinner } from "@/components/ui";
import { players } from "@/services";
import type { Player, PlayerHistory } from "@/types";
import { formatDate } from "@/utils/datetime";

/** Equipos por los que ha pasado el jugador, del más reciente al más antiguo y sin repetir. */
export function teamsOf(player: Player): { id: number; name: string }[] {
  const seen = new Map<number, string>();
  player.history.forEach((h) => { if (!seen.has(h.team)) seen.set(h.team, h.team_name); });
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

function Stat({ label, value, tone = "navy" }: { label: string; value: number; tone?: "navy" | "gold" | "crimson" }) {
  const color = { navy: "text-navy-900 dark:text-white", gold: "text-gold-600 dark:text-gold-400", crimson: "text-crimson-600 dark:text-crimson-400" }[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center dark:border-white/10 dark:bg-ink-700/40">
      <p className={`font-display text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

/** Ficha deportiva del jugador: estadísticas acumuladas y trayectoria por torneo y equipo. */
export function PlayerProfile({ playerId, onClose }: { playerId: number | null; onClose: () => void }) {
  const { data: player, isLoading } = useQuery({
    queryKey: ["players", playerId], queryFn: () => players.get(playerId!), enabled: playerId != null,
  });

  return (
    <Modal open={playerId != null} onClose={onClose} size="lg" title="Ficha del jugador" subtitle="Estadísticas acumuladas en todos los torneos">
      {isLoading || !player ? <div className="grid h-40 place-items-center"><Spinner /></div> : (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar src={player.photo} name={player.full_name} size="xl" />
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold">{player.full_name}</h3>
              <p className="text-sm text-slate-500">
                {player.vat_display || "Partida de nacimiento"} · {player.age} años ({formatDate(player.birth_date)})
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-gold-500" />
                {player.current_team_name ? <Badge tone="navy">Equipo actual: {player.current_team_name}</Badge> : <Badge>Sin equipo</Badge>}
                {player.guardian_detail && <span className="text-slate-500">Representante: {player.guardian_detail.first_name} {player.guardian_detail.last_name}</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Stat label="Goles" value={player.stats.goals} tone="gold" />
            <Stat label="Partidos" value={player.stats.matches} />
            <Stat label="Amarillas" value={player.stats.yellow_cards} tone="gold" />
            <Stat label="Rojas" value={player.stats.red_cards} tone="crimson" />
            <Stat label="Torneos" value={player.stats.tournaments} />
            <Stat label="Equipos" value={player.stats.teams} />
          </div>

          <section>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-900 dark:text-gold-400"><Trophy className="h-4 w-4" /> Trayectoria</h4>
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
              <DataTable<PlayerHistory> rows={player.history} empty="Aún no ha sido inscrito en ningún torneo." columns={[
                { key: "t", header: "Torneo", render: (h) => <b>{h.tournament_name}</b> },
                { key: "e", header: "Equipo", render: (h) => h.team_name },
                { key: "c", header: "Categoría", render: (h) => h.category_name },
                { key: "d", header: "Dorsal", render: (h) => h.shirt_number ?? "—" },
                { key: "s", header: "Estado", render: (h) => <Badge tone={h.is_active ? "navy" : "slate"}>{h.is_active ? "Inscrito" : "De baja"}</Badge> },
              ]} />
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
