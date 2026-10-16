import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, ChevronDown, Wand2 } from "lucide-react";

import { Alert, Badge, Modal, SelectMenu, Spinner } from "@/components/ui";
import { useToast } from "@/hooks";
import { fields as fieldsService, matchdays, tournaments, type AutoSchedulePlan, type AutoScheduleRequest } from "@/services";
import type { Tournament } from "@/types";
import { cn } from "@/utils/cn";
import { caracasToday, DATE_MAX, DATE_MIN, formatDate, formatTime, isReasonableDate, normalizeTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";
import { fieldSize } from "@/utils/fieldCapacity";

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

/** «HH:MM» + minutos, en formato de 12 horas para mostrar (p. ej. 18:00 + 30 → 6:30 p. m.). */
function plusMinutes(value: string, minutes: number): string {
  const time = normalizeTime(value);
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  const date = new Date(Date.UTC(2000, 0, 1, Math.floor(total / 60), total % 60));
  return date.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
}

/** Días de la semana como los espera el backend (lunes = 0). */
const WEEKDAYS = [
  { value: 0, short: "Lu", label: "Lunes" }, { value: 1, short: "Ma", label: "Martes" }, { value: 2, short: "Mi", label: "Miércoles" },
  { value: 3, short: "Ju", label: "Jueves" }, { value: 4, short: "Vi", label: "Viernes" }, { value: 5, short: "Sá", label: "Sábado" },
  { value: 6, short: "Do", label: "Domingo" },
];

/**
 * Genera jornadas que cubren los partidos sin jornada: fecha de apertura, días de juego con su hora de inicio y
 * máximo de partidos por cancha. Primero muestra el plan; las jornadas se crean al confirmar.
 */
export function AutoScheduleModal({ tournamentId, onClose, onCreated }: {
  tournamentId?: number; onClose: () => void; onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [selectedTournament, setSelectedTournament] = useState<number | null>(tournamentId ?? null);
  const all = useQuery({ queryKey: ["tournaments", "all"], queryFn: () => tournaments.all(), enabled: !tournamentId });
  const tournament = useQuery({ queryKey: ["tournaments", selectedTournament], queryFn: () => tournaments.get(selectedTournament!), enabled: selectedTournament != null });

  return (
    <Modal open onClose={onClose} title="Generar jornadas" subtitle="Reparte los partidos sin jornada en los días de juego, con cancha y horario" size="xl">
      {!tournamentId && (
        <div className="mb-4 w-80">
          <label className="label">Torneo</label>
          <SelectMenu value={selectedTournament} onChange={(v) => setSelectedTournament(v == null ? null : Number(v))} placeholder="Elija el torneo…"
            options={(all.data ?? []).map((t) => ({ value: t.id, label: t.name }))} />
        </div>
      )}
      {selectedTournament == null ? null : tournament.isLoading || !tournament.data
        ? <div className="grid h-32 place-items-center"><Spinner /></div>
        : <Planner key={tournament.data.id} tournament={tournament.data} onCreated={async (plan) => {
          toast.success(`${plan.days.length} jornada(s) creadas con ${plan.scheduled} partido(s).`);
          await onCreated();
        }} onError={(e) => toast.error(e)} />}
    </Modal>
  );
}

function Planner({ tournament, onCreated, onError }: { tournament: Tournament; onCreated: (plan: AutoSchedulePlan) => Promise<void>; onError: (e: string) => void }) {
  const allFields = useQuery({ queryKey: ["options", "fields"], queryFn: () => fieldsService.all({ is_active: true }), staleTime: 60_000 });
  const fieldOptions = useMemo(() => {
    const list = allFields.data ?? [];
    return tournament.fields.length ? list.filter((f) => tournament.fields.includes(f.id)) : list;
  }, [allFields.data, tournament.fields]);

  const [startDate, setStartDate] = useState(tournament.start_date && tournament.start_date >= caracasToday() ? tournament.start_date : caracasToday());
  const [days, setDays] = useState<Set<number>>(new Set([5, 6]));
  // Horario por cancha: por defecto todas de 9:00 a 18:00 (el último partido puede terminar 30' después).
  const [hours, setHours] = useState<Record<number, { start: string; end: string }>>({});
  const [bulk, setBulk] = useState({ start: DEFAULT_START, end: DEFAULT_END });
  const [excludedFields, setExcludedFields] = useState<Set<number>>(new Set());
  const [excludedCategories, setExcludedCategories] = useState<Set<number>>(new Set());
  const [plan, setPlan] = useState<AutoSchedulePlan | null>(null);
  const [busy, setBusy] = useState<"preview" | "create" | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const hoursOf = (id: number) => hours[id] ?? { start: DEFAULT_START, end: DEFAULT_END };
  const activeFields = fieldOptions.filter((f) => !excludedFields.has(f.id));
  const fieldError = (id: number) => {
    const { start, end } = hoursOf(id);
    const [a, b] = [normalizeTime(start), normalizeTime(end)];
    return !a || !b ? "Hora inválida" : b <= a ? "La hora límite debe ser posterior al inicio" : "";
  };
  const ready = isReasonableDate(startDate) && days.size > 0 && activeFields.length > 0
    && activeFields.every((f) => !fieldError(f.id)) && tournament.categories.some((c) => !excludedCategories.has(c));
  const body = (commit: boolean): AutoScheduleRequest => ({
    tournament: tournament.id, start_date: startDate, commit, days: [...days].sort(),
    fields: activeFields.map((f) => ({ id: f.id, start: normalizeTime(hoursOf(f.id).start)!, end: normalizeTime(hoursOf(f.id).end)! })),
    categories: tournament.categories.filter((c) => !excludedCategories.has(c)),
  });
  // Cualquier cambio en la configuración invalida la vista previa.
  const change = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPlan(null); setError(""); };
  const toggle = (set: Set<number>, id: number) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); return next; };

  const run = async (commit: boolean) => {
    setBusy(commit ? "create" : "preview");
    setError("");
    try {
      const result = await matchdays.autoSchedule(body(commit));
      if (commit) await onCreated(result);
      else setPlan(result);
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      if (commit) onError(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Apertura y días de juego">
          <label className="label" htmlFor="auto-start">Día de apertura</label>
          <input id="auto-start" type="date" className={cn("input w-48", !isReasonableDate(startDate) && "input-error")} min={tournament.start_date ?? DATE_MIN}
            max={tournament.end_date ?? DATE_MAX} value={startDate} onChange={(e) => change(setStartDate)(e.target.value)} />
          <p className="help">Desde este día se recorren los días de juego{tournament.end_date ? ` hasta el fin del torneo (${formatDate(tournament.end_date)})` : ""}.</p>

          <p className="label mt-4">Días de juego</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = days.has(d.value);
              return (
                <button key={d.value} type="button" title={d.label} aria-pressed={on} aria-label={d.label}
                  onClick={() => change(setDays)(toggle(days, d.value))}
                  className={cn("h-9 w-10 rounded-lg border text-xs font-bold transition", on
                    ? "border-navy-700 bg-navy-700 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-navy-950"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10")}>{d.short}</button>
              );
            })}
          </div>
          {!days.size && <p className="mt-2 text-sm text-amber-600">Elija al menos un día de juego.</p>}
        </Section>

        <Section title="Categorías">
          <div className="flex flex-wrap gap-1.5">
            {tournament.categories.map((id, i) => (
              <Chip key={id} active={!excludedCategories.has(id)} onClick={() => change(setExcludedCategories)(toggle(excludedCategories, id))}>{tournament.category_names[i]}</Chip>
            ))}
          </div>
          <p className="help mt-2">Pulse una categoría para dejarla fuera del reparto.</p>
        </Section>
      </div>

      <Section title="Horario de cada cancha">
        <p className="help mb-3">Cada cancha encadena sus partidos desde su hora de inicio, con la duración de cada categoría (en paralelo si tiene mini canchas). El último partido puede terminar hasta <b>30 minutos después</b> de la hora límite.</p>
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[.03]">
          <span className="self-center text-sm font-semibold">Todas las canchas:</span>
          <input type="time" step={60} aria-label="Inicio para todas" className="input w-32 py-1.5" value={bulk.start} onChange={(e) => setBulk({ ...bulk, start: e.target.value })} />
          <span className="self-center text-slate-400">a</span>
          <input type="time" step={60} aria-label="Hora límite para todas" className="input w-32 py-1.5" value={bulk.end} onChange={(e) => setBulk({ ...bulk, end: e.target.value })} />
          <button type="button" className="btn-outline btn-sm" onClick={() => change(setHours)(Object.fromEntries(fieldOptions.map((f) => [f.id, { ...bulk }])))}>Aplicar a todas</button>
        </div>
        {!fieldOptions.length ? <p className="text-sm text-amber-600">No hay canchas: indíquelas en el torneo o regístrelas.</p> : (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
            <table className="table">
              <thead><tr><th className="w-10" /><th>Cancha</th><th>Inicio</th><th>Hora límite</th><th>Último partido hasta</th></tr></thead>
              <tbody>
                {fieldOptions.map((f) => {
                  const on = !excludedFields.has(f.id);
                  const { start, end } = hoursOf(f.id);
                  const problem = on ? fieldError(f.id) : "";
                  const set = (key: "start" | "end", value: string) => change(setHours)({ ...hours, [f.id]: { ...hoursOf(f.id), [key]: value } });
                  return (
                    <tr key={f.id} className={cn(!on && "opacity-50")}>
                      <td><input type="checkbox" className="h-4 w-4 accent-navy-700" checked={on} aria-label={`Usar ${f.name}`}
                        onChange={() => change(setExcludedFields)(toggle(excludedFields, f.id))} /></td>
                      <td><b className="text-sm">{f.name}</b><span className="block text-xs text-slate-500">{fieldSize(f)}{f.is_divisible ? " · divisible" : ""}</span></td>
                      <td><input type="time" step={60} disabled={!on} aria-label={`Inicio en ${f.name}`} className={cn("input w-32 py-1.5", problem && "input-error")} value={start} onChange={(e) => set("start", e.target.value)} /></td>
                      <td><input type="time" step={60} disabled={!on} aria-label={`Hora límite en ${f.name}`} className={cn("input w-32 py-1.5", problem && "input-error")} value={end} onChange={(e) => set("end", e.target.value)} /></td>
                      <td className="text-sm">{problem ? <span className="text-crimson-600">{problem}</span> : on ? plusMinutes(end, 30) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {error && <Alert tone="danger">{error}</Alert>}

      {plan && (
        <Section title="Plan propuesto">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="navy">{plan.days.length} jornada(s)</Badge>
            <Badge tone={plan.unscheduled ? "amber" : "emerald"}>{plan.scheduled} de {plan.total} partido(s)</Badge>
            {plan.days.length > 0 && <span className="text-slate-500">del {formatDate(plan.days[0].date)} al {formatDate(plan.days[plan.days.length - 1].date)}</span>}
          </div>
          {plan.warnings.map((w) => <div key={w} className="mb-2"><Alert tone="warning">{w}</Alert></div>)}
          {!plan.days.length ? <p className="text-sm text-slate-500">No hay partidos sin jornada para ubicar con esta configuración.</p> : (
            <ul className="max-h-[38vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
              {plan.days.map((d) => (
                <li key={d.number}>
                  <button type="button" onClick={() => setOpen(open === d.number ? null : d.number)} aria-expanded={open === d.number}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-white/[.03]">
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open !== d.number && "-rotate-90")} />
                    <b className="w-24">Jornada {d.number}</b>
                    <span className="flex-1 capitalize text-slate-600 dark:text-slate-300">{d.weekday} {formatDate(d.date)} · {d.start}–{d.end}</span>
                    <Badge tone="gold">{d.matches.length} partido(s)</Badge>
                  </button>
                  {open === d.number && (
                    <table className="table mb-2">
                      <thead><tr><th>Hora</th><th>Cancha</th><th>Partido</th><th>Categoría</th><th>Fase</th></tr></thead>
                      <tbody>
                        {d.matches.map((m) => (
                          <tr key={m.id}>
                            <td className="whitespace-nowrap text-sm">{formatTime(m.start)}–{formatTime(m.end)}</td>
                            <td className="text-sm">{m.field}{m.sub_field ? ` · mini ${m.sub_field}` : ""}</td>
                            <td className="text-sm font-semibold">{m.home} <span className="font-normal text-slate-400">vs</span> {m.away}</td>
                            <td><Badge tone="gold">{m.category}</Badge></td>
                            <td className="text-sm">{m.phase}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4 dark:border-white/5 dark:bg-ink-800">
        <p className="mr-auto text-xs text-slate-500">Las jornadas se crean en borrador: después puede ajustar horas o canchas y enviarlas.</p>
        <button className="btn-outline" disabled={!ready || busy !== null} onClick={() => run(false)}>
          {busy === "preview" ? <Spinner className="h-4 w-4" /> : <CalendarRange className="h-4 w-4" />} {plan ? "Recalcular plan" : "Ver plan"}
        </button>
        <button className="btn-gold" disabled={!plan || !plan.days.length || busy !== null} onClick={() => run(true)}>
          {busy === "create" ? <Spinner className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />} Crear {plan?.days.length ?? ""} jornada(s)
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-900 dark:text-gold-400">{title}</h3>
      {children}
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition", active
        ? "border-navy-700 bg-navy-700 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-navy-950"
        : "border-slate-200 text-slate-500 line-through decoration-slate-400/60 hover:border-slate-300 dark:border-white/10")}>
      {children}
    </button>
  );
}
