import type { StandingRow } from "@/types";
import { cn } from "@/utils/cn";

import { TeamCrest } from "./TeamCrest";

const FORM = { G: "bg-emerald-500", E: "bg-slate-400", P: "bg-crimson-500" };

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-slate-400">Sin equipos en la tabla.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>#</th><th>Equipo</th><th className="text-center">PJ</th><th className="text-center">G</th><th className="text-center">E</th>
            <th className="text-center">P</th><th className="hidden text-center sm:table-cell">GF</th><th className="hidden text-center sm:table-cell">GC</th>
            <th className="text-center">DG</th><th className="text-center">PTS</th><th className="hidden md:table-cell">Forma</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team_id}>
              <td><span className={cn("grid h-6 w-6 place-items-center rounded-md text-xs font-bold", r.position <= 2 ? "bg-gold-400 text-navy-950" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300")}>{r.position}</span></td>
              <td><span className="flex items-center gap-2 font-semibold"><TeamCrest src={r.logo} name={r.team} size="sm" />{r.team}</span></td>
              <td className="text-center tabular-nums">{r.played}</td>
              <td className="text-center tabular-nums">{r.won}</td>
              <td className="text-center tabular-nums">{r.drawn}</td>
              <td className="text-center tabular-nums">{r.lost}</td>
              <td className="hidden text-center tabular-nums sm:table-cell">{r.gf}</td>
              <td className="hidden text-center tabular-nums sm:table-cell">{r.ga}</td>
              <td className="text-center tabular-nums">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td className="text-center font-display text-base font-bold text-navy-900 dark:text-gold-400">{r.points}</td>
              <td className="hidden md:table-cell"><span className="flex gap-1">{r.form.map((f, i) => <span key={i} className={cn("grid h-5 w-5 place-items-center rounded text-[10px] font-bold text-white", FORM[f])}>{f}</span>)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
