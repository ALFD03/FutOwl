import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Download, FileUp, Lock, Save, Upload } from "lucide-react";

import { api, downloadFile } from "@/api/client";
import { FileInput } from "@/components/forms";
import { Alert, Avatar, Badge, Card, CardHeader, SelectMenu, Spinner, StatusBadge, Toggle } from "@/components/ui";
import { useAuth, useToast } from "@/hooks";
import { coaches, matches, roster } from "@/services";
import type { Lineup, Match } from "@/types";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";

interface Row {
  selected: boolean;
  shirt_number: number | "";
  is_starter: boolean;
  is_captain: boolean;
}

/** Carga/importación de la alineación de un equipo (solo gestores del equipo y antes del inicio). */
export function LineupEditor({ match, side, lineup, maxPlayers, starters }: {
  match: Match; side: "home" | "away"; lineup?: Lineup; maxPlayers: number; starters: number;
}) {
  const { user, can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const registration = side === "home" ? match.home : match.away;
  const teamId = side === "home" ? match.home_team_id : match.away_team_id;
  const teamName = side === "home" ? match.home_name : match.away_name;
  const manages = Boolean(user?.profiles.team_ids.includes(teamId)) || can("competition.operate_any_match");
  const editable = manages && can("competition.submit_lineup") && ["pending", "confirmed"].includes(match.status)
    && match.phase === "not_started" && lineup?.status !== "verified";

  // Nómina del equipo en este torneo (la inscripción del partido)
  const rosterQ = useQuery({ queryKey: ["roster", registration], queryFn: () => roster.all({ registration, is_active: true }), enabled: editable });
  const coachesQ = useQuery({ queryKey: ["coaches", "team", teamId], queryFn: () => coaches.all({ team: teamId, is_active: true }), enabled: editable });
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [coach, setCoach] = useState<number | "">(lineup?.coach ?? "");
  const [sheet, setSheet] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!rosterQ.data) return;
    const initial: Record<number, Row> = {};
    rosterQ.data.forEach((tp) => {
      const lp = lineup?.players.find((p) => p.team_player === tp.id);
      initial[tp.id] = { selected: Boolean(lp), shirt_number: lp?.shirt_number ?? tp.shirt_number ?? "", is_starter: lp?.is_starter ?? false, is_captain: lp?.is_captain ?? false };
    });
    setRows(initial);
  }, [rosterQ.data, lineup]);

  const selected = useMemo(() => Object.entries(rows).filter(([, r]) => r.selected), [rows]);
  const startersCount = selected.filter(([, r]) => r.is_starter).length;
  const update = (id: number, patch: Partial<Row>) => setRows((all) => {
    const next = { ...all, [id]: { ...all[id], ...patch } };
    if (patch.is_captain) Object.keys(next).forEach((k) => Number(k) !== id && (next[Number(k)] = { ...next[Number(k)], is_captain: false }));
    if (patch.selected === false) next[id] = { ...next[id], is_starter: false, is_captain: false };
    return next;
  });

  const importFile = async (file: File | null) => {
    if (!file) return;
    try {
      const data = await matches.importLineup(match.id, file);
      setRows((all) => {
        const next: Record<number, Row> = Object.fromEntries(Object.entries(all).map(([k, r]) => [k, { ...r, selected: false, is_starter: false, is_captain: false }]));
        data.players.forEach((p) => { if (next[p.team_player]) next[p.team_player] = { selected: true, shirt_number: p.shirt_number, is_starter: p.is_starter, is_captain: p.is_captain }; });
        return next;
      });
      toast.info(`Planilla importada: ${data.players.length} convocados. Revise y envíe.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const players = selected.map(([id, r]) => ({ team_player: Number(id), shirt_number: Number(r.shirt_number), is_starter: r.is_starter, is_captain: r.is_captain }));
      const form = new FormData();
      form.append("team", String(registration));
      form.append("players", JSON.stringify(players));
      if (coach) form.append("coach", String(coach));
      if (sheet) form.append("sheet_file", sheet);
      await api.post(`/matches/${match.id}/submit-lineup/`, form);
      toast.success("Alineación cargada. Puede modificarla hasta la verificación en mesa técnica.");
      setSheet(null);
      await queryClient.invalidateQueries({ queryKey: ["matches", match.id, "lineups"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const exportSheet = (format: "pdf" | "docx") =>
    downloadFile(`/tournaments/${match.tournament}/documents/lineup-sheet/`, { format_type: format, team: teamId, category: match.category, match: match.id }, `planilla.${format}`)
      .catch((e) => toast.error(errorMessage(e)));

  return (
    <Card>
      <CardHeader title={teamName} subtitle={side === "home" ? "Local" : "Visitante"}
        actions={<>
          {lineup ? <StatusBadge status={lineup.status} label={lineup.status_display} /> : <Badge tone="amber">Sin cargar</Badge>}
          <button className="btn-ghost btn-sm" onClick={() => void exportSheet("pdf")} title="Exportar planilla PDF"><Download className="h-4 w-4" />PDF</button>
          <button className="btn-ghost btn-sm" onClick={() => void exportSheet("docx")} title="Exportar planilla Word"><Download className="h-4 w-4" />Word</button>
        </>} />
      {!editable ? (
        <div className="card-body">
          {lineup?.status === "verified" && <div className="mb-3"><Alert tone="success"><Lock className="mr-1 inline h-4 w-4" />Verificada en mesa técnica: no admite cambios.</Alert></div>}
          {lineup ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {lineup.players.map((p) => (
                <li key={p.id} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2 text-sm dark:border-white/5", p.is_starter ? "border-navy-200 bg-navy-50/50 dark:bg-navy-500/10" : "border-slate-100")}>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 font-display font-bold text-gold-400">{p.shirt_number}</span>
                  <Avatar src={p.player_photo} name={p.player_name} size="sm" />
                  <span className="flex-1 truncate">{p.player_name}</span>
                  {p.is_captain && <Crown className="h-4 w-4 text-gold-500" />}
                  <Badge tone={p.is_starter ? "navy" : "slate"}>{p.is_starter ? "Titular" : "Suplente"}</Badge>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">El equipo aún no cargó su alineación.</p>}
          {lineup?.coach_name && <p className="mt-3 text-sm text-slate-500">Entrenador: <b>{lineup.coach_name}</b></p>}
          {lineup?.sheet_file && <a href={lineup.sheet_file} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-navy-700 underline dark:text-gold-400">Ver planilla firmada</a>}
        </div>
      ) : (
        <div className="card-body space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge tone={selected.length > maxPlayers ? "crimson" : "navy"}>{selected.length}/{maxPlayers} convocados</Badge>
            <Badge tone={startersCount > starters ? "crimson" : "gold"}>{startersCount}/{starters} titulares</Badge>
            <label className="btn-outline btn-sm ml-auto cursor-pointer"><FileUp className="h-4 w-4" /> Importar planilla (.docx/.csv)
              <input type="file" accept=".docx,.csv" className="sr-only" onChange={(e) => void importFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {rosterQ.isLoading ? <Spinner /> : (
            <div className="table-wrap rounded-xl border border-slate-100 dark:border-white/5">
              <table className="table">
                <thead><tr><th>Conv.</th><th>Jugador</th><th>Dorsal</th><th>Titular</th><th>Capitán</th></tr></thead>
                <tbody>
                  {(rosterQ.data ?? []).map((tp) => {
                    const r = rows[tp.id];
                    if (!r) return null;
                    return (
                      <tr key={tp.id} className={cn(!r.selected && "opacity-60")}>
                        <td><Toggle checked={r.selected} onChange={(v) => update(tp.id, { selected: v })} label="Convocado" /></td>
                        <td><span className="flex items-center gap-2"><Avatar src={tp.player_detail.photo} name={tp.player_detail.full_name} size="sm" />{tp.player_detail.full_name}</span></td>
                        <td><input type="number" min={0} max={99} className="input w-20 py-1" value={r.shirt_number} disabled={!r.selected} onChange={(e) => update(tp.id, { shirt_number: e.target.value === "" ? "" : Number(e.target.value) })} /></td>
                        <td><Toggle checked={r.is_starter} disabled={!r.selected} onChange={(v) => update(tp.id, { is_starter: v })} label="Titular" /></td>
                        <td>
                          <button type="button" disabled={!r.selected} title={r.is_captain ? "Capitán" : "Marcar como capitán"} aria-pressed={r.is_captain}
                            onClick={() => update(tp.id, { is_captain: !r.is_captain })}
                            className={cn("grid h-8 w-8 place-items-center rounded-lg border transition-all disabled:opacity-30",
                              r.is_captain ? "border-gold-400 bg-gold-400/20 text-gold-600 shadow-gold dark:text-gold-300" : "border-slate-200 text-slate-300 hover:text-gold-500 dark:border-white/10")}>
                            <Crown className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Entrenador en banco</label>
              <SelectMenu value={coach === "" ? null : coach} onChange={(v) => setCoach(v == null ? "" : Number(v))} clearable placeholder="Sin entrenador"
                options={(coachesQ.data ?? []).map((c) => ({ value: c.id, label: c.full_name, hint: `Licencia ${c.license_number}` }))} />
            </div>
            <div>
              <label className="label">Planilla firmada (opcional)</label>
              <FileInput value={sheet ?? lineup?.sheet_file ?? null} onChange={setSheet} accept="application/pdf,image/jpeg,image/png" />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={submit} disabled={busy || !selected.length || selected.some(([, r]) => r.shirt_number === "")}>
              {busy ? <Spinner className="h-4 w-4" /> : lineup ? <Save className="h-4 w-4" /> : <Upload className="h-4 w-4" />}{lineup ? "Actualizar alineación" : "Cargar alineación"}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
