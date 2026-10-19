import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wand2 } from "lucide-react";

import { Alert, Modal, SelectMenu, Spinner } from "@/components/ui";
import { useToast } from "@/hooks";
import { fields as fieldsService, matchdays, tournaments, type AutoSchedulePlan, type AutoScheduleRequest } from "@/services";
import type { Tournament } from "@/types";
import { cn } from "@/utils/cn";
import { caracasToday, DATE_MAX, DATE_MIN, formatDate, isReasonableDate, normalizeTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";
import { fieldSize } from "@/utils/fieldCapacity";

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Configuración de una cancha para el generador: horario y días de la semana en que se puede jugar en ella. */
interface FieldConfig { start: string; end: string; days: number[] }
const DEFAULT_CONFIG: FieldConfig = { start: DEFAULT_START, end: DEFAULT_END, days: ALL_DAYS };

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

/** Días de la semana como botones compactos (Lu … Do). */
function DayPicker({ value, onChange, disabled, label }: { value: number[]; onChange: (days: number[]) => void; disabled?: boolean; label: string }) {
  return (
    <div className="flex gap-1" role="group" aria-label={label}>
      {WEEKDAYS.map((d) => {
        const on = value.includes(d.value);
        return (
          <button key={d.value} type="button" title={d.label} aria-pressed={on} aria-label={`${d.label} (${label})`} disabled={disabled}
            onClick={() => onChange(on ? value.filter((x) => x !== d.value) : [...value, d.value].sort())}
            className={cn("h-7 w-7 rounded-md border text-[11px] font-bold transition disabled:cursor-not-allowed", on
              ? "border-navy-700 bg-navy-700 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-navy-950"
              : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10")}>{d.short}</button>
        );
      })}
    </div>
  );
}

/**
 * Genera jornadas que cubren los partidos sin jornada: fecha de apertura y, por cancha, los días de la semana en
 * que se puede jugar y su horario. Las jornadas se crean en borrador directamente.
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
          const range = plan.days.length ? ` (del ${formatDate(plan.days[0].date)} al ${formatDate(plan.days[plan.days.length - 1].date)})` : "";
          const created = `${plan.days.length} jornada(s) creadas${range} con ${plan.scheduled} de ${plan.total} partido(s).`;
          if (plan.unscheduled || plan.warnings.length) toast.warning([created, ...plan.warnings].join(" "));
          else toast.success(created);
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
  // Días y horario por cancha: por defecto todos los días, de 9:00 a 18:00 (el último partido puede terminar 30' después).
  const [config, setConfig] = useState<Record<number, FieldConfig>>({});
  const [bulk, setBulk] = useState<FieldConfig>(DEFAULT_CONFIG);
  const [excludedFields, setExcludedFields] = useState<Set<number>>(new Set());
  const [excludedCategories, setExcludedCategories] = useState<Set<number>>(new Set());
  const [sameCapacity, setSameCapacity] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const configOf = (id: number) => config[id] ?? DEFAULT_CONFIG;
  const activeFields = fieldOptions.filter((f) => !excludedFields.has(f.id));
  const fieldError = (id: number) => {
    const { start, end, days } = configOf(id);
    const [a, b] = [normalizeTime(start), normalizeTime(end)];
    return !days.length ? "Elija al menos un día" : !a || !b ? "Hora inválida" : b <= a ? "La hora límite debe ser posterior al inicio" : "";
  };
  const ready = isReasonableDate(startDate) && activeFields.length > 0
    && activeFields.every((f) => !fieldError(f.id)) && tournament.categories.some((c) => !excludedCategories.has(c));
  const body = (): AutoScheduleRequest => ({
    tournament: tournament.id, start_date: startDate, commit: true,
    fields: activeFields.map((f) => {
      const { start, end, days } = configOf(f.id);
      return { id: f.id, start: normalizeTime(start)!, end: normalizeTime(end)!, days };
    }),
    categories: tournament.categories.filter((c) => !excludedCategories.has(c)),
    same_capacity: sameCapacity,
  });
  const change = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setError(""); };
  const toggle = (set: Set<number>, id: number) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); return next; };

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await onCreated(await matchdays.autoSchedule(body()));
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Apertura">
          <label className="label" htmlFor="auto-start">Día de apertura</label>
          <input id="auto-start" type="date" className={cn("input w-48", !isReasonableDate(startDate) && "input-error")} min={tournament.start_date ?? DATE_MIN}
            max={tournament.end_date ?? DATE_MAX} value={startDate} onChange={(e) => change(setStartDate)(e.target.value)} />
          <p className="help">Desde este día se arma una jornada por cada día en que al menos una cancha se puede usar{tournament.end_date ? `, hasta el fin del torneo (${formatDate(tournament.end_date)})` : ""}. Los días de cada cancha se eligen abajo.</p>
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

      <Section title="Días y horario de cada cancha">
        <p className="help mb-3">Cada cancha dice qué <b>días de la semana</b> se puede jugar en ella (por defecto todos) y encadena sus partidos desde su hora de inicio, con la duración de cada categoría (varios a la vez si es divisible, según las medidas de juego de la categoría). El último partido puede terminar hasta <b>30 minutos después</b> de la hora límite.</p>
        <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 dark:border-white/10">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-navy-700" checked={sameCapacity} onChange={(e) => change(setSameCapacity)(e.target.checked)} />
          <span className="text-sm"><b>Misma capacidad toda la jornada en cada cancha</b>
            <span className="block text-xs text-slate-500">Una cancha divisible se arma una sola vez por día: si arranca con 4 partidos a la vez, todo el día juega 4 a la vez (solo categorías de ese tamaño). Las canchas se reparten entre las categorías según lo que pide cada jornada.</span></span>
        </label>
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[.03]">
          <span className="self-center text-sm font-semibold">Todas las canchas:</span>
          <div className="self-center"><DayPicker label="todas las canchas" value={bulk.days} onChange={(days) => setBulk({ ...bulk, days })} /></div>
          <input type="time" step={60} aria-label="Inicio para todas" className="input w-32 py-1.5" value={bulk.start} onChange={(e) => setBulk({ ...bulk, start: e.target.value })} />
          <span className="self-center text-slate-400">a</span>
          <input type="time" step={60} aria-label="Hora límite para todas" className="input w-32 py-1.5" value={bulk.end} onChange={(e) => setBulk({ ...bulk, end: e.target.value })} />
          <button type="button" className="btn-outline btn-sm" onClick={() => change(setConfig)(Object.fromEntries(fieldOptions.map((f) => [f.id, { ...bulk }])))}>Aplicar a todas</button>
        </div>
        {!fieldOptions.length ? <p className="text-sm text-amber-600">No hay canchas: indíquelas en el torneo o regístrelas.</p> : (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
            <table className="table">
              <thead><tr><th className="w-10" /><th>Cancha</th><th>Días</th><th>Inicio</th><th>Hora límite</th><th>Último partido hasta</th></tr></thead>
              <tbody>
                {fieldOptions.map((f) => {
                  const on = !excludedFields.has(f.id);
                  const { start, end, days } = configOf(f.id);
                  const problem = on ? fieldError(f.id) : "";
                  const set = (patch: Partial<FieldConfig>) => change(setConfig)({ ...config, [f.id]: { ...configOf(f.id), ...patch } });
                  return (
                    <tr key={f.id} className={cn(!on && "opacity-50")}>
                      <td><input type="checkbox" className="h-4 w-4 accent-navy-700" checked={on} aria-label={`Usar ${f.name}`}
                        onChange={() => change(setExcludedFields)(toggle(excludedFields, f.id))} /></td>
                      <td><b className="text-sm">{f.name}</b><span className="block text-xs text-slate-500">{fieldSize(f)}{f.is_divisible ? " · divisible" : ""}</span></td>
                      <td><DayPicker label={f.name} value={days} disabled={!on} onChange={(next) => set({ days: next })} /></td>
                      <td><input type="time" step={60} disabled={!on} aria-label={`Inicio en ${f.name}`} className={cn("input w-32 py-1.5", problem && problem !== "Elija al menos un día" && "input-error")} value={start} onChange={(e) => set({ start: e.target.value })} /></td>
                      <td><input type="time" step={60} disabled={!on} aria-label={`Hora límite en ${f.name}`} className={cn("input w-32 py-1.5", problem && problem !== "Elija al menos un día" && "input-error")} value={end} onChange={(e) => set({ end: e.target.value })} /></td>
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

      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4 dark:border-white/5 dark:bg-ink-800">
        <p className="mr-auto text-xs text-slate-500">Las jornadas se crean en borrador: después puede ajustar horas o canchas y enviarlas.</p>
        <button className="btn-gold" disabled={!ready || busy} onClick={run}>
          {busy ? <Spinner className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />} Generar jornadas
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
